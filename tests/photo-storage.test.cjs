const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync('src/photo-storage.js','utf8');
function setup(options={}) {
 const blobs=new Map(),calls=[];
 const bucket={
  upload:async(path,blob)=>{calls.push(['upload',path]);return {error:options.uploadError||null}},
  createSignedUrl:async(path)=>{calls.push(['sign',path]);if(options.sign)return options.sign(path);return {data:{signedUrl:'https://example.test/photo'},error:null}}
 };
 const db={storage:{from:()=>bucket},from:table=>({select:()=>({order:()=>({range:async()=>({data:table==='dishes'?(options.rows||[]):[],error:null})})})}),rpc:async(name,args)=>{calls.push(['rpc',args]);return {data:options.updated!==false,error:null}}};
 const ctx=vm.createContext({escapeText:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),Blob,AbortController,setTimeout:options.setTimeout||setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:local'},TextEncoder,Uint8Array,crypto:webcrypto,betaCode:'test-code',offlineMode:false,sb:db,idbGet:async key=>blobs.get(key),idbSet:async(key,value)=>blobs.set(key,value),document:{querySelectorAll:()=>[]},fetch:async url=>url.startsWith('data:')?new Response(new Blob(['photo'],{type:'image/jpeg'})):new Response(new Blob([options.download||'photo'],{type:'image/jpeg'})),Response,syncFromCloud:async()=>{}});
 vm.runInContext(source,ctx);
 return {ctx,calls,blobs};
}
test('uploads a JPEG under a non-secret owner folder and caches it',async()=>{
 const h=setup(); const path=await h.ctx.uploadPhoto('data:image/jpeg;base64,cGhvdG8=','dishes');
 assert.match(path,/^storage:\/\/[a-f0-9]{64}\/dishes\/[a-f0-9-]+\.jpg$/);
 assert.ok(!path.includes('test-code'));assert.ok(h.blobs.has('photo:'+path));
});
test('offline lookup uses cached bytes and makes no network request',async()=>{
 const h=setup(),path='storage://folder/dishes/file.jpg'; h.ctx.offlineMode=true;h.blobs.set('photo:'+path,new Blob(['cached']));
 assert.equal(await h.ctx.resolvePhoto(path),'blob:local');assert.deepEqual(h.calls,[]);
});
test('failed upload does not produce a stored reference',async()=>{
 const h=setup({uploadError:new Error('denied')});await assert.rejects(h.ctx.uploadPhoto('data:image/jpeg;base64,cGhvdG8=','dishes'));assert.equal(h.blobs.size,0);
});
test('migration checks downloaded bytes before updating the row',async()=>{
 const h=setup({rows:[{id:'1',image:'data:image/jpeg;base64,cGhvdG8='}],download:'different'});
 const result=await h.ctx.migrateLegacyPhotos();assert.equal(result.failed,1);assert.equal(result.moved,0);assert.ok(!h.calls.some(c=>c[0]==='rpc'));
});
test('migration treats a concurrent row change as a failure',async()=>{
 const h=setup({rows:[{id:'1',image:'data:image/jpeg;base64,cGhvdG8='}],updated:false});
 const result=await h.ctx.migrateLegacyPhotos();assert.equal(result.failed,1);assert.equal(result.moved,0);assert.equal(h.calls.filter(c=>c[0]==='rpc').length,1);
});

test('a transient signing failure is retried and the successful image is cached',async()=>{
 let attempts=0;const h=setup({setTimeout:(fn,ms)=>ms===12000?setTimeout(fn,ms):setTimeout(fn,0),sign:async()=>++attempts===1?{error:new Error('temporary')}:{data:{signedUrl:'https://example.test/photo'}}});
 const value='storage://folder/dishes/one.jpg';assert.equal(await h.ctx.resolvePhoto(value),'blob:local');assert.equal(attempts,2);assert.ok(h.blobs.has('photo:'+value));
});
test('photo downloads limit concurrent signing and prioritize a newly visible image',async()=>{
 let active=0,peak=0;const waiters=[];const h=setup({sign:async path=>{active++;peak=Math.max(peak,active);await new Promise(r=>waiters.push(r));active--;return {data:{signedUrl:'https://example.test/photo'}}}});
 const jobs=Array.from({length:6},(_,i)=>h.ctx.resolvePhoto('storage://folder/dishes/'+i+'.jpg'));
 await new Promise(r=>setImmediate(r));assert.equal(peak,4);assert.equal(waiters.length,4);
 h.ctx.resolvePhoto('storage://folder/dishes/5.jpg',{priority:true});waiters.shift()();await new Promise(r=>setImmediate(r));
 assert.match(h.calls.filter(c=>c[0]==='sign')[4][1],/5\.jpg$/);
 while(waiters.length)waiters.shift()();await new Promise(r=>setImmediate(r));while(waiters.length)waiters.shift()();await Promise.all(jobs);assert.equal(peak,4);
});
test('repeated failures stop after three attempts and do not cache a bad image',async()=>{
 let attempts=0;const h=setup({setTimeout:(fn,ms)=>ms===12000?setTimeout(fn,ms):setTimeout(fn,0),sign:async()=>{attempts++;return {error:new Error('unavailable')}}});
 const value='storage://folder/dishes/fail.jpg';assert.equal(await h.ctx.resolvePhoto(value),'');assert.equal(attempts,3);assert.equal(h.blobs.has('photo:'+value),false);
});

test('a stalled request is aborted after its deadline',async()=>{
 const h=setup({setTimeout:(fn,ms)=>setTimeout(fn,0)});
 h.ctx.fetch=(_input,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))));
 await assert.rejects(h.ctx.photoTimedFetch('https://example.test/hang'),/aborted/);
});

