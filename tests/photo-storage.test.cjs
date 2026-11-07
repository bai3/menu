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
  createSignedUrl:async(path)=>{calls.push(['sign',path]);return {data:{signedUrl:'https://example.test/photo'},error:null}}
 };
 const db={storage:{from:()=>bucket},from:table=>({select:()=>({order:()=>({range:async()=>({data:table==='dishes'?(options.rows||[]):[],error:null})})})}),rpc:async(name,args)=>{calls.push(['rpc',args]);return {data:options.updated!==false,error:null}}};
 const ctx=vm.createContext({Blob,URL:{createObjectURL:()=> 'blob:local'},TextEncoder,Uint8Array,crypto:webcrypto,betaCode:'test-code',offlineMode:false,sb:db,idbGet:async key=>blobs.get(key),idbSet:async(key,value)=>blobs.set(key,value),document:{querySelectorAll:()=>[]},fetch:async url=>url.startsWith('data:')?new Response(new Blob(['photo'],{type:'image/jpeg'})):new Response(new Blob([options.download||'photo'],{type:'image/jpeg'})),Response,syncFromCloud:async()=>{}});
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
