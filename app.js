function bindDetailSwipe(scroll, onBack){
 if(!scroll)return;
 const screen=scroll.parentElement;
 let start=null, dragging=false, settling=false;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 const reset=()=>{screen.classList.remove('detail-swipe-active','detail-swipe-settling');screen.style.removeProperty('--detail-swipe-x');settling=false};
 function settle(exit){
  settling=true;
  let timer;
  const ended=e=>{if(e.target===scroll && e.propertyName==='transform')finish()};
  const finish=()=>{if(!settling)return;clearTimeout(timer);scroll.removeEventListener('transitionend',ended);reset();if(exit && screen.contains(scroll))onBack()};
  if(reducedMotion.matches){finish();return}
  screen.classList.add('detail-swipe-settling');
  // Commit the dragged position before starting the settling transition.
  void scroll.offsetWidth;
  scroll.addEventListener('transitionend',ended);
  screen.style.setProperty('--detail-swipe-x',exit?`${screen.clientWidth}px`:'0px');
  timer=setTimeout(finish,300);
 }
 scroll.addEventListener('touchstart',e=>{if(settling)return;if(e.touches.length!==1){start=null;if(dragging){dragging=false;settle(false)}return}start={x:e.touches[0].clientX,y:e.touches[0].clientY};dragging=false},{passive:true});
 scroll.addEventListener('touchmove',e=>{
  if(!start)return;
  if(e.touches.length!==1){start=null;if(dragging){dragging=false;settle(false)}return}
  const dx=e.touches[0].clientX-start.x,dy=e.touches[0].clientY-start.y;
  if(!dragging && Math.max(Math.abs(dx),Math.abs(dy))>10){if(dx<=0 || dx<=Math.abs(dy)*1.5){start=null;return}dragging=true;screen.classList.add('detail-swipe-active')}
  if(dragging){if(e.cancelable)e.preventDefault();screen.style.setProperty('--detail-swipe-x',`${Math.max(0,Math.min(dx,screen.clientWidth))}px`)}
 },{passive:false});
 scroll.addEventListener('touchcancel',()=>{start=null;if(dragging){dragging=false;settle(false)}},{passive:true});
 scroll.addEventListener('touchend',e=>{
  if(!start || e.touches.length || e.changedTouches.length!==1){start=null;if(dragging){dragging=false;settle(false)}return}
  const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
  start=null;
  if(dragging){if(e.cancelable)e.preventDefault();dragging=false;settle(dx>=80 && dx>Math.abs(dy)*1.5)}
 },{passive:false});
}
let detailBackdrop = null;
function captureDetailBackdrop() {
 const scroll = app.querySelector('.screen-scroll');
 detailBackdrop = {node:app.cloneNode(true), top:scroll?.scrollTop || 0};
 detailBackdrop.node.removeAttribute('id');
 detailBackdrop.node.classList.add('detail-backdrop');
 detailBackdrop.node.setAttribute('aria-hidden','true');
 detailBackdrop.node.setAttribute('inert','');
}
function mountDetailBackdrop() {
 if (!detailBackdrop) return;
 const node=detailBackdrop.node.cloneNode(true);
 app.appendChild(node);
 const scroll=node.querySelector('.screen-scroll');if(scroll)scroll.scrollTop=detailBackdrop.top;
}
function bindDishButtons(){
 app.querySelectorAll('[data-detail-id]').forEach(b=>b.onclick=()=>{state.detailId=b.dataset.detailId;state.detailScroll=app.querySelector('.screen-scroll')?.scrollTop || 0;captureDetailBackdrop();state.page='dish-detail';render()});
 app.querySelectorAll('[data-dish]').forEach(b=>b.onclick=()=>{const id=b.dataset.dish;if(!dishes.some(d=>d.id===id && d.is_available))return;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];state.draftRestored=false;saveMenuDraft();const scroll=app.querySelector('.screen-scroll').scrollTop;render();app.querySelector('.screen-scroll').scrollTop=scroll});
}

