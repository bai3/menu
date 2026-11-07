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
function photoClient() {
 if (typeof sharedMeal !== 'undefined' && sharedMeal.invite && sharedMeal.person && sharedMeal.data?.joined) {
  return window.supabase.createClient(window.JIAYAN_SUPABASE.url, window.JIAYAN_SUPABASE.publishableKey, {
   global: {headers:{'x-meal-invite':sharedMeal.invite,'x-meal-person':sharedMeal.person}}, auth:{persistSession:false,autoRefreshToken:false}
  });
 }
 return sb;
}
async function rememberPhoto(value, blob) {
 const url = URL.createObjectURL(blob);
 photoUrls.set(value, url);
 try { await idbSet(`photo:${value}`, blob); } catch (_) { /* Display still works until the page closes. */ }
 return url;
}
async function resolvePhoto(value) {
 if (!isStoredPhoto(value)) return value;
 if (photoUrls.has(value)) return photoUrls.get(value);
 if (photoPending.has(value)) return photoPending.get(value);
 const pending = (async () => {
  try { const cached = await idbGet(`photo:${value}`); if (cached instanceof Blob) return await rememberPhoto(value, cached); } catch (_) {}
  if (offlineMode) return '';
  const client = photoClient(); if (!client) return '';
  // Signing uses an authenticated POST. Fetching the resulting short-lived URL avoids
  // Storage versions that do not forward custom headers to authenticated GET policies.
  const {data,error} = await client.storage.from(photoBucket).createSignedUrl(photoPath(value), 60);
  if (error || !data?.signedUrl) throw error || new Error('图片授权失败');
  const response = await fetch(data.signedUrl); if (!response.ok) throw new Error('图片下载失败');
  return rememberPhoto(value, await response.blob());
 })().catch(() => '').finally(() => photoPending.delete(value));
 photoPending.set(value, pending); return pending;
}
function displayPhoto(value) {
 if (!isStoredPhoto(value)) return value;
 if (photoUrls.has(value)) return photoUrls.get(value);
 const placeholder = photoPlaceholder(value);
 resolvePhoto(value).then(url => {
  if (!url) return;
  document.querySelectorAll('img').forEach(img => { if (img.getAttribute('src') === placeholder) { img.src = url; img.style.visibility = ''; } });
 });
 return placeholder;
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
