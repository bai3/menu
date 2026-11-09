const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/paper-menu.js','utf8');
const pagination=source.slice(source.indexOf('function paperPages()'),source.indexOf('function paperLeaf('));

function pages(dishes,ratios={},mode='category') {
 const context=vm.createContext({paperDishes:()=>dishes,paperFilterMode:()=>mode,paperCommittedPages:[],paperLayoutRatios:new Map(Object.entries(ratios)),categories:['全部','家常菜','汤'],cuisines:['湘菜','未分类']});
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
 assert.deepEqual(pages(dishes,{a:1.5,b:.75,tall:.5,wide:2.5}).map(page=>page.map(d=>d.id)),[['a','b'],['tall'],['wide'],['unknown'],['c'],[]]);
});

test('newly measured photos can pair on unread pages without changing visited pages',()=>{
 const dishes=['a','b','c','d','e','f'].map(id=>({id,image:id,category:'家常菜',is_available:true}));
 const context=vm.createContext({paperDishes:()=>dishes,paperFilterMode:()=> 'category',paperCommittedPages:[['a'],['b']],paperLayoutRatios:new Map([['a',1],['b',1],['c',1],['d',1],['e',.5],['f',1]]),categories:['全部','家常菜'],cuisines:[]});
 vm.runInContext(pagination,context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.paperPages())).map(page=>page.map(d=>d.id)),[['a'],['b'],['c','d'],['e'],['f'],[]]);
});

test('turning forward adopts late measurements only beyond the current spread',()=>{
 const dishes=['a','b','c','d','e','f'].map(id=>({id,image:id,category:'家常菜',is_available:true}));
 const context=vm.createContext({paperDishes:()=>dishes,paperFilterMode:()=> 'category',paperCommittedPages:[],paperLayoutRatios:new Map(),paperPhotoRatios:new Map(dishes.map(d=>[d.image,1])),categories:['全部','家常菜'],cuisines:[],paperPage:0,paperTurning:false,paperQueuedDirection:0,document:{querySelector:()=>({})},flushPaperTap(){},renderPaperMenu(){},matchMedia:()=>({matches:true})});
 vm.runInContext(pagination,context);
 vm.runInContext(source.slice(source.indexOf('function turnPaperPage('),source.indexOf('function closePaperMenu(')),context);
 context.turnPaperPage(1);
 assert.equal(context.paperPage,1);
 assert.deepEqual(JSON.parse(JSON.stringify(context.paperPages())).map(page=>page.map(d=>d.id)),[['a'],['b'],['c','d'],['e','f']]);
 context.turnPaperPage(-1);
 context.turnPaperPage(1);
 assert.deepEqual(JSON.parse(JSON.stringify(context.paperPages())).map(page=>page.map(d=>d.id)),[['a'],['b'],['c','d'],['e','f']]);
});

test('never pairs across groups and completes cuisine and empty spreads',()=>{
 const dishes=[{id:'a',image:'a',cuisine:'未分类',is_available:true},{id:'b',image:'a',cuisine:'湘菜',is_available:true}];
 assert.deepEqual(pages(dishes,{a:1.5},'cuisine').map(page=>page.map(d=>d.id)),[['b'],['a']]);
 assert.deepEqual(pages([]),[[],[]]);
});
