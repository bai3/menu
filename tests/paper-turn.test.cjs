const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/paper-menu.js','utf8');
const turn=source.slice(source.indexOf('function turnPaperPage('),source.indexOf('function closePaperMenu('));
function setup(reduced=false){
 const sheets=[],timers=new Map();let timer=0,renders=0;
 const leaf={cloneNode:()=>({}),insertAdjacentHTML(){},remove(){}};
 const book={classList:{add(){}},querySelector:()=>leaf,appendChild:node=>sheets.push(node)};
 const context=vm.createContext({paperPage:0,paperTurning:false,paperTurnTimer:null,paperQueuedDirection:0,paperCommittedPages:[],paperPhotoRatios:new Map(),paperPages:()=>Array.from({length:6},()=>[]),paperLeaf:()=>'<section></section>',flushPaperTap(){},renderPaperMenu:()=>renders++,matchMedia:()=>({matches:reduced}),document:{querySelector:()=>book,createElement:()=>({setAttribute(){},querySelector:()=>({appendChild(){}}),querySelectorAll:()=>[],addEventListener(name,fn){this.handler=fn},removeEventListener(){},innerHTML:''})},setTimeout:fn=>{timers.set(++timer,fn);return timer},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(turn,context);return {context,sheets,timers,get renders(){return renders}};
}
test('finishes on sheet animation end and processes one queued turn',()=>{const h=setup();h.context.turnPaperPage(1);h.context.turnPaperPage(1);assert.equal(h.sheets.length,1);h.sheets[0].handler({target:{}});assert.equal(h.context.paperPage,0);h.sheets[0].handler({target:h.sheets[0]});assert.equal(h.context.paperPage,1);assert.equal(h.sheets.length,2);h.sheets[1].handler({target:h.sheets[1]});assert.equal(h.context.paperPage,2);assert.equal(h.timers.size,0);});
test('fallback completes a turn and respects page boundaries',()=>{const h=setup();h.context.turnPaperPage(-1);assert.equal(h.sheets.length,0);h.context.turnPaperPage(1);[...h.timers.values()][0]();assert.equal(h.context.paperPage,1);assert.equal(h.context.paperTurning,false);});
test('reduced motion changes the page immediately',()=>{const h=setup(true);h.context.turnPaperPage(1);assert.equal(h.context.paperPage,1);assert.equal(h.renders,1);assert.equal(h.sheets.length,0);});
