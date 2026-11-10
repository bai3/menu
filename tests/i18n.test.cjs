const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/i18n.js','utf8');
function setup(initial={}) {
 const store={...initial}, documentEvents={}, windowEvents={}; let observer;
 const text=(value,parent)=>({nodeType:3,nodeValue:value,parentElement:parent});
 function element(tag='DIV',attrs={},protectedContent=false){return {nodeType:1,tagName:tag,childNodes:[],attrs:{...attrs},closest:()=>protectedContent?{}:null,hasAttribute(name){return Object.hasOwn(this.attrs,name)},getAttribute(name){return this.attrs[name]},setAttribute(name,value){this.attrs[name]=value},get textContent(){return this.childNodes.map(n=>n.nodeValue||'').join('')}}}
 const body=element(), label=element('BUTTON',{placeholder:'请输入邮箱'}), user=element('SPAN',{},true), option=element('OPTION');
 label.childNodes.push(text('登录',label)); user.childNodes.push(text('登录',user)); option.childNodes.push(text('主食材',option)); body.childNodes.push(label,user,option);
 const document={body,documentElement:{},title:'',addEventListener:(name,fn)=>documentEvents[name]=fn};
 const window={addEventListener:(name,fn)=>windowEvents[name]=fn,dispatchEvent:()=>{}};
 const localStorage={getItem:key=>store[key]??null,setItem:(key,value)=>store[key]=value};
 const context={document,window,localStorage,CustomEvent:class{},MutationObserver:class{constructor(fn){observer=fn}observe(){}},Object};
 vm.runInNewContext(source,context);documentEvents.DOMContentLoaded();
 return {window,document,store,label,user,option,mutate:records=>observer(records),text,element};
}
test('language switching translates UI, preserves user content and option values, and restores Chinese',()=>{
 const h=setup();h.window.JiayanI18n.setLanguage('en');
 assert.equal(h.label.childNodes[0].nodeValue,'Sign in');assert.equal(h.label.attrs.placeholder,'Enter your email');
 assert.equal(h.user.childNodes[0].nodeValue,'登录');assert.equal(h.option.childNodes[0].nodeValue,'Ingredients');assert.equal(h.option.attrs.value,'主食材');
 assert.equal(h.document.documentElement.lang,'en');assert.equal(h.store['jiayan.language.v1'],'en');
 h.window.JiayanI18n.setLanguage('ja');assert.equal(h.label.childNodes[0].nodeValue,'ログイン');
 h.window.JiayanI18n.setLanguage('zh-CN');assert.equal(h.label.childNodes[0].nodeValue,'登录');assert.equal(h.option.childNodes[0].nodeValue,'主食材');
});
test('saved language and dynamically inserted text are translated',()=>{
 const h=setup({'jiayan.language.v1':'ja'});assert.equal(h.label.childNodes[0].nodeValue,'ログイン');
 const added=h.element('BUTTON');added.childNodes.push(h.text('保存菜品',added));h.mutate([{type:'childList',addedNodes:[added]}]);
 assert.equal(added.childNodes[0].nodeValue,'料理を保存');
});
test('unsupported languages cannot replace the saved preference',()=>{
 const h=setup({'jiayan.language.v1':'en'});assert.equal(h.window.JiayanI18n.setLanguage('fr'),false);assert.equal(h.store['jiayan.language.v1'],'en');
});
