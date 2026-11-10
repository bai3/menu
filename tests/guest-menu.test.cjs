const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const auth = fs.readFileSync('src/auth.js', 'utf8');
const guestStart = auth.slice(auth.indexOf('async function startGuestMenu()'), auth.indexOf('async function startApp()'));
const shareUrl = auth.slice(auth.indexOf('function personalMenuUrl()'), auth.indexOf('async function copyPersonalMenu()'));
const photos = fs.readFileSync('src/photo-storage.js', 'utf8');
const photoClientSource = photos.slice(photos.indexOf("let photoClientKey="), photos.indexOf('function rememberPhoto('));
const id = '12345678-1234-1234-1234-123456789abc';
const dish = {id:'one', name:'番茄炒蛋', category:'家常菜', note:'好吃', image:'tomato.jpg'};

function setup(userId = id, result = {data:[dish],error:null}) {
 const calls = [], classes = [], retry = {};
 const app = {innerHTML:'',querySelector:()=>retry};
 const context = {guestUserId:userId, sb:{}, app, document:{body:{classList:{add:value=>classes.push(value)}},querySelector:()=>null},
  photoClient:()=>({rpc:async (name,args)=>{calls.push([name,args]);return result}}), authDeadline:x=>x,
  isValidDish:d=>!!d && typeof d.id==='string' && typeof d.name==='string' && typeof d.category==='string' && typeof d.note==='string' && typeof d.image==='string',
  normalizeDish:d=>({...d,is_available:true}), state:{}, render:()=>calls.push(['render']), prefetchPhotos:images=>calls.push(['photos',images])};
 vm.runInNewContext(guestStart, context);
 return {context,app,calls,classes,retry};
}

test('guest opens an anonymous read-only catalog without loading account state', async()=>{
 const h=setup();await h.context.startGuestMenu();
 assert.equal(h.calls[0][0], 'guest_menu_read');
 assert.equal(h.calls[0][1].p_user,id);
 assert.equal(h.context.state.page,'dishes');
 assert.equal(h.context.state.filterMode,'category');
 assert.equal(h.context.state.selected.length,0);
 assert.equal(h.calls[1][0],'render');assert.equal(h.calls[2][1][0],'tomato.jpg');
});

test('invalid links and failed reads show a retry instead of a login or stale catalog', async()=>{
 for(const h of [setup('bad-id'),setup(id,{data:null,error:null}),setup(id,{data:null,error:new Error('offline')})]) {
  await h.context.startGuestMenu();
  assert.match(h.app.innerHTML,/暂时无法打开菜单/);
  assert.equal(typeof h.retry.onclick,'function');
  assert.ok(!h.calls.some(call=>call[0]==='render'));
 }
});

test('share URL uses the signed-in user and removes prior query and fragment',()=>{
 const context={URL,location:{origin:'https://example.test',pathname:'/menu/'},authUser:{id}};
 vm.runInNewContext(shareUrl,context);
 assert.equal(context.personalMenuUrl(),`https://example.test/menu/?user=${id}`);
});

test('guest photo and menu client is independent of any saved account session',()=>{
 let options;
 const context={guestMode:true,guestUserId:id,window:{JIAYAN_SUPABASE:{url:'https://example.test',publishableKey:'public'},supabase:{createClient:(_,__,value)=>{options=value;return {guest:true}}}},sb:{},photoTimedFetch:()=>{}};
 vm.runInNewContext(photoClientSource,context);
 assert.equal(context.photoClient().guest,true);
 assert.equal(options.auth.persistSession,false);
 assert.equal(options.auth.autoRefreshToken,false);
 assert.equal(options.global.headers['x-guest-user'],id);
});