test('a previously hidden image becomes visible when the memory cache is hit',()=>{
 const h=setup(),value='storage://folder/dishes/cached.jpg';
 let removed=false;
 const img={src:'',style:{visibility:'hidden'},getAttribute(name){return name==='src'?this.src:name==='data-photo-key'?encodeURIComponent(value):null},closest(){return {querySelector:()=>({remove:()=>{removed=true}})}}};
 h.ctx.imageUnderTest=img;h.ctx.cachedValue=value;
 vm.runInContext("photoUrls.set(cachedValue,'blob:cached')",h.ctx);
 h.ctx.watchPhotoElement(img);
 assert.equal(img.src,'blob:cached');assert.equal(img.style.visibility,'');assert.equal(removed,true);
});
test('an asynchronously resolved image is made visible and its retry control removed',()=>{
 const h=setup(),value='storage://folder/dishes/delayed.jpg';let removed=false;
 const img={src:'',style:{visibility:'hidden'},getAttribute(name){return name==='src'?this.src:name==='data-photo-key'?encodeURIComponent(value):null},closest(){return {querySelector:()=>({remove:()=>{removed=true}})}}};
 h.ctx.document.querySelectorAll=()=>[img];h.ctx.showPhotoResult(value,'blob:resolved');
 assert.equal(img.src,'blob:resolved');assert.equal(img.style.visibility,'');assert.equal(removed,true);
});
test('uncached photos have no placeholder source and stored paths round-trip safely',()=>{
 const h=setup(),value='storage://folder/dishes/a b.jpg';
 const attrs=h.ctx.photoImageAttributes(value,'');
 assert.match(attrs,/^data-photo-key=/);assert.doesNotMatch(attrs,/\ssrc=/);
 assert.equal(h.ctx.storedPhotoFromElement({getAttribute:name=>name==='data-photo-key'?encodeURIComponent(value):null}),value);
 assert.equal(h.ctx.storedPhotoFromElement({getAttribute:name=>name==='src'?'data:image/jpeg;base64,abc':null}),'');
});

test('background cache completion displays the photo even before an intersection callback',async()=>{
 const h=setup({setTimeout:(fn,ms)=>ms===12000?setTimeout(fn,ms):setTimeout(fn,0)});
 const value='storage://folder/dishes/background.jpg';h.blobs.set('photo:'+value,new Blob(['image']));
 const img={src:'',style:{visibility:'hidden'},getAttribute(name){return name==='src'?this.src:name==='data-photo-key'?encodeURIComponent(value):null},closest(){return null}};
 h.ctx.document.querySelectorAll=()=>[img];h.ctx.prefetchPhotos([value]);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(img.src,'blob:local');assert.equal(img.style.visibility,'');
});
