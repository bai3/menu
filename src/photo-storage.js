// Private Storage objects are referenced by path, never by a long-lived signed URL.
const photoPrefix = 'storage://';
const photoBucket = 'meal-photos';
const photoUrls = new Map();
const photoPending = new Map();
const isStoredPhoto = value => typeof value === 'string' && value.startsWith(photoPrefix);
const photoPath = value => value.slice(photoPrefix.length);
const photoPlaceholder = value => `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=#photo=${encodeURIComponent(value)}`;
async function photoOwnerFolder() {
 const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(betaCode));
 return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}
// Abort stalled signing and download requests so a weak connection cannot occupy
// a queue slot indefinitely. A fresh controller is used for every request.
function photoTimedFetch(input, init={}) {
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 return fetch(input,{...init,signal:controller.signal}).then(response=>{
  // Keep the deadline until the response body has been read, not just headers.
  for(const method of ['json','text','blob','arrayBuffer']) {
   const read=response[method].bind(response);
   response[method]=()=>read().finally(()=>clearTimeout(timer));
  }
  return response;
 },error=>{clearTimeout(timer);throw error;});
}
let photoClientKey='', photoStorageClient=null;
function photoClient() {
 if(typeof window==='undefined' || !window.supabase || !window.JIAYAN_SUPABASE)return sb;
 const shared=typeof sharedMeal!=='undefined' && sharedMeal.invite && sharedMeal.person && sharedMeal.data?.joined;
 const key=shared ? `shared:${sharedMeal.invite}:${sharedMeal.person}` : `owner:${betaCode}`;
 if(key!==photoClientKey) {
  const headers=shared ? {'x-meal-invite':sharedMeal.invite,'x-meal-person':sharedMeal.person} : {'x-beta-code':betaCode};
  photoStorageClient=window.supabase.createClient(window.JIAYAN_SUPABASE.url,window.JIAYAN_SUPABASE.publishableKey,{
   global:{headers,fetch:photoTimedFetch},auth:{persistSession:false,autoRefreshToken:false}
  });
  photoClientKey=key;
 }
 return photoStorageClient;
}
async function rememberPhoto(value, blob) {
 const url = URL.createObjectURL(blob);
 photoUrls.set(value, url);
 try { await idbSet(`photo:${value}`, blob); } catch (_) { /* Display still works until the page closes. */ }
 return url;
}
// Visible images enter the front of the queue; background caching uses spare capacity.
const photoQueue = [];
const photoFailures = new Set();
let photoActive = 0;
const photoConcurrency = 4;
function pumpPhotoQueue() {
 while (photoActive < photoConcurrency && photoQueue.length) {
  photoQueue.sort((a,b) => b.priority-a.priority);
  const job=photoQueue.shift(); photoActive++;
  job.run().finally(() => { photoActive--; pumpPhotoQueue(); });
 }
}
function queuePhotoNetwork(value, priority) {
 return new Promise(resolve => {
  const job={priority, run:async()=>{
   try {
    if (offlineMode || !photoClient()) return resolve('');
    const {data,error} = await photoClient().storage.from(photoBucket).createSignedUrl(photoPath(value), 60);
    if (error || !data?.signedUrl) throw error || new Error('图片授权失败');
    const response = await photoTimedFetch(data.signedUrl);
    if (!response.ok) { await response.text().catch(()=>{}); throw new Error('图片下载失败'); }
    const blob=await response.blob();
    if (!blob.size || !blob.type.startsWith('image/')) throw new Error('图片内容无效');
    resolve(await rememberPhoto(value,blob));
   } catch (_) { resolve(''); }
  }};
  const pending=photoPending.get(value); if(pending) pending.job=job;
  photoQueue.push(job); pumpPhotoQueue();
 });
}
const photoDelay = ms => new Promise(resolve => setTimeout(resolve,ms));
async function resolvePhoto(value, options={}) {
 if (!isStoredPhoto(value)) return value;
 if (photoUrls.has(value)) return photoUrls.get(value);
 const current=photoPending.get(value);
 if (current) { if(options.priority) { current.priority=1; if(current.job) current.job.priority=1; } return current.promise; }
 const pending={job:null,promise:null,priority:options.priority ? 1 : 0};
 photoPending.set(value,pending);
 pending.promise=(async()=>{
  try { const cached=await idbGet(`photo:${value}`); if(cached instanceof Blob) return await rememberPhoto(value,cached); } catch (_) {}
  if (offlineMode) return '';
  for (let attempt=0;attempt<3;attempt++) {
   if (attempt) await photoDelay(attempt===1 ? 800 : 2000);
   if (offlineMode) break;
   const url=await queuePhotoNetwork(value,pending.priority);
   if(url) { photoFailures.delete(value); return url; }
  }
  photoFailures.add(value); return '';
 })().finally(()=>photoPending.delete(value));
 return pending.promise;
}
function displayPhoto(value) {
 if (!isStoredPhoto(value)) return value;
 return photoUrls.get(value) || photoPlaceholder(value);
}
function storedPhotoFromElement(img) {
 const src=img.getAttribute('src') || '', marker='#photo=';
 if (!src.startsWith('data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=') || !src.includes(marker)) return '';
 try { const value=decodeURIComponent(src.slice(src.indexOf(marker)+marker.length)); return isStoredPhoto(value) ? value : ''; } catch (_) { return ''; }
}
function showPhotoResult(value, url) {
 document.querySelectorAll('img').forEach(img => {
  if(storedPhotoFromElement(img)!==value)return;
  const parent=img.closest('.dish');
  let retry=parent?.querySelector('.photo-retry');
  if(url) {
   img.src=url; img.style.visibility='';
   if(retry)retry.remove();
  } else if(parent && !retry) {
   retry=document.createElement('button'); retry.type='button'; retry.className='photo-retry';
   retry.textContent='图片重试'; retry.setAttribute('aria-label','图片加载失败，点击重试');
   retry.addEventListener('click',event=>{event.stopPropagation();retry.disabled=true;retry.textContent='加载中';photoFailures.delete(value);loadVisiblePhoto(value);});
   parent.appendChild(retry);
  } else if(retry) { retry.disabled=false; retry.textContent='图片重试'; }
 });
}
function loadVisiblePhoto(value) {
 resolvePhoto(value,{priority:true}).then(url=>showPhotoResult(value,url));
}
let photoObserver;
function watchPhotoElement(img) {
 const value=storedPhotoFromElement(img); if(!value)return;
 if(photoUrls.has(value)) { img.src=photoUrls.get(value); return; }
 if(photoFailures.has(value)) { showPhotoResult(value,''); return; }
 if(photoObserver) photoObserver.observe(img); else loadVisiblePhoto(value);
}
function watchPhotoTree(node) {
 if(node.nodeType!==1)return;
 if(node.matches('img'))watchPhotoElement(node);
 node.querySelectorAll('img').forEach(watchPhotoElement);
}
function retryVisiblePhotos() {
 photoFailures.clear();
 document.querySelectorAll('img').forEach(img=>{const value=storedPhotoFromElement(img);if(value){const retry=img.closest('.dish')?.querySelector('.photo-retry');if(retry)retry.remove();watchPhotoElement(img);}});
}
if(typeof MutationObserver!=='undefined' && typeof document!=='undefined') {
 if(typeof IntersectionObserver!=='undefined') photoObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){photoObserver.unobserve(entry.target);const value=storedPhotoFromElement(entry.target);if(value)loadVisiblePhoto(value);}}),{rootMargin:'300px'});
 new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(watchPhotoTree))).observe(document.body,{childList:true,subtree:true});
}
// Cache all photos opportunistically after the visible images have started loading.
let photoPrefetchTimer;
function prefetchPhotos(values) {
 clearTimeout(photoPrefetchTimer);
 photoPrefetchTimer=setTimeout(()=>values.forEach(value=>{if(isStoredPhoto(value)&&!photoFailures.has(value))resolvePhoto(value);}),1500);
}
async function uploadPhoto(dataUrl, kind) {
 if (offlineMode || !sb) throw new Error('云端不可用');
 const blob = await (await fetch(dataUrl)).blob();
 const folder = await photoOwnerFolder();
 const random = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join('');
 const path = `${folder}/${kind}/${random}.jpg`;
 const {error} = await sb.storage.from(photoBucket).upload(path, blob, {contentType:'image/jpeg', upsert:false});
 if (error) throw error;
 const value = photoPrefix + path;
 await rememberPhoto(value, blob);
 return value;
}
// Old objects are deliberately retained: active shared-meal snapshots may reference them.

