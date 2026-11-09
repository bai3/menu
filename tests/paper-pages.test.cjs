const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/paper-menu.js','utf8');
const pagination=source.slice(source.indexOf('function paperPages()'),source.indexOf('function paperLeaf('));

function pages(dishes,ratios={},mode='category') {
 const context=vm.createContext({paperDishes:()=>dishes,paperFilterMode:()=>mode,paperLayoutRatios:new Map(Object.entries(ratios)),categories:['全部','家常菜','汤'],cuisines:['湘菜','未分类']});
 vm.runInContext(pagination,context);
 return JSON.parse(JSON.stringify(context.paperPages()));
}

test('pairs ordinary photos in order, keeps long and unknown photos alone, and excludes unavailable dishes',()=>{
 const dishes=[
  {id:'a',image:'a',category:'家常菜',is_available:true},
  {id:'b',image:'b',category:'家常菜',is_available:true},
  {id:'tall',image:'tall',category:'家常菜',is_available:true},
  {id:'wide',image:'wide',category:'家常菜',is_available:true},
  {id:'unknown',image:'unknown',category:'家常菜',is_available:true},
  {id:'hidden',image:'a',category:'家常菜',is_available:false},
  {id:'c',image:'a',category:'自定义',is_available:true}
 ];
 assert.deepEqual(pages(dishes,{a:1.5,b:1,tall:.75,wide:2}).map(page=>page.map(d=>d.id)),[['a','b'],['tall'],['wide'],['unknown'],['c'],[]]);
});

test('never pairs across groups and completes cuisine and empty spreads',()=>{
 const dishes=[{id:'a',image:'a',cuisine:'未分类',is_available:true},{id:'b',image:'a',cuisine:'湘菜',is_available:true}];
 assert.deepEqual(pages(dishes,{a:1.5},'cuisine').map(page=>page.map(d=>d.id)),[['b'],['a']]);
 assert.deepEqual(pages([]),[[],[]]);
});
