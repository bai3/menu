const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/meal-tools.js','utf8');
function setup(initial={}, user='user-a'){
 const store=new Map(Object.entries(initial));
 const context=vm.createContext({authUser:{id:user},state:{selected:[],title:'今天的菜单',diaryNote:'',draftRestored:false},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},notify:()=>{}});
 vm.runInContext(source,context);
 return {store,context,run:code=>vm.runInContext(code,context)};
}
test('drafts restore selected dishes, title and note only for the same user',()=>{
 const a=setup(); a.run(`state.selected=['a','b'];state.title='周末聚餐';state.diaryNote='好吃';saveMenuDraft()`);
 const b=setup(Object.fromEntries(a.store),'user-b'); b.run('restoreMenuDraft()'); assert.deepEqual(Array.from(b.context.state.selected),[]);
 const again=setup(Object.fromEntries(a.store)); again.run('restoreMenuDraft()'); assert.deepEqual(Array.from(again.context.state.selected),['a','b']); assert.equal(again.context.state.title,'周末聚餐');assert.equal(again.context.state.diaryNote,'好吃');
 again.run('clearMenuDraft()');assert.equal(again.store.size,0);
});
test('default draft titles follow the selected language without changing custom or older titles',()=>{
 const a=setup();a.context.defaultMenuTitle=()=>"Today’s menu";
 a.run("state.selected=['a'];state.title='今天的菜单';state.titleIsDefault=true;saveMenuDraft()");
 const b=setup(Object.fromEntries(a.store));b.context.defaultMenuTitle=()=>"Today’s menu";b.run('restoreMenuDraft()');
 assert.equal(b.context.state.title,'Today’s menu');assert.equal(b.context.state.titleIsDefault,true);
 const c=setup({'jiayan.menu-draft.v1:auth:user-a':JSON.stringify({selected:['a'],title:'家宴',diaryNote:''})});c.context.defaultMenuTitle=()=>"Today’s menu";c.run('restoreMenuDraft()');
 assert.equal(c.context.state.title,'家宴');assert.equal(c.context.state.titleIsDefault,false);
});
test('invalid drafts and unavailable storage do not prevent startup',()=>{
 const a=setup({'jiayan.menu-draft.v1:auth:user-a':'not-json'}); assert.doesNotThrow(()=>a.run('restoreMenuDraft()'));
 const b=setup(); b.context.localStorage.getItem=()=>{throw Error('denied')}; b.context.localStorage.setItem=()=>{throw Error('denied')}; assert.doesNotThrow(()=>b.run("restoreMenuDraft();state.selected=['a'];saveMenuDraft()"));
});
test('a table plan respects categories, availability, shortages and avoids duplicates',()=>{
 const a=setup();a.context.catalog=[{id:'a',category:'家常菜',is_available:true},{id:'b',category:'家常菜',is_available:false},{id:'s',category:'暖心汤羹',is_available:true},{id:'m',category:'主食',is_available:true}];
 const plan=a.run("makeMealPlan(catalog,{'家常菜':2,'暖心汤羹':1,'主食':1},()=>0)");
 assert.deepEqual(Array.from(plan.chosen),['a','s','m']);assert.equal(plan.shortages.length,1);assert.equal(plan.shortages[0].category,'家常菜');assert.equal(plan.shortages[0].requested,2);assert.equal(plan.shortages[0].available,1);
});
test('replacement stays in category, excludes existing results and reports no alternative',()=>{
 const a=setup();a.context.catalog=[{id:'a',category:'家常菜',is_available:true},{id:'b',category:'家常菜',is_available:true},{id:'c',category:'暖心汤羹',is_available:true}];
 assert.equal(a.run("replacePlanDish(catalog,['a','c'],'a',()=>0)"),'b');assert.equal(a.run("replacePlanDish(catalog,['a','b','c'],'a',()=>0)"),null);
});

test('available extra categories can be configured without repeating duplicate IDs',()=>{
 const a=setup();a.context.catalog=[{id:'x',category:'烧烤',is_available:true},{id:'x',category:'烧烤',is_available:true},{id:'y',category:'烧烤',is_available:true}];
 assert.ok(Array.from(a.run('planCategoryOptions(catalog)')).includes('烧烤'));
 const plan=a.run("makeMealPlan(catalog,{'烧烤':3},()=>0)");assert.equal(plan.chosen.length,2);assert.equal(new Set(plan.chosen).size,2);assert.equal(plan.shortages[0].available,2);
});
test('a meal photo is restored with its draft and removed when clearing',()=>{
 const a=setup();a.run("state.selected=['a'];state.diaryPhoto='data:image/jpeg;base64,abc';saveMenuDraft()");const again=setup(Object.fromEntries(a.store));again.run('restoreMenuDraft()');assert.equal(again.context.state.diaryPhoto,'data:image/jpeg;base64,abc');again.run('clearMenuDraft()');assert.equal(again.context.state.diaryPhoto,'');assert.equal(again.store.size,0);
});
