const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/views.js','utf8');
const saveSource=source.slice(source.indexOf('async function saveHistory()'),source.indexOf('\nfunction render(){'));
function setup(result){
 const button={disabled:false,textContent:'',isConnected:true};let cleared=0,renders=0;
 const messages=[];
 const ctx=vm.createContext({offlineMode:false,state:{selected:['a'],title:'午餐',diaryNote:'好吃'},betaCode:'test',crypto:{randomUUID:()=> 'id'},localDate:()=> '2026-11-07',uploadPhoto:async()=> 'storage://test/diary/photo.jpg',selectedDishes:()=>[{id:'a',name:'番茄'}],app:{querySelector:()=>button},sb:{from:()=>({insert:()=>({select:()=>({single:()=>result})})})},historyEntries:[],historyRequest:0,idbSet:async()=>{},cacheKey:key=>key,clearMenuDraft:()=>{cleared++;ctx.state.selected=[];ctx.state.title='今天的菜单';ctx.state.diaryNote='';return true},render:()=>{renders++},notify:message=>messages.push(message)});
 vm.runInContext(saveSource,ctx);
 return {ctx,button,messages,get cleared(){return cleared},get renders(){return renders}};
}
test('successful save finishes the unchanged meal',async()=>{
 const h=setup(Promise.resolve({data:{id:'id'},error:null}));await h.ctx.saveHistory();assert.equal(h.cleared,1);assert.equal(h.renders,1);assert.deepEqual(h.messages,['这餐已保存，可以开始新一餐']);
});
test('a failed save leaves the selected meal intact',async()=>{
 const h=setup(Promise.resolve({data:null,error:new Error('offline')}));await h.ctx.saveHistory();assert.equal(h.cleared,0);assert.deepEqual(Array.from(h.ctx.state.selected),['a']);assert.equal(h.button.disabled,false);
});
test('offline mode does not send a diary write or clear the draft',async()=>{
 const h=setup(Promise.resolve({data:{id:'id'},error:null}));h.ctx.offlineMode=true;h.ctx.sb.from=()=>{throw new Error('unexpected cloud request')};await h.ctx.saveHistory();assert.equal(h.cleared,0);assert.deepEqual(Array.from(h.ctx.state.selected),['a']);assert.match(h.messages[0],/保存失败/);
});
test('changes made while the save is pending are not cleared',async()=>{
 let finish;const pending=new Promise(resolve=>{finish=resolve});const h=setup(pending);const saving=h.ctx.saveHistory();h.ctx.state.selected.push('b');finish({data:{id:'id'},error:null});await saving;assert.equal(h.cleared,0);assert.deepEqual(Array.from(h.ctx.state.selected),['a','b']);assert.match(h.messages[0],/已保留/);
});
test('a photo is saved with the meal and a failed migration keeps the draft',async()=>{
 const h=setup(Promise.resolve({data:null,error:{code:'PGRST204'}}));let inserted;h.ctx.state.diaryPhoto='data:image/jpeg;base64,abc';h.ctx.sb.from=()=>({insert:entry=>{inserted=entry;return {select:()=>({single:()=>Promise.resolve({data:null,error:{code:'PGRST204'}})})}}});
 await h.ctx.saveHistory();assert.equal(inserted.photo,'storage://test/diary/photo.jpg');assert.equal(h.cleared,0);assert.match(h.messages[0],/更新云端数据库/);
});
test('a photo being changed while saving is preserved',async()=>{
 let finish;const h=setup(new Promise(resolve=>{finish=resolve}));h.ctx.state.diaryPhoto='data:image/jpeg;base64,old';h.ctx.state.diaryPhotoVersion=1;const saving=h.ctx.saveHistory();h.ctx.state.diaryPhotoVersion++;h.ctx.state.diaryPhotoProcessing=true;finish({data:{id:'id'},error:null});await saving;assert.equal(h.cleared,0);assert.match(h.messages[0],/已保留/);
});