function bind(){
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render();if(state.page==='history')loadHistory()});
 app.querySelectorAll('[data-manage-mode]').forEach(b=>b.onclick=()=>{state.manageFilterMode=b.dataset.manageMode;state.manageFilter='全部';render()});
 app.querySelectorAll('[data-manage-filter]').forEach(b=>b.onclick=()=>{state.manageFilter=b.dataset.manageFilter;render();app.querySelector('[data-manage-filter][aria-pressed=true]')?.focus({preventScroll:true})});
 app.querySelectorAll('[data-filter-mode]').forEach(b=>b.onclick=()=>{const scroll=app.querySelector('.screen-scroll').scrollTop;state.filterMode=b.dataset.filterMode;state.category='全部';render();app.querySelector('.screen-scroll').scrollTop=scroll});
 bindCatalog();
 bindDishButtons();
 const detailBack=app.querySelector('[data-detail-back]');if(detailBack){const back=(restoreFocus=false)=>{const id=state.detailId;state.page='dishes';render();const scroll=app.querySelector('.screen-scroll');if(scroll)scroll.scrollTop=state.detailScroll;updateCatalogNavigation();if(restoreFocus)app.querySelectorAll('[data-detail-id]').forEach(b=>{if(b.dataset.detailId===id)b.focus({preventScroll:true})})};detailBack.onclick=e=>back(e.detail===0);bindDetailSwipe(app.querySelector('.detail-scroll'),()=>back(false))}
 const detailToggle=app.querySelector('[data-detail-toggle]');if(detailToggle)detailToggle.onclick=()=>{const dish=dishes.find(d=>d.id===state.detailId);if(!dish || !dish.is_available){render();return}state.selected=state.selected.includes(dish.id)?state.selected.filter(id=>id!==dish.id):[...state.selected,dish.id];state.draftRestored=false;saveMenuDraft();const top=app.querySelector('.detail-scroll')?.scrollTop || 0;state.page='dishes';render();app.querySelector('.home-scroll').scrollTop=state.detailScroll;updateCatalogNavigation();captureDetailBackdrop();state.page='dish-detail';render();app.querySelector('.detail-scroll').scrollTop=top;app.querySelector('[data-detail-toggle]')?.focus({preventScroll:true})};
 app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.selected=state.selected.filter(x=>x!==b.dataset.remove);state.draftRestored=false;saveMenuDraft();render()});
 app.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;state.draftImage=null;state.page='dish-form';render()});
 app.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const dish=dishes.find(d=>d.id===b.dataset.delete);if(!dish || !window.confirm(`确定删除“${dish.name}”吗？`))return;b.disabled=true;if(!await cloudDeleteDish(dish.id)){b.disabled=false;return}saveLocalDishes(dishes.filter(d=>d.id!==dish.id));state.selected=state.selected.filter(id=>id!==dish.id);render();notify('菜品已删除');});
 const sharedCreate=app.querySelector('[data-action=shared-create]');if(sharedCreate)sharedCreate.onclick=()=>{state.page='shared-create';render()};
 const switchUser=app.querySelector('[data-action=switch-user]');if(switchUser)switchUser.onclick=()=>{state.page='beta-entry';renderBetaEntry({ canCancel: true });};
 const paperEntry=app.querySelector('[data-action=paper-mode]');if(paperEntry)paperEntry.onclick=openPaperMenu;
 const migratePhotos=app.querySelector('[data-action=migrate-photos]');if(migratePhotos)migratePhotos.onclick=async()=>{if(!confirm('请先确保所有设备都已更新到新版。迁移会将当前用户的旧照片转存到云端存储，是否继续？'))return;migratePhotos.disabled=true;migratePhotos.textContent='迁移中…';try{const result=await migrateLegacyPhotos();notify(`已迁移 ${result.moved} 张${result.failed?`，${result.failed} 张未完成，请重试`:''}`)}catch(_){notify('迁移失败，请检查网络和云端配置')}finally{if(migratePhotos.isConnected){migratePhotos.disabled=false;migratePhotos.textContent='迁移旧照片'}}};
 const addDish=app.querySelector('[data-action=new-dish]');if(addDish)addDish.onclick=()=>{state.editingId=null;state.draftImage=null;state.page='dish-form';render()};
 app.querySelectorAll('.cover-upload input').forEach(file=>file.onchange=()=>{const item=file.files?.[0];if(!item)return;if(!item.type.startsWith('image/')){notify('请选择图片文件');file.value='';return}const reader=new FileReader();reader.onerror=()=>notify('图片读取失败');reader.onload=()=>{const image=new Image();image.onerror=()=>notify('图片格式不支持');image.onload=()=>{const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);state.draftImage=canvas.toDataURL('image/jpeg',.82);app.querySelector('#cover-preview').src=state.draftImage};image.src=reader.result};reader.readAsDataURL(item)});
 const form=app.querySelector('#dish-form');if(form)form.onsubmit=async e=>{e.preventDefault();const name=form.elements.name.value.trim();if(!name){form.elements.name.focus();return}const existing=dishes.find(d=>d.id===state.editingId);const dish={id:existing?.id || `dish-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,category:form.elements.category.value,cuisine:form.elements.cuisine.value,note:form.elements.note.value.trim(),image:state.draftImage || existing?.image || 'tomato.jpg',spice_level:Number(form.elements.spice_level.value),is_available:form.elements.is_available.value==='true'};const saveButton=form.querySelector('[type=submit]');saveButton.disabled=true;if(state.draftImage){try{dish.image=await uploadPhoto(state.draftImage,'dishes')}catch(_){saveButton.disabled=false;notify('照片上传失败，请检查网络或存储配置');return}}if(!await cloudUpsertDish(dish)){saveButton.disabled=false;return}const latest=dishes.find(d=>d.id===dish.id);saveLocalDishes(latest?dishes.map(d=>d.id===dish.id?dish:d):[...dishes,dish]);state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加');};

 const search=app.querySelector('input[type=search]');if(search)search.oninput=e=>{state.query=e.target.value;const catalog=app.querySelector('.catalog-content');catalog.innerHTML=catalogContent(filteredDishes());bindDishButtons();updateCatalogNavigation()};
 const diary=app.querySelector('#diary-note');if(diary)diary.oninput=e=>{state.diaryNote=e.target.value;saveMenuDraft()};
 const refreshDiaryPhoto=()=>{if(state.page!=='menu')return;const scroll=app.querySelector('.screen-scroll')?.scrollTop||0;render();const scroller=app.querySelector('.screen-scroll');if(scroller)scroller.scrollTop=scroll};
 app.querySelectorAll('.diary-photo-upload input').forEach(input=>input.onchange=()=>{
  const file=input.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')){notify('请选择图片文件');input.value='';return}
  const version=++state.diaryPhotoVersion;state.diaryPhotoProcessing=true;refreshDiaryPhoto();
  const failed=()=>{if(version!==state.diaryPhotoVersion)return;state.diaryPhotoProcessing=false;refreshDiaryPhoto();notify('照片读取失败，请换一张重试')};
  const reader=new FileReader();reader.onerror=failed;reader.onload=()=>{const image=new Image();image.onerror=failed;image.onload=()=>{if(version!==state.diaryPhotoVersion)return;try{const scale=Math.min(1,1200/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('canvas unavailable');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);state.diaryPhoto=canvas.toDataURL('image/jpeg',.8);state.diaryPhotoProcessing=false;saveMenuDraft();refreshDiaryPhoto()}catch(_){failed()}};image.src=reader.result};reader.readAsDataURL(file);
 });
 const removeDiaryPhoto=app.querySelector('[data-action=remove-diary-photo]');if(removeDiaryPhoto)removeDiaryPhoto.onclick=()=>{state.diaryPhotoVersion++;state.diaryPhotoProcessing=false;state.diaryPhoto='';saveMenuDraft();refreshDiaryPhoto()};
 const saveDiary=app.querySelector('[data-action=save-diary]');if(saveDiary)saveDiary.onclick=saveHistory;
 const title=app.querySelector('.menu-title-input');if(title)title.oninput=e=>{state.title=e.target.value;saveMenuDraft()};
 const surprise=app.querySelector('[data-action=surprise]');if(surprise)surprise.onclick=drawSurprise;
 const addSurprise=app.querySelector('[data-action=add-surprise]');if(addSurprise)addSurprise.onclick=()=>{const dish=dishes.find(d=>d.id===state.surpriseId && d.is_available);if(!dish || state.selected.includes(dish.id))return;state.selected.push(dish.id);state.draftRestored=false;saveMenuDraft();render();notify('已加入菜单')};
 const motion=app.querySelector('[data-action=enable-motion]');if(motion)motion.onclick=enableMotion;
 const newMeal=app.querySelector('[data-action=new-meal]');if(newMeal)newMeal.onclick=()=>{if(!window.confirm('开始新一餐将清空当前已选菜品、标题、备注和照片。已保存的吃饭日记不会受影响。'))return;const cleared=clearMenuDraft();state.page='dishes';render();notify(cleared?'已开始新一餐':'本机无法清除草稿，请检查浏览器存储')};
 const dismissDraft=app.querySelector('[data-action=dismiss-draft]');if(dismissDraft)dismissDraft.onclick=()=>{state.draftRestored=false;state.draftUnavailable=0;render()};
 const clearDraft=app.querySelector('[data-action=clear-draft]');if(clearDraft)clearDraft.onclick=()=>{if(!window.confirm('清空上次未完成的菜单？'))return;clearMenuDraft();render()};
 function updatePlanControl(button, update) { const scroll=app.querySelector('.screen-scroll')?.scrollTop||0, focusLabel=button.getAttribute('aria-label'); update();state.planResult=null;render();const scroller=app.querySelector('.screen-scroll');if(scroller)scroller.scrollTop=scroll;const next=[...app.querySelectorAll('.plan-stepper button')].find(item=>item.getAttribute('aria-label')===focusLabel);if(next && !next.disabled)next.focus({preventScroll:true});else next?.parentElement.querySelector('button:not(:disabled)')?.focus({preventScroll:true}); }
 app.querySelectorAll('[data-plan-people-step]').forEach(button=>button.onclick=()=>updatePlanControl(button,()=>{state.planPeople=Math.max(1,Math.min(8,state.planPeople+Number(button.dataset.planPeopleStep)));state.planCounts=defaultPlanCounts(state.planPeople)}));
 app.querySelectorAll('[data-plan-step]').forEach(button=>button.onclick=()=>updatePlanControl(button,()=>{const category=button.dataset.planCategory;state.planCounts[category]=Math.max(0,Math.min(9,(state.planCounts[category]||0)+Number(button.dataset.planStep)))}));
 const generate=app.querySelector('[data-action=plan-generate]');if(generate)generate.onclick=()=>{if(!Object.values(state.planCounts).some(count=>count>0)){notify('请至少选择一道菜');return}state.planResult=makeMealPlan(dishes,state.planCounts);render();app.querySelector('.plan-results')?.scrollIntoView({block:'nearest',behavior:'smooth'})};
 app.querySelectorAll('[data-plan-replace]').forEach(button=>button.onclick=()=>{const id=button.dataset.planReplace,next=replacePlanDish(dishes,state.planResult.chosen,id);if(!next){notify('这个分类没有其他可替换的菜');return}state.planResult.chosen=state.planResult.chosen.map(x=>x===id?next:x);const scroll=app.querySelector('.screen-scroll')?.scrollTop||0;render();app.querySelector('.screen-scroll').scrollTop=scroll});
 const planApply=app.querySelector('[data-action=plan-apply]');if(planApply)planApply.onclick=()=>{const valid=state.planResult.chosen.filter(id=>dishes.some(d=>d.id===id&&d.is_available));if(!valid.length){notify('推荐菜品已不可用，请重新搭配');return}const added=valid.filter(id=>!state.selected.includes(id));state.selected=[...state.selected,...added];state.draftRestored=false;saveMenuDraft();state.page='menu';render();notify(added.length?`已加入 ${added.length} 道菜`:'这些菜都已在菜单中')};
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
 app.innerHTML = `<div class="beta-scroll"><div class="beta-top"><div class="beta-brand">${logo}<span>家宴<small>家的味道</small></span></div><button class="appearance-entry" type="button" data-action="appearance" aria-label="外观设置" title="外观设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 0 0 15Z" fill="currentColor" stroke="none"/></svg></button></div><div class="beta-intro"><span class="beta-kicker">A SEAT AT THE TABLE</span><h1>欢迎来到<br>家的餐桌</h1><p>输入你的专属内测码，<br>把每一餐的好味道留在这里。</p></div><form class="beta-form" novalidate><label for="beta-code">内测码</label><input id="beta-code" name="code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" placeholder="请输入 32 位内测码" aria-describedby="beta-help beta-error"><p id="beta-help">验证后会保存在本机，下次打开无需再输入。</p><p id="beta-error" class="beta-error" role="status" aria-live="polite">${escapeText(message)}</p><button class="beta-submit" type="submit">进入家宴</button>${canCancel ? '<button class="beta-cancel" type="button">返回当前菜单</button>' : ''}</form><div class="beta-foot"><span></span>好好吃饭，慢慢生活<span></span></div></div>`;
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
 if (!/^[a-f0-9]{32}$/.test(betaCode)) {
  renderBetaEntry({ message: betaCode ? '内测码格式不正确，请重新输入' : '', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) });
  return;
 }
 try {
  if (!sb) throw new Error('网络不可用');
  let timer;
  const { data, error } = await Promise.race([sb.rpc('validate_beta_code'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('验证超时')), 8000); })]).finally(() => clearTimeout(timer));
  if (error) throw error;
  if (!data) { renderBetaEntry({ message: '内测码不正确，请检查后重试', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) }); return; }
  try { localStorage.setItem(betaStorageKey, betaCode); } catch (_) { renderBetaEntry({ message: '本机无法保存内测码，请检查浏览器存储设置' }); return; }
  removeCodeFromAddress();
  restoreMenuDraft();
  render();
  await initDishes();
 } catch (_) {
  if (betaCode === savedBetaCode.trim().toLowerCase()) {
   try {
    const cached = await idbGet(cacheKey('dishes'));
    if (Array.isArray(cached) && cached.every(isValidDish)) {
     offlineMode = true;
     dishes = cached.map(normalizeDish);
     removeCodeFromAddress();
     restoreMenuDraft();
     render();
     return;
    }
   } catch (_) { /* No usable local cache. */ }
  }
  renderBetaEntry({ message: '验证失败，请检查网络后重试', canCancel: Boolean(urlBetaCode !== null && savedBetaCode) });
 }
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
