const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.slice(source.indexOf('async function startApp()'),source.indexOf("\nif (document.documentElement.classList.contains('is-standalone'))"));
const code='a'.repeat(32), dish={id:'1',name:'菜',category:'家常菜',note:'',image:'a.jpg'};
function setup({result=Promise.reject(Error('network')),saved=code,current=code,cache=[dish]}={}){
 const calls=[];
 const ctx=vm.createContext({betaCode:current,savedBetaCode:saved,urlBetaCode:null,betaStorageKey:'beta',offlineMode:false,dishes:[],sb:{rpc:()=>result},sharedInviteFromUrl:()=>'',renderBetaEntry:o=>calls.push(['entry',o.message]),idbGet:async()=>cache,cacheKey:k=>k,isValidDish:d=>!!d&&typeof d.name==='string',normalizeDish:d=>d,removeCodeFromAddress:()=>{},restoreMenuDraft:()=>calls.push(['restore']),render:()=>calls.push(['render']),initDishes:async()=>calls.push(['sync']),localStorage:{setItem:()=>{}},setTimeout,clearTimeout});
 vm.runInContext(start,ctx);return {ctx,calls};
}
test('network failure opens the verified user’s cached dishes and draft',async()=>{const h=setup();await h.ctx.startApp();assert.equal(h.ctx.offlineMode,true);assert.equal(h.ctx.dishes[0].name,'菜');assert.deepEqual(h.calls.map(x=>x[0]),['restore','render']);});
test('a new code or missing cache cannot enter offline mode',async()=>{for(const options of [{saved:'b'.repeat(32)},{cache:null},{cache:[{}]}]){const h=setup(options);await h.ctx.startApp();assert.equal(h.ctx.offlineMode,false);assert.equal(h.calls[0][0],'entry');}});
test('explicitly invalid code is rejected even with a cache',async()=>{const h=setup({result:Promise.resolve({data:false,error:null})});await h.ctx.startApp();assert.equal(h.ctx.offlineMode,false);assert.match(h.calls[0][1],/不正确/);});
test('successful verification retains normal cloud startup',async()=>{const h=setup({result:Promise.resolve({data:true,error:null})});await h.ctx.startApp();assert.equal(h.ctx.offlineMode,false);assert.deepEqual(h.calls.map(x=>x[0]),['restore','render','sync']);});