// Run explicitly after all clients have updated: older clients cannot display Storage paths.
async function migrateLegacyPhotos() {
 if (offlineMode || !sb) throw new Error('请联网后再迁移');
 let moved=0, failed=0;
 for (const [table, field, kind] of [['dishes','image','dishes'],['meal_history','photo','diary']]) {
  const rows=[];
  for (let offset=0;;offset+=500) {
   const {data,error}=await sb.from(table).select(`id,${field}`).order('id').range(offset,offset+499);
   if (error) throw error;
   rows.push(...data); if (data.length<500) break;
  }
  for (const row of rows) {
   const original=row[field];
   if (typeof original !== 'string' || !original.startsWith('data:image/')) continue;
   try {
    const path=await uploadPhoto(original,kind);
    const {data:signed,error:signError}=await sb.storage.from(photoBucket).createSignedUrl(photoPath(path),60);
    if (signError || !signed?.signedUrl) throw signError || new Error('图片授权失败');
    const response=await fetch(signed.signedUrl); if(!response.ok) throw new Error('图片验证失败');
    const downloaded=await response.arrayBuffer(), expected=await (await fetch(original)).arrayBuffer();
    const [actualHash,expectedHash]=await Promise.all([crypto.subtle.digest('SHA-256',downloaded),crypto.subtle.digest('SHA-256',expected)]);
    if (Array.from(new Uint8Array(actualHash)).some((n,i)=>n!==new Uint8Array(expectedHash)[i])) throw new Error('图片校验不一致');
    const {data:updated,error:updateError}=await sb.rpc('migrate_photo_reference',{p_kind:kind,p_id:row.id,p_old:original,p_path:path});
    if(updateError || !updated) throw updateError || new Error('照片已更改');
    moved++;
   } catch (_) { failed++; }
  }
 }
 await syncFromCloud();
 return {moved,failed};
}
