function bindDetailSwipe(scroll, onBack){
 if(!scroll)return;
 let start=null;
 scroll.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
 scroll.addEventListener('touchmove',e=>{if(e.touches.length!==1)start=null},{passive:true});
 scroll.addEventListener('touchcancel',()=>{start=null},{passive:true});
 scroll.addEventListener('touchend',e=>{if(!start || e.touches.length || e.changedTouches.length!==1){start=null;return}const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(dx>=80 && dx>Math.abs(dy)*1.5)onBack()},{passive:true});
}
function bindDishButtons(){
 app.querySelectorAll('[data-detail-id]').forEach(b=>b.onclick=()=>{state.detailId=b.dataset.detailId;state.detailScroll=app.querySelector('.screen-scroll')?.scrollTop || 0;state.page='dish-detail';render()});
 app.querySelectorAll('[data-dish]').forEach(b=>b.onclick=()=>{const id=b.dataset.dish;if(!dishes.some(d=>d.id===id && d.is_available))return;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];const scroll=app.querySelector('.screen-scroll').scrollTop;render();app.querySelector('.screen-scroll').scrollTop=scroll});
}

function bind(){
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render();if(state.page==='history')loadHistory()});
 app.querySelectorAll('[data-manage-mode]').forEach(b=>b.onclick=()=>{state.manageFilterMode=b.dataset.manageMode;state.manageFilter='全部';render()});
 app.querySelectorAll('[data-manage-filter]').forEach(b=>b.onclick=()=>{state.manageFilter=b.dataset.manageFilter;render();app.querySelector('[data-manage-filter][aria-pressed=true]')?.focus({preventScroll:true})});
 app.querySelectorAll('[data-filter-mode]').forEach(b=>b.onclick=()=>{const scroll=app.querySelector('.screen-scroll').scrollTop;state.filterMode=b.dataset.filterMode;state.category='全部';render();app.querySelector('.screen-scroll').scrollTop=scroll});
 bindCatalog();
 bindDishButtons();
 const detailBack=app.querySelector('[data-detail-back]');if(detailBack){detailBack.onclick=()=>{const id=state.detailId;state.page='dishes';render();const scroll=app.querySelector('.screen-scroll');if(scroll)scroll.scrollTop=state.detailScroll;updateCatalogNavigation();app.querySelectorAll('[data-detail-id]').forEach(b=>{if(b.dataset.detailId===id)b.focus({preventScroll:true})})};bindDetailSwipe(app.querySelector('.detail-scroll'),detailBack.onclick)}
 const detailToggle=app.querySelector('[data-detail-toggle]');if(detailToggle)detailToggle.onclick=()=>{const dish=dishes.find(d=>d.id===state.detailId);if(!dish || !dish.is_available){render();return}state.selected=state.selected.includes(dish.id)?state.selected.filter(id=>id!==dish.id):[...state.selected,dish.id];const top=app.querySelector('.screen-scroll')?.scrollTop || 0;render();app.querySelector('.screen-scroll').scrollTop=top;app.querySelector('[data-detail-toggle]')?.focus({preventScroll:true})};
 app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.selected=state.selected.filter(x=>x!==b.dataset.remove);render()});
 app.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;state.draftImage=null;state.page='dish-form';render()});
 app.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const dish=dishes.find(d=>d.id===b.dataset.delete);if(!dish || !window.confirm(`确定删除“${dish.name}”吗？`))return;b.disabled=true;if(!await cloudDeleteDish(dish.id)){b.disabled=false;return}saveLocalDishes(dishes.filter(d=>d.id!==dish.id));state.selected=state.selected.filter(id=>id!==dish.id);render();notify('菜品已删除');});
 const sharedCreate=app.querySelector('[data-action=shared-create]');if(sharedCreate)sharedCreate.onclick=()=>{state.page='shared-create';render()};
 const switchUser=app.querySelector('[data-action=switch-user]');if(switchUser)switchUser.onclick=()=>{state.page='beta-entry';renderBetaEntry({ canCancel: true });};
 const paperEntry=app.querySelector('[data-action=paper-mode]');if(paperEntry)paperEntry.onclick=openPaperMenu;
 const addDish=app.querySelector('[data-action=new-dish]');if(addDish)addDish.onclick=()=>{state.editingId=null;state.draftImage=null;state.page='dish-form';render()};
 app.querySelectorAll('.cover-upload input').forEach(file=>file.onchange=()=>{const item=file.files?.[0];if(!item)return;if(!item.type.startsWith('image/')){notify('请选择图片文件');file.value='';return}const reader=new FileReader();reader.onerror=()=>notify('图片读取失败');reader.onload=()=>{const image=new Image();image.onerror=()=>notify('图片格式不支持');image.onload=()=>{const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);state.draftImage=canvas.toDataURL('image/jpeg',.82);app.querySelector('#cover-preview').src=state.draftImage};image.src=reader.result};reader.readAsDataURL(item)});
 const form=app.querySelector('#dish-form');if(form)form.onsubmit=async e=>{e.preventDefault();const name=form.elements.name.value.trim();if(!name){form.elements.name.focus();return}const existing=dishes.find(d=>d.id===state.editingId);const dish={id:existing?.id || `dish-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,category:form.elements.category.value,cuisine:form.elements.cuisine.value,note:form.elements.note.value.trim(),image:state.draftImage || existing?.image || 'tomato.jpg',spice_level:Number(form.elements.spice_level.value),is_available:form.elements.is_available.value==='true'};const saveButton=form.querySelector('[type=submit]');saveButton.disabled=true;if(!await cloudUpsertDish(dish)){saveButton.disabled=false;return}const latest=dishes.find(d=>d.id===dish.id);saveLocalDishes(latest?dishes.map(d=>d.id===dish.id?dish:d):[...dishes,dish]);state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加');};

 const search=app.querySelector('input[type=search]');if(search)search.oninput=e=>{state.query=e.target.value;const catalog=app.querySelector('.catalog-content');catalog.innerHTML=catalogContent(filteredDishes());bindDishButtons();updateCatalogNavigation()};
 const diary=app.querySelector('#diary-note');if(diary)diary.oninput=e=>{state.diaryNote=e.target.value};
 const saveDiary=app.querySelector('[data-action=save-diary]');if(saveDiary)saveDiary.onclick=saveHistory;
 const title=app.querySelector('.menu-title-input');if(title)title.oninput=e=>{state.title=e.target.value};
 const surprise=app.querySelector('[data-action=surprise]');if(surprise)surprise.onclick=drawSurprise;
 const addSurprise=app.querySelector('[data-action=add-surprise]');if(addSurprise)addSurprise.onclick=()=>{const dish=dishes.find(d=>d.id===state.surpriseId && d.is_available);if(!dish || state.selected.includes(dish.id))return;state.selected.push(dish.id);render();notify('已加入菜单')};
 const motion=app.querySelector('[data-action=enable-motion]');if(motion)motion.onclick=enableMotion;
 const make=app.querySelector('[data-action=make-menu]');if(make)make.onclick=()=>{state.page='menu';render()};
 const save=app.querySelector('[data-action=save]');if(save)save.onclick=saveMenuImage;
}
function removeCodeFromAddress() {
 const url = new URL(location.href);
 if (url.searchParams.has('code')) {
  url.searchParams.delete('code');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
 }
}
function renderBetaEntry({ message = '', canCancel = false } = {}) {
 app.className = 'phone-screen beta-screen';
 app.innerHTML = `<div class="beta-scroll"><div class="beta-brand">${logo}<span>家宴<small>家的味道</small></span></div><div class="beta-intro"><span class="beta-kicker">A SEAT AT THE TABLE</span><h1>欢迎来到<br>家的餐桌</h1><p>输入你的专属内测码，<br>把每一餐的好味道留在这里。</p></div><form class="beta-form" novalidate><label for="beta-code">内测码</label><input id="beta-code" name="code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" placeholder="请输入 32 位内测码" aria-describedby="beta-help beta-error"><p id="beta-help">验证后会保存在本机，下次打开无需再输入。</p><p id="beta-error" class="beta-error" role="status" aria-live="polite">${escapeText(message)}</p><button class="beta-submit" type="submit">进入家宴</button>${canCancel ? '<button class="beta-cancel" type="button">返回当前菜单</button>' : ''}</form><div class="beta-foot"><span></span>好好吃饭，慢慢生活<span></span></div></div>`;
 const form = app.querySelector('.beta-form');
 const errorEl = app.querySelector('#beta-error');
 form.onsubmit = async event => {
  event.preventDefault();
  const code = form.elements.code.value.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(code)) { errorEl.textContent = '请输入完整的 32 位内测码'; return; }
  const button = form.querySelector('.beta-submit');
  button.disabled = true;
  button.textContent = '正在验证…';
  errorEl.textContent = '';
  try {
   if (!window.JIAYAN_SUPABASE || !window.supabase) throw new Error('network');
   const client = window.supabase.createClient(window.JIAYAN_SUPABASE.url, window.JIAYAN_SUPABASE.publishableKey, { global: { headers: { 'x-beta-code': code } } });
   const { data, error } = await client.rpc('validate_beta_code');
   if (error) throw error;
   if (!data) { errorEl.textContent = '内测码不正确，请检查后重试'; return; }
   try { localStorage.setItem(betaStorageKey, code); } catch (_) { errorEl.textContent = '本机无法保存内测码，请检查浏览器存储设置'; return; }
   removeCodeFromAddress();
   location.reload();
  } catch (_) { errorEl.textContent = '验证失败，请检查网络后重试'; }
  finally { if (button.isConnected) { button.disabled = false; button.textContent = '进入家宴'; } }
 };
 const cancel = app.querySelector('.beta-cancel');
 if (cancel) cancel.onclick = () => {
  if (state.page === 'beta-entry') { state.page = 'manage'; render(); }
  else { removeCodeFromAddress(); location.reload(); }
 };
}
async function startApp() {
 const invite = sharedInviteFromUrl(); if (invite) { sharedStart(invite); return; }
 if (!/^[a-f0-9]{32}$/.test(betaCode) || !sb) {
  renderBetaEntry({ message: betaCode ? '内测码格式不正确，请重新输入' : '', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) });
  return;
 }
 try {
  const { data, error } = await sb.rpc('validate_beta_code');
  if (error) throw error;
  if (!data) { renderBetaEntry({ message: '内测码不正确，请检查后重试', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) }); return; }
  try { localStorage.setItem(betaStorageKey, betaCode); } catch (_) { renderBetaEntry({ message: '本机无法保存内测码，请检查浏览器存储设置' }); return; }
  removeCodeFromAddress();
  render();
  await initDishes();
 } catch (_) { renderBetaEntry({ message: '验证失败，请检查网络后重试', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) }); }
}
if (document.documentElement.classList.contains('is-standalone')) {
 setTimeout(() => document.getElementById('launch')?.classList.add('is-finished'), 900);
}
startApp();
if ('serviceWorker' in navigator) addEventListener('load', async () => {
 const localDev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
 if (!localDev) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  let updateNoticeShown = false;
  const showUpdateNotice = () => {
   if (updateNoticeShown) return;
   updateNoticeShown = true;
   const notice = document.createElement('div');
   notice.className = 'update-notice';
   notice.setAttribute('role', 'status');
   notice.innerHTML = '<span>发现新版本，刷新后即可使用</span><button type="button">立即刷新</button>';
   notice.querySelector('button').onclick = () => location.reload();
   document.body.appendChild(notice);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
   if (hadController) showUpdateNotice();
   hadController = true;
  });
  try {
   const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
   const checkForUpdate = () => { if (!document.hidden) registration.update().catch(() => {}); };
   checkForUpdate();
   document.addEventListener('visibilitychange', checkForUpdate);
   window.addEventListener('online', checkForUpdate);
  } catch (_) { /* 保持当前版本可用，稍后重新打开时再尝试更新。 */ }
  return;
 }
 try {
  // 旧版本可能仍在控制当前页面；注销后重新加载一次，解除控制。
  const registration = await navigator.serviceWorker.getRegistration('./');
  const controlled = Boolean(navigator.serviceWorker.controller);
  if (registration) await registration.unregister();
  if ('caches' in window) {
   const keys = await caches.keys();
   await Promise.all(keys.filter(key => key.startsWith('jiayan-')).map(key => caches.delete(key)));
  }
  if (controlled && registration) location.reload();
 } catch (_) { /* 开发环境清理失败时，不阻止页面使用。 */ }
});
