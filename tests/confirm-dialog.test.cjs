const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
 let dialog, focused=0;
 const previous={isConnected:true,focus:()=>focused++};
 class Element {
  constructor(){this.listeners={};this.textContent='';this.open=false;this.removed=false}
  addEventListener(type,fn){this.listeners[type]=fn}
  fire(type,event={}){this.listeners[type]?.(event)}
  focus(){this.focused=true}
  setAttribute(){}
  showModal(){this.open=true}
  close(){this.open=false;this.fire('close')}
  remove(){this.removed=true}
 }
 const document={activeElement:previous,body:{appendChild(){}},createElement(){
  dialog=new Element();const children={};
  dialog.querySelector=selector=>children[selector] ||= new Element();
  return dialog;
 }};
 const context=vm.createContext({document});
 vm.runInContext(fs.readFileSync('src/confirm-dialog.js','utf8'),context);
 return {context,get dialog(){return dialog},get focused(){return focused}};
}
const options={title:'开始新一餐？',message:'当前草稿将被清空。',confirmLabel:'开始新一餐'};
test('cancel and escape resolve false, remove the dialog, and restore focus',async()=>{
 const h=setup();let result=h.context.confirmAction(options),dialog=h.dialog;
 assert.equal(dialog.querySelector('.confirm-dialog-cancel').focused,true);
 dialog.querySelector('.confirm-dialog-cancel').fire('click');
 assert.equal(await result,false);assert.equal(dialog.removed,true);assert.equal(h.focused,1);
 result=h.context.confirmAction(options);dialog=h.dialog;let prevented=false;
 dialog.fire('cancel',{preventDefault(){prevented=true}});
 assert.equal(await result,false);assert.equal(prevented,true);assert.equal(dialog.removed,true);
});
test('confirm returns true and a second request cannot trigger a duplicate action',async()=>{
 const h=setup();const first=h.context.confirmAction(options);const dialog=h.dialog;
 assert.equal(await h.context.confirmAction(options),false);
 assert.equal(dialog.querySelector('#confirm-dialog-title').textContent,options.title);
 assert.equal(dialog.querySelector('#confirm-dialog-message').textContent,options.message);
 dialog.querySelector('.confirm-dialog-confirm').fire('click');
 assert.equal(await first,true);assert.equal(dialog.removed,true);
});
