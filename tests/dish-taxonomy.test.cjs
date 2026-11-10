const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/data.js','utf8').split('let taxonomyReady = false;')[1];
function setup(cache, response){
 const stored=[];const categories=['全部'],cuisines=[];
 const ctx=vm.createContext({categories,cuisines,authUser:null,sharedMeal:{invite:''},state:{page:'dishes'},idbGet:async()=>cache,idbSet:async(k,v)=>stored.push([k,v]),sb:{from:()=>({select:()=>({order:()=>({order:async()=>response})})})},document:{},render:()=>{throw Error('unexpected render')}});
 vm.runInContext('let taxonomyReady = false;' + source,ctx);return {ctx,categories,cuisines,stored};
}
const rows=[{kind:'category',name:'家常菜'},{kind:'cuisine',name:'川菜'}];
test('loads the server vocabulary and saves an offline cache',async()=>{const h=setup(null,{data:rows,error:null});assert.equal(await h.ctx.loadDishTaxonomy(),true);assert.deepEqual(h.categories,['全部','家常菜']);assert.deepEqual(h.cuisines,['川菜']);assert.equal(h.stored.length,1)});
test('uses cached vocabulary when offline and fails closed without one',async()=>{const h=setup(rows,{error:Error('offline')});assert.equal(await h.ctx.loadDishTaxonomy(),true);assert.deepEqual(h.cuisines,['川菜']);const empty=setup(null,{error:Error('offline')});assert.equal(await empty.ctx.loadDishTaxonomy(),false)});
