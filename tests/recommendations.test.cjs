const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const tools=fs.readFileSync('src/meal-tools.js','utf8');
const view=fs.readFileSync('src/views.js','utf8');
const rankSource=tools.slice(tools.indexOf('function rankMealDishes('));
function rank(catalog,meals){const c=vm.createContext({catalog,meals});vm.runInContext(rankSource,c);return Array.from(c.rankMealDishes(catalog,meals),x=>({id:x.dish.id,count:x.count}));}
test('ranks meal counts, counts each dish only once per meal and breaks ties by last edit',()=>{
 const catalog=[{id:'a',name:'A',is_available:true,edited_at:'2026-11-01'}, {id:'b',name:'B',is_available:true,edited_at:'2026-11-03'}, {id:'c',name:'C',is_available:true,created_at:'2026-11-02'}, {id:'d',name:'D',is_available:false}];
 const meals=[{dishes:[{id:'a'},{id:'a'},{id:'b'},{id:'d'}]}, {dishes:[{id:'a'},{id:'b'},{id:'d'}]}];
 assert.deepEqual(rank(catalog,meals),[{id:'b',count:2},{id:'a',count:2},{id:'c',count:0}]);
});
test('without meal records returns the ten most recently edited available dishes',()=>{
 const catalog=Array.from({length:12},(_,i)=>({id:String(i),name:String(i),is_available:true,edited_at:new Date(2026,0,i+1).toISOString()}));
 assert.deepEqual(rank(catalog,[]).map(x=>x.id),['11','10','9','8','7','6','5','4','3','2']);
});
test('reads every page and keeps cached data when the network fails',async()=>{
 const slice=view.slice(view.indexOf('let recommendationMeals ='),view.indexOf('\nfunction updateCatalogNavigation'));
 const ranges=[];let fail=false;
 const ctx=vm.createContext({state:{page:'menu'},app:{},offlineMode:false,cacheKey:k=>k,idbGet:async()=>[{id:'cached',dishes:[]}],idbSet:async()=>{},sb:{from:()=>({select:()=>({order(){return this},range(from,to){ranges.push([from,to]);return fail?Promise.resolve({error:Error('offline')}):Promise.resolve({data:from===0?Array.from({length:1000},(_,i)=>({id:String(i),dishes:[]})):[{id:'1000',dishes:[]}]})}})})}});
 vm.runInContext(slice,ctx);await ctx.loadRecommendations();assert.deepEqual(ranges,[[0,999],[1000,1999]]);assert.equal(vm.runInContext('recommendationMeals.length',ctx),1001);
 fail=true;await ctx.loadRecommendations();assert.equal(vm.runInContext('recommendationMeals.length',ctx),1001);assert.equal(vm.runInContext('recommendationError',ctx),true);
});
