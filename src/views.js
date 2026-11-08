const categories = ['全部', '家常菜', '清爽凉菜', '暖心汤羹', '主食', '饮品', '甜点', '小吃', '火锅', '烧烤', '其他'];
const cuisines = ['未分类', '川菜', '鲁菜', '粤菜', '苏菜', '浙菜', '闽菜', '湘菜', '徽菜', '东北菜', '西北菜', '京菜', '日料', '韩料', '泰餐', '越南菜', '印度菜', '法餐', '意餐', '美式料理', '其他'];
const state = { draftRestored: false, planPeople: 2, planCounts: {'家常菜':2,'清爽凉菜':0,'暖心汤羹':1,'主食':0}, planResult: null, detailId: null, detailScroll: 0, diaryNote: '', diaryPhoto: '', diaryPhotoVersion: 0, diaryPhotoProcessing: false, diarySaving: false, page: 'dishes', category: '全部', filterMode: 'category', manageFilterMode: 'category', manageFilter: '全部', query: '', selected: [], title: '今天的菜单', editingId: null, draftImage: null, surpriseId: null };
const app = document.querySelector('#app');
const icon = (name) => {
 const paths = {
  people:'<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1M16 6a3 3 0 0 1 0 5.5M16.5 13.5a5 5 0 0 1 4 4.9v.6"/>',
  plus:'<path d="M12 5.5v13M5.5 12h13"/>',
  check:'<path d="m5.5 12 4.2 4.2L18.5 7.5"/>',
  edit:'<path d="M12 20h8M4 20l3.6-.8L19 7.8 16.2 5 4.8 16.4 4 20Z"/>',
  close:'<path d="m6.5 6.5 11 11m0-11-11 11"/>',
  home:'<path d="M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.2"/><path d="m15 15 4.5 4.5"/>',
  order:'<circle cx="12" cy="12" r="5.5"/><path d="M2.5 5.5v3a1.8 1.8 0 0 0 3.6 0v-3M4.3 5.5v13M20.5 5.5c-1.6 1.5-2.2 3.7-2.2 6h2.2v7"/>',
  basket:'<path d="M4 10h16l-1.5 8.5a1 1 0 0 1-1 .8h-11a1 1 0 0 1-1-.8L4 10ZM8.5 10 12 4.5l3.5 5.5M9 13.5v2.5m3-2.5v2.5m3-2.5v2.5"/>',
  cheers:'<path d="M3 5.5 9.5 3l2.2 6a3.5 3.5 0 0 1-6.6 2.4L3 5.5ZM13.8 9l1.8-5 6.2 2.3-1.8 5a3.3 3.3 0 0 1-6.2-2.3ZM8.5 13.6l1.8 5M7.8 20l5-1.8M16.1 13.2l-1.7 4.7M12.1 17.1l4.5 1.6M11 2l.4-1.5M13 4l1.4-1"/>',
  surprise:'<path d="M4.5 12h15c-.4 4.1-3.2 7-7.5 7s-7.1-2.9-7.5-7ZM9 21h6M8.5 9c-1-1.6 1.5-2.1.5-4m5 4c-1-1.6 1.5-2.1.5-4"/>',
  menu:'<rect x="5.5" y="3.5" width="13" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  back:'<path d="m14 6-6 6 6 6"/>',
  forward:'<path d="m10 6 6 6-6 6"/>',
  camera:'<path d="M5 8h2.5l1.6-2.5h5.8L16.5 8H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 8Z"/><circle cx="12" cy="13.5" r="3"/>',
  image:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.3"/><path d="m5 18 4.6-4.6a1 1 0 0 1 1.4 0l2 2 1.4-1.4a1 1 0 0 1 1.4 0L20 18"/>',
  appearance:'<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5v15a7.5 7.5 0 0 0 0-15Z" fill="currentColor" stroke="none"/>',
  all:'<path d="M4 10h16l-2 9H6l-2-9Z"/><path d="m8 10 4-6 4 6M9 14v2m3-2v2m3-2v2"/>',
  hot:'<path d="M4 13h16c-.5 4-3.5 7-8 7s-7.5-3-8-7ZM7 10c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4"/>',
  cold:'<path d="M12 20c4-3 6-7 5-12-5 0-9 2-10 7-1 3 1 5 5 5ZM8 18l6-6M12 15l-3-1"/>',
  soup:'<path d="M4 13h16c-.5 4-3.5 7-8 7s-7.5-3-8-7ZM8 9c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4"/>'
 };
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || ''}</svg>`;
};
const paperMenuIcon = `<svg class="paper-menu-icon" viewBox="0 0 24 27" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m5.5 21-2-16 12-1.5" opacity=".65"/><rect x="7" y="3" width="13" height="19" rx="1.5" fill="var(--theme-surface)"/><path d="M10 8h7M10 12h7M10 16h5"/></svg>`;
const logo = `<span class="brand-mark" aria-label="家宴标志"><svg viewBox="0 0 40 40" aria-hidden="true"><path class="brand-bowl" d="M9.8 18.7h20.4q.9 0 .7.9c-1 5.2-4.9 8-10.9 8s-9.9-2.8-10.9-8q-.2-.9.7-.9Z"/><path class="brand-foot" d="M16.8 29h6.4"/><path class="brand-smile" d="M15.8 24.6q4.2 2 8.4 0"/><path class="brand-chopsticks" d="m14.9 17 9.4-8m-6.6 8 9.4-8"/></svg></span>`;
const categoryIcon = {'全部':'all','家常菜':'hot','清爽凉菜':'cold','暖心汤羹':'soup'};
const spiceLabels = ['不辣', '微辣', '中辣', '特辣'];
const spiceBadge = d => d.spice_level ? `<span class="spice-badge" role="img" aria-label="${spiceLabels[d.spice_level]}" title="${spiceLabels[d.spice_level]}">${'<span aria-hidden="true">🌶</span>'.repeat(d.spice_level)}</span>` : '';
const escapeText = (str) => String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
function nav(){return `<nav class="nav" aria-label="页面导航"><button data-page="dishes" class="${state.page==='dishes'?'active':''}" ${state.page==='dishes'?'aria-current="page"':''}>${icon('order')}<span>点菜</span></button><button data-page="surprise" class="${state.page==='surprise'||state.page==='meal-plan'?'active':''}" ${state.page==='surprise'||state.page==='meal-plan'?'aria-current="page"':''}>${icon('surprise')}<span>吃点随便</span></button><button data-page="menu" class="${state.page==='menu'?'active':''}" ${state.page==='menu'?'aria-current="page"':''}>${icon('menu')}<span>菜单</span></button></nav>`}
function selectedDishes(){return state.selected.map(id=>dishes.find(d=>d.id===id)).filter(Boolean)}
function filteredDishes() {
 return dishes.filter(d => `${d.name}${d.category}${d.cuisine}${d.note}`.includes(state.query.trim()));
}
let recommendationMeals = [];
let recommendationLoading = false;
let recommendationError = false;
let recommendationHasData = false;
let recommendationRequest = 0;
function dishCard(d, count=null) {
 return `<article class="dish ${d.is_available?'':'dish-unavailable'}"><button class="dish-open" data-detail-id="${escapeText(d.id)}" aria-label="查看${escapeText(d.name)}详情"><img class="dish-img" src="${escapeText(dishImage(d))}" alt="" onerror="this.style.visibility='hidden'"><span class="dish-info"><span class="dish-name">${escapeText(d.name)} ${spiceBadge(d)}</span>${d.note ? `<span class="dish-note">${escapeText(d.note)}</span>` : ''}${count!==null ? `<span class="recommend-count">做过 ${count} 次</span>` : ''}${state.filterMode === 'cuisine' ? `<span class="dish-tag">${escapeText(d.category)}</span>` : d.cuisine !== '未分类' ? `<span class="dish-tag">${escapeText(d.cuisine)}</span>` : ''}${d.is_available?'':'<span class="unavailable-label">已下架</span>'}<span class="dish-detail-cue">查看详情</span></span></button><button class="add ${state.selected.includes(d.id)?'selected':''}" data-dish="${escapeText(d.id)}" aria-label="${state.selected.includes(d.id)?'移除':'选择'}${escapeText(d.name)}" aria-pressed="${state.selected.includes(d.id)}" ${d.is_available?'':'disabled'}>${icon(state.selected.includes(d.id)?'check':'plus')}</button></article>`;
}
function catalogContent(filtered){
 if(state.filterMode==='recommend') {
  const ranked=rankMealDishes(dishes,recommendationMeals);
  const visible=new Set(filtered.map(d=>d.id));
  const list=ranked.filter(item=>visible.has(item.dish.id));
  if(!recommendationHasData && recommendationLoading)return '<div class="empty">正在整理推荐…</div>';
  if(!recommendationHasData && recommendationError)return '<div class="empty">暂时无法读取吃饭日记<br>联网后再试试</div>';
  if(!ranked.length)return '<div class="empty">暂无可推荐的菜<br>添加菜品后再来看看吧</div>';
  if(!list.length)return '<div class="empty">推荐菜里没有找到<br>换个关键词试试吧</div>';
  return `<div class="catalog-heading"><h3>推荐菜</h3><span>${recommendationError ? '本机记录 · ' : ''}按次数与编辑时间排序</span></div><div class="dish-list">${list.map(item=>dishCard(item.dish,item.count)).join('')}</div>`;
 }
 const field = state.filterMode === 'category' ? 'category' : 'cuisine';
 const options = state.filterMode === 'category' ? categories.slice(1) : cuisines;
 const present = [...new Set(filtered.map(d => d[field]))];
 const groups = [...options.filter(value => present.includes(value)), ...present.filter(value => !options.includes(value))];
 if (!groups.length) return '<div class="empty">没有找到这道菜<br>换个关键词试试吧</div>';
 return groups.map(value => {
  const group = filtered.filter(d => d[field] === value);
  return `<section class="catalog-group" data-group="${escapeText(value)}"><div class="catalog-heading"><h3>${escapeText(value)}</h3><span>${group.length} 道菜</span></div><div class="dish-list">${group.map(d=>dishCard(d)).join('')}</div></section>`;
 }).join('');
}
function refreshRecommendationView() {
 if(state.page!=='dishes' || state.filterMode!=='recommend')return;
 const content=app.querySelector('.catalog-content');if(!content)return;
 content.innerHTML=catalogContent(filteredDishes());bindDishButtons();
}
async function loadRecommendations() {
 const request=++recommendationRequest;recommendationLoading=true;recommendationError=false;refreshRecommendationView();
 try {
  const cached=recommendationHasData ? null : await idbGet(cacheKey('recommendation_meals'));
  if(request!==recommendationRequest)return;
  if(Array.isArray(cached)){recommendationMeals=cached;recommendationHasData=true;refreshRecommendationView()}
 } catch (_) {}
 try {
  if(offlineMode || !sb)throw new Error('云端不可用');
  const meals=[];const pageSize=1000;
  for(let from=0;;from+=pageSize){
   const {data,error}=await sb.from('meal_history').select('id,dishes').order('created_at',{ascending:false}).order('id',{ascending:false}).range(from,from+pageSize-1);
   if(error)throw error;
   if(request!==recommendationRequest)return;
   meals.push(...data);if(data.length<pageSize)break;
  }
  if(request!==recommendationRequest)return;
  recommendationMeals=meals;recommendationHasData=true;
  idbSet(cacheKey('recommendation_meals'),meals).catch(()=>{});
 } catch (_) {if(request===recommendationRequest)recommendationError=true}
 finally {if(request===recommendationRequest){recommendationLoading=false;refreshRecommendationView()}}
}

function updateCatalogNavigation(shared = false, preferredCategory = null) {
 const scroll = app.querySelector('.screen-scroll'), nav = app.querySelector('.filters');
 if (!scroll || !nav) return;
 const groups = [...app.querySelectorAll('.catalog-group')];
 const selector = shared ? '[data-shared-category]' : '[data-category]';
 const categoryOf = button => shared ? button.dataset.sharedCategory : button.dataset.category;
 const names = new Set(groups.map(group => group.dataset.group));
 nav.querySelectorAll(selector).forEach(button => { button.hidden = categoryOf(button) !== '全部' && !names.has(categoryOf(button)); });
 const top = scroll.getBoundingClientRect().top + 8;
 let active = '全部';
 for (const group of groups) if (group.getBoundingClientRect().top <= top) active = group.dataset.group;
 // At the end of the home list the last group may not reach the top edge.
 if (!shared && groups.length && scroll.scrollHeight > scroll.clientHeight + 1 && scroll.scrollTop > 0 && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2) active = groups[groups.length - 1].dataset.group;
 if (preferredCategory !== null && (preferredCategory === '全部' || names.has(preferredCategory))) active = preferredCategory;
 if (shared) sharedMeal.category = active; else state.category = active;
 nav.querySelectorAll(selector).forEach(button => {
  const selected = categoryOf(button) === active;
  button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
  if (selected && (button.offsetTop < nav.scrollTop || button.offsetTop + button.offsetHeight > nav.scrollTop + nav.clientHeight)) nav.scrollTop = button.offsetTop - nav.clientHeight / 2 + button.offsetHeight / 2;
 });
}
function bindCatalog(shared = false) {
 const scroll = app.querySelector('.screen-scroll');
 if (!scroll || !app.querySelector('.catalog')) return;
 let pendingScroll = null;
 scroll.addEventListener('scroll', () => {
  const preferred = pendingScroll && Math.abs(scroll.scrollTop - pendingScroll.top) <= 1 ? pendingScroll.category : null;
  pendingScroll = null;
  updateCatalogNavigation(shared, preferred);
 }, {passive:true});
 const selector = shared ? '[data-shared-category]' : '[data-category]';
 app.querySelectorAll(selector).forEach(button => button.onclick = () => {
  const category = shared ? button.dataset.sharedCategory : button.dataset.category;
  const target = category === '全部' ? app.querySelector('.catalog') : [...app.querySelectorAll('.catalog-group')].find(group => group.dataset.group === category);
  if (target) {
   const top = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top));
   pendingScroll = Math.abs(scroll.scrollTop - top) > 1 ? {top, category} : null;
   scroll.scrollTo({top, behavior: 'auto'});
   updateCatalogNavigation(shared, category);
  }
 });
 updateCatalogNavigation(shared);
}
function renderDishes(){
 const field = state.filterMode === 'category' ? 'category' : 'cuisine';
 const options = state.filterMode === 'category' ? categories.slice(1) : cuisines;
 const present = new Set(dishes.map(d => d[field]));
 const filters = ['全部', ...options.filter(value => present.has(value)), ...[...present].filter(value => value && !options.includes(value))];
 const filtered = filteredDishes();
 app.className='phone-screen home-screen';
 app.innerHTML=`<div class="screen-scroll home-scroll">${''}<header class="topbar"><div class="top-brand">${logo}<div><strong>家宴</strong><small>把喜欢的菜端上桌</small></div></div><div class="home-top-actions"><button class="shared-entry" data-action="shared-create">${icon('people')}<span>邀请一起点</span></button><button class="appearance-entry" type="button" data-action="appearance" aria-label="外观设置" title="外观设置">${icon('appearance')}</button></div></header>
 <section class="home-welcome"><p class="home-welcome-kicker">为每一顿家常饭</p><h1>把喜欢的菜，<em>端上家的餐桌。</em></h1><p class="home-welcome-note">今天，一起好好吃饭。</p></section>
 ${state.draftRestored || state.draftUnavailable ? `<div class="draft-resume"><div class="draft-resume-copy" role="status"><strong>${state.draftRestored && state.selected.length ? '已保留上次点的菜' : '菜单已更新'}</strong><span>${state.selected.length ? `已选 ${state.selected.length} 道菜，可以继续点菜` : '暂无已选菜品'}${state.draftUnavailable ? ` · ${state.draftUnavailable} 道菜已下架或删除` : ''}</span></div><div class="draft-resume-actions">${state.selected.length ? '<button type="button" data-page="menu">查看菜单</button><button type="button" data-action="clear-draft">清空</button>' : '<button type="button" data-action="dismiss-draft">知道了</button>'}</div></div>` : ''}
 <div class="section-title"><h2>今天吃什么？</h2><div class="home-actions"><button class="paper-entry" data-action="paper-mode">${paperMenuIcon}纸质菜单</button><button class="manage-entry" data-page="manage">编辑菜单</button></div></div>
 <div class="home-discovery"><label class="search">${icon('search')}<input type="search" placeholder="搜索想吃的菜" value="${escapeText(state.query)}" aria-label="搜索想吃的菜"></label>
 <div class="filter-switch" role="group" aria-label="筛选方式"><button data-filter-mode="category" aria-pressed="${state.filterMode==='category'}">分类</button><button data-filter-mode="cuisine" aria-pressed="${state.filterMode==='cuisine'}">菜系</button><button data-filter-mode="recommend" aria-pressed="${state.filterMode==='recommend'}">推荐</button></div></div>
 <div class="catalog ${state.filterMode==='recommend' ? 'catalog-recommend' : ''}">${state.filterMode!=='recommend' ? `<nav class="filters" aria-label="${state.filterMode==='category'?'菜品分类':'菜系'}">${filters.map(c=>{const selectedCount=selectedDishes().filter(d=>c==='全部'||d[field]===c).length;return `<button class="filter ${state.category===c?'active':''}" data-category="${escapeText(c)}" aria-pressed="${state.category===c}"><span class="filter-name">${escapeText(c)}</span>${selectedCount ? `<span class="filter-count">${selectedCount}</span>` : ''}</button>`}).join('')}</nav>` : ''}
 <section class="catalog-content" aria-label="菜品列表">${catalogContent(filtered)}</section></div></div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" aria-label="${state.selected.length ? `已选${state.selected.length}道菜，下单` : '请先选择菜品'}" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
}
function detailMarkup(dish, {selected = false, shared = false, disabled = false} = {}) {
 if (!dish) return `<div class="screen-scroll detail-scroll"><header class="detail-nav"><button type="button" data-detail-back aria-label="返回点菜">${icon('back')}<span>返回</span></button><span>菜品详情</span></header><div class="detail-missing">这道菜暂时无法查看</div></div>`;
 const d = normalizeDish(dish);
 const rows = [['分类', d.category], ...(d.cuisine !== '未分类' ? [['菜系', d.cuisine]] : []), ['辣度', spiceLabels[d.spice_level]]];
 const unavailable = disabled || !d.is_available;
 return `<div class="screen-scroll detail-scroll"><header class="detail-nav"><button type="button" data-detail-back aria-label="返回点菜">${icon('back')}<span>返回</span></button><span>菜品详情</span></header><div class="detail-photo"><img src="${escapeText(dishImage(d))}" alt="${escapeText(d.name)}" onerror="this.style.visibility='hidden'"></div><main class="detail-content"><div class="detail-title"><div><span class="detail-overline">家宴 · 家的味道</span><h1>${escapeText(d.name)}</h1></div>${!d.is_available ? '<span class="detail-status">已下架</span>' : ''}</div>${d.note ? `<p class="detail-note">${escapeText(d.note)}</p>` : ''}<div class="detail-facts" aria-label="菜品信息">${rows.map(([label,value])=>`<div><span>${label}</span><strong>${escapeText(value)}</strong></div>`).join('')}</div></main></div><div class="detail-bottom"><span class="detail-choice-state ${selected && !unavailable ? 'is-selected' : ''}">${unavailable ? (shared ? '本次点菜已结束' : '这道菜暂不可选') : selected ? '已加入菜单' : '想吃就加入菜单'}</span><button type="button" ${shared ? `data-choice="${escapeText(d.id)}"` : 'data-detail-toggle'} aria-pressed="${selected}" ${unavailable?'disabled':''}>${unavailable ? '暂不可选' : selected ? '取消选择' : '加入菜单'}</button></div>`;
}
function renderDishDetail() {
 const dish = dishes.find(d => d.id === state.detailId);
 app.className='phone-screen detail-screen';
 app.innerHTML=detailMarkup(dish, {selected: !!dish && state.selected.includes(dish.id)});
 bind();
 mountDetailBackdrop();
}
let motionEnabled = false;
let lastShake = 0;
let previousAcceleration = null;
let surpriseDrawing = false;
let surpriseAudio = null;
function prepareSurpriseAudio() {
 try {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!surpriseAudio || surpriseAudio.state === 'closed') surpriseAudio = new AudioContextClass();
  return surpriseAudio;
 } catch (_) { return null; }
}
function playSurpriseSound() {
 try {
  const context = prepareSurpriseAudio();
  if (!context) return;
  if (context.state === 'suspended' || context.state === 'interrupted') { context.resume().then(() => { if (context.state === 'running') playSurpriseSound(); }).catch(() => {}); return; }
  if (context.state !== 'running') return;
  // A playful rising flourish resolves as the surprise is revealed.
  const base = context.currentTime;
  [[0, 440], [.14, 554], [.28, 659], [.42, 880], [.56, 1109]].forEach(([offset, frequency]) => {
   const start = base + offset;
   const oscillator = context.createOscillator();
   const gain = context.createGain();
   oscillator.type = 'sine'; oscillator.frequency.value = frequency;
   gain.gain.setValueAtTime(.0001, start);
   gain.gain.exponentialRampToValueAtTime(.10, start + .012);
   gain.gain.exponentialRampToValueAtTime(.0001, start + .14);
   oscillator.connect(gain); gain.connect(context.destination);
   oscillator.start(start); oscillator.stop(start + .15);
  });
  [1047, 1319, 1568, 2093].forEach((frequency, index) => {
   const start = base + .79 + index * .025;
   const oscillator = context.createOscillator();
   const gain = context.createGain();
   oscillator.type = 'sine'; oscillator.frequency.value = frequency;
   gain.gain.setValueAtTime(.0001, start);
   gain.gain.exponentialRampToValueAtTime(index === 3 ? .035 : .065, start + .008);
   gain.gain.exponentialRampToValueAtTime(.0001, start + .36);
   oscillator.connect(gain); gain.connect(context.destination);
   oscillator.start(start); oscillator.stop(start + .37);
  });
 } catch (_) { /* 无法播放时不影响选菜。 */ }
}
function drawSurprise() {
 if (surpriseDrawing) return;
 const candidates = dishes.filter(d => d.is_available && !state.selected.includes(d.id));
 if (!candidates.length) { notify(dishes.some(d => d.is_available) ? '所有上架菜品都已加入菜单' : '暂时没有上架的菜品'); return; }
 const choices = candidates.length > 1 ? candidates.filter(d => d.id !== state.surpriseId) : candidates;
 const dish = choices[Math.floor(Math.random() * choices.length)];
 state.surpriseId = dish.id;
 playSurpriseSound();
 try { if (typeof navigator.vibrate === 'function') navigator.vibrate([30, 40, 30]); } catch (_) { /* 震动不可用时仍正常选菜。 */ }
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) { render(); return; }
 surpriseDrawing = true;
 const card = app.querySelector('.surprise-card');
 const content = card?.querySelector('.surprise-result, .surprise-placeholder');
 if (content) {
  content.outerHTML = `<div class="surprise-shaking" role="status"><div class="surprise-copy"><span>家宴 · 随心一选</span><strong>正在挑选</strong><p>请稍等片刻</p></div></div>`;
  card.classList.add('is-shaking');
 }
 const button = app.querySelector('[data-action=surprise]');
 if (button) { button.disabled = true; button.textContent = '正在挑选…'; }
 setTimeout(() => {
  surpriseDrawing = false;
  if (state.page !== 'surprise') return;
  render();
  app.querySelector('.surprise-card')?.classList.add('surprise-reveal');
 }, 950);
}
async function enableMotion() {
 const audio = prepareSurpriseAudio();
 if (audio && audio.state !== 'running') audio.resume().catch(() => {});
 if (typeof DeviceMotionEvent === 'undefined') { notify('当前设备不支持摇动感应，请点击按钮'); return; }
 try {
  if (typeof DeviceMotionEvent.requestPermission === 'function' && await DeviceMotionEvent.requestPermission() !== 'granted') { notify('未开启摇动感应，点击按钮也可以选菜'); return; }
  motionEnabled = true; previousAcceleration = null; render();
 } catch (_) { notify('无法开启摇动感应，点击按钮也可以选菜'); }
}
window.addEventListener('devicemotion', event => {
 if (!motionEnabled || state.page !== 'surprise') return;
 const a = event.accelerationIncludingGravity;
 if (!a || a.x == null || a.y == null || a.z == null) return;
 const now = Date.now();
 if (previousAcceleration && now - lastShake > 1500 && Math.abs(a.x - previousAcceleration.x) + Math.abs(a.y - previousAcceleration.y) + Math.abs(a.z - previousAcceleration.z) > 24) {
  lastShake = now; drawSurprise();
 }
 previousAcceleration = {x:a.x, y:a.y, z:a.z};
});
function surpriseModeHeader(mode) {
 return `<header class="topbar"><div class="top-brand">${logo}<div><strong>家宴</strong><small>把喜欢的菜端上桌</small></div></div></header><div class="surprise-heading"><h2>今天，<span>吃点随便</span></h2><p>不知道吃什么？让这顿饭多一点惊喜。</p></div><div class="surprise-modes" role="group" aria-label="选择方式"><button type="button" data-page="surprise" aria-pressed="${mode==='single'}">选一道</button><button type="button" data-page="meal-plan" aria-pressed="${mode==='table'}">搭配一桌</button></div>`;
}
function renderSurprise() {
 app.className='phone-screen surprise-screen';
 const dish = dishes.find(d => d.id === state.surpriseId && d.is_available);
 const remaining = dishes.filter(d => d.is_available && !state.selected.includes(d.id)).length;
 app.innerHTML=`<div class="screen-scroll surprise-scroll">${surpriseModeHeader('single')}<section class="surprise-card" aria-live="polite">${dish ? `<div class="surprise-result"><div class="surprise-copy"><span>${state.selected.includes(dish.id) ? '已加入菜单' : '今日推荐'}</span><h3>${escapeText(dish.name)}</h3>${dish.note ? `<p>${escapeText(dish.note)}</p>` : ''}</div>${dish.image ? `<img class="surprise-dish-image" src="${escapeText(dishImage(dish))}" width="88" height="104" alt="" onerror="this.remove()">` : ''}</div>` : `<div class="surprise-placeholder"><div class="surprise-copy"><span>家宴 · 随心一选</span><h3>下一道好菜，<br>交给一点运气。</h3><p>从家里的菜单中挑一道。</p></div></div>`}<div class="surprise-card-foot">${remaining ? `还有 ${remaining} 道菜可以抽取` : '没有更多可抽取的菜了'}</div></section><div class="surprise-actions ${dish ? 'has-result' : ''}">${dish ? `<button class="surprise-add" data-action="add-surprise" ${state.selected.includes(dish.id) ? 'disabled' : ''}>${state.selected.includes(dish.id) ? '已加入菜单' : '加入菜单'}</button>` : ''}<button class="surprise-draw" data-action="surprise" ${remaining ? '' : 'disabled'}>${dish ? '再选一道' : '摇一摇，选一道'}</button></div><button class="motion-toggle" data-action="enable-motion" ${motionEnabled ? 'disabled' : ''}>${motionEnabled ? '摇动感应已开启 · 摇动手机即可选菜' : '开启手机摇动感应'}</button></div><div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
}
function renderMealPlan(){
 app.className='phone-screen surprise-screen plan-screen';
 const result=state.planResult;
 const planOptions=planCategoryOptions(dishes);
 const items=result ? result.chosen.map(id=>dishes.find(d=>d.id===id)).filter(d=>d && d.is_available) : [];
 app.innerHTML=`<div class="screen-scroll surprise-scroll plan-scroll">${surpriseModeHeader('table')}<div class="plan-intro"><h3>搭配一桌菜</h3><p>选好人数和分类，剩下的交给一点灵感。</p></div><section class="plan-panel"><div class="plan-people"><span class="plan-people-copy"><strong>几个人吃饭？</strong><small>调整人数，自动建议菜品数量。</small></span><div class="plan-stepper plan-stepper-people" role="group" aria-label="用餐人数"><button type="button" data-plan-people-step="-1" aria-label="减少用餐人数" ${state.planPeople<=1?'disabled':''}>−</button><span aria-live="polite"><strong>${state.planPeople}</strong><small>人</small></span><button type="button" data-plan-people-step="1" aria-label="增加用餐人数" ${state.planPeople>=8?'disabled':''}>＋</button></div></div><div class="plan-divider"></div><div class="plan-section-head"><strong>想吃哪些类型</strong><span>按需要调整数量</span></div><div class="plan-counts">${planOptions.map(category=>{const count=state.planCounts[category]||0;return `<div class="plan-count-item"><strong>${escapeText(category)}</strong><div class="plan-stepper" role="group" aria-label="${escapeText(category)}数量"><button type="button" data-plan-step="-1" data-plan-category="${escapeText(category)}" aria-label="减少${escapeText(category)}数量" ${count<=0?'disabled':''}>−</button><span aria-live="polite">${count}<small>道</small></span><button type="button" data-plan-step="1" data-plan-category="${escapeText(category)}" aria-label="增加${escapeText(category)}数量" ${count>=9?'disabled':''}>＋</button></div></div>`}).join('')}</div><button class="plan-generate" type="button" data-action="plan-generate">${result?'重新搭配':'帮我搭配'}</button></section>${result ? `<section class="plan-results" aria-live="polite"><div class="plan-section-head"><strong>这一桌的建议</strong><span>${items.length} 道菜</span></div>${result.shortages.length ? `<p class="plan-shortage">${result.shortages.map(s=>`${escapeText(s.category)}需要 ${s.requested} 道，目前可选 ${s.available} 道`).join('；')}。可以调整数量或添加菜品。</p>` : ''}${items.length ? `<div class="plan-list">${items.map(d=>`<article><img src="${escapeText(dishImage(d))}" alt=""><div><strong>${escapeText(d.name)}</strong><small>${escapeText(d.category)}${state.selected.includes(d.id)?' · 已在菜单中':''}</small></div><button type="button" data-plan-replace="${escapeText(d.id)}" aria-label="换一道${escapeText(d.category)}，替换${escapeText(d.name)}">换一道</button></article>`).join('')}</div><button type="button" class="plan-apply" data-action="plan-apply">加入我的菜单</button><p class="plan-hint">会保留已选的菜，不重复添加。</p>` : '<p class="plan-shortage">没有可搭配的菜，试试调整分类或添加菜品。</p>'}</section>` : ''}</div><div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
}
function renderMenu(){
 app.className='phone-screen menu-screen';
 const selected=selectedDishes();
 app.innerHTML=`<div class="screen-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="menu-heading"><div><h2>今天的菜单</h2></div><div class="menu-heading-actions">${selected.length ? '<button class="new-meal-entry" type="button" data-action="new-meal">开始新一餐</button>' : ''}<button class="history-entry" data-page="history">吃饭日记</button></div></div>
 <section class="menu-card"><div class="menu-card-top"><input class="menu-title-input" aria-label="菜单标题，可编辑" maxlength="16" value="${escapeText(state.title)}"><div class="menu-meta"><span>${new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</span><span>点击标题可修改</span></div></div>${selected.length ? `<div class="menu-rows">${selected.map((d,i)=>`<div class="menu-row"><span class="number">${String(i+1).padStart(2,'0')}</span><img class="menu-dish-img" src="${escapeText(dishImage(d))}" alt=""><span class="name">${escapeText(d.name)}</span><button data-remove="${escapeText(d.id)}" aria-label="从菜单移除${escapeText(d.name)}">${icon('close')}</button></div>`).join('')}</div>` : `<div class="menu-empty"><div class="menu-empty-copy"><span class="menu-empty-kicker">今天的餐桌</span><strong>还没有选菜</strong><p>挑几道喜欢的菜，<br>为这一餐添一点期待。</p></div><button data-page="dishes">去挑选菜品</button></div>`}${selected.length ? `<div class="menu-card-foot menu-card-foot-actions"><p>好好吃饭，慢慢生活</p><button class="shopping-entry" type="button" data-action="shopping-open">${icon('basket')}生成买菜清单</button></div>` : '<div class="menu-card-foot"><span></span>好好吃饭，慢慢生活<span></span></div>'}</section>${selected.length ? `<div class="diary-compose"><label for="diary-note">写下这一餐 <span>选填</span></label><textarea id="diary-note" maxlength="200" placeholder="今天的饭，有什么想记下的？">${escapeText(state.diaryNote)}</textarea><div class="diary-photo-field">${state.diaryPhoto ? `<div class="diary-photo-preview"><img src="${escapeText(state.diaryPhoto)}" alt="这一餐的照片预览"><button type="button" class="diary-photo-remove" data-action="remove-diary-photo" aria-label="移除照片">${icon('close')}</button></div>` : `<label class="diary-photo-upload">${icon('camera')}<span>添加照片</span><input type="file" accept="image/*" aria-label="添加餐桌照片"></label>`}${state.diaryPhotoProcessing ? '<p class="diary-photo-status" role="status">正在处理照片…</p>' : ''}</div><p class="diary-finish-hint">完成后保存到吃饭日记，并清空当前菜单。</p><button data-action="save-diary" ${state.diaryPhotoProcessing || state.diarySaving ? 'disabled' : ''}>完成并保存这餐</button></div>` : ''}</div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action dock-save" data-action="save" ${selected.length?'':'disabled'}>保存菜单图片</button></div></div>`;
 bind();
}
function renderManage(){
 const field = state.manageFilterMode === 'category' ? 'category' : 'cuisine';
 const options = state.manageFilterMode === 'category' ? categories.slice(1) : cuisines;
 const present = new Set(dishes.map(d => d[field]));
 const filters = ['全部', ...options.filter(value => present.has(value)), ...[...present].filter(value => value && !options.includes(value))];
 const filtered = dishes.filter(d => state.manageFilter === '全部' || d[field] === state.manageFilter);
 app.className='phone-screen manage-screen';
 app.innerHTML=`<div class="screen-scroll manage-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><h2>编辑菜单</h2><p>${dishes.length} 道菜</p></div><button class="beta-switch" data-action="switch-user">切换内测用户</button></div><button class="beta-switch" data-action="migrate-photos">迁移旧照片</button><div class="filter-switch manage-filter-switch" role="group" aria-label="编辑菜单筛选方式"><button data-manage-mode="category" aria-pressed="${state.manageFilterMode==='category'}">菜品分类</button><button data-manage-mode="cuisine" aria-pressed="${state.manageFilterMode==='cuisine'}">菜系</button></div><nav class="manage-filters" aria-label="${state.manageFilterMode==='category'?'菜品分类':'菜系'}筛选">${filters.map(value=>`<button data-manage-filter="${escapeText(value)}" aria-pressed="${state.manageFilter===value}">${escapeText(value)}</button>`).join('')}</nav><div class="manage-list" aria-label="筛选后的菜品">${filtered.length ? filtered.map(d=>`<article class="manage-dish"><img src="${escapeText(dishImage(d))}" alt=""><div class="manage-dish-copy"><strong>${escapeText(d.name)}</strong><span>${escapeText(d.category)}${d.cuisine !== '未分类' ? ' · ' + escapeText(d.cuisine) : ''}</span>${spiceBadge(d)}${d.is_available?'':'<span class="manage-unavailable">已下架</span>'}</div><button data-edit="${escapeText(d.id)}" aria-label="编辑${escapeText(d.name)}">编辑</button><button class="delete-dish" data-delete="${escapeText(d.id)}" aria-label="删除${escapeText(d.name)}">删除</button></article>`).join('') : `<div class="manage-empty">${dishes.length ? '这个分类暂时没有菜品' : '菜单还没有菜，先添加一道吧'}</div>`}</div></div><div class="manage-bottom"><button class="manage-add" data-action="new-dish">${icon('plus')} 添加菜品</button></div>`;
 bind();
}
function renderDishForm(){
 const dish = dishes.find(d=>d.id===state.editingId);
 const image = state.draftImage || dish?.image || 'tomato.jpg';
 app.className='phone-screen manage-screen';
 app.innerHTML=`<div class="screen-scroll form-scroll">${''}<div class="page-heading"><button data-page="manage" aria-label="返回编辑菜单">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><h2>${dish?'编辑菜品':'添加菜品'}</h2></div></div><form id="dish-form" class="dish-form"><label class="form-label" for="dish-name">菜品名称 <em>必填</em></label><input id="dish-name" name="name" maxlength="24" required placeholder="例如：番茄炒蛋" value="${escapeText(dish?.name || '')}"><label class="form-label" for="dish-category">菜品分类</label><select id="dish-category" name="category">${[...categories.slice(1), ...(dish?.category && !categories.includes(dish.category) ? [dish.category] : [])].map(c=>`<option value="${escapeText(c)}" ${dish?.category===c?'selected':''}>${escapeText(c)}</option>`).join('')}</select><label class="form-label" for="dish-cuisine">菜系</label><select id="dish-cuisine" name="cuisine">${[...cuisines, ...(dish?.cuisine && !cuisines.includes(dish.cuisine) ? [dish.cuisine] : [])].map(c=>`<option value="${escapeText(c)}" ${dish?.cuisine===c?'selected':''}>${escapeText(c)}</option>`).join('')}</select><div class="form-pair"><div><label class="form-label" for="dish-spice">辣度</label><select id="dish-spice" name="spice_level">${spiceLabels.map((label, level)=>`<option value="${level}" ${(dish?.spice_level ?? 0)===level?'selected':''}>${label}</option>`).join('')}</select></div><div><label class="form-label" for="dish-availability">上架状态</label><select id="dish-availability" name="is_available"><option value="true" ${dish?.is_available!==false?'selected':''}>上架</option><option value="false" ${dish?.is_available===false?'selected':''}>下架</option></select></div></div><label class="form-label" for="dish-note">一句介绍 <span>选填</span></label><input id="dish-note" name="note" maxlength="36" placeholder="写一句这道菜的味道" value="${escapeText(dish?.note || '')}"><div class="form-label">菜品封面</div><div class="cover-picker"><img id="cover-preview" src="${escapeText(dishImage({image}))}" alt="菜品封面预览"><div><strong>换一张喜欢的图片</strong><span>拍一张，或从相册挑选</span><div class="cover-actions"><label class="cover-upload">${icon('camera')}拍照<input type="file" accept="image/*" capture="environment"></label><label class="cover-upload">${icon('image')}从相册选择<input type="file" accept="image/*"></label></div></div></div><button class="form-save" type="submit">保存菜品</button></form></div>`;
 bind();
}

let historyEntries = [];
let historyLoading = false;
let historyError = false;
let historyRequest = 0;
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
function renderHistory() {
 app.className='phone-screen history-screen';
 const items = historyEntries.map(entry => {
  const parts=entry.meal_date.split('-');
  return `<article class="diary-card"><div class="diary-date"><strong>${escapeText(parts[2])}</strong><span>${escapeText(parts[0])}.${escapeText(parts[1])}</span></div><div class="diary-content"><div class="diary-card-title"><h3>${escapeText(entry.title)}</h3><span>${entry.dishes.length} 道菜</span></div><p class="diary-dishes">${entry.dishes.map(d=>escapeText(d.name)).join(' · ')}</p>${entry.note ? `<p class="diary-note">${escapeText(entry.note)}</p>` : ''}${typeof entry.photo === 'string' && (entry.photo.startsWith('data:image/jpeg;base64,') || isStoredPhoto(entry.photo)) ? `<img class="diary-photo" src="${escapeText(displayPhoto(entry.photo))}" alt="${escapeText(entry.title)}的餐桌照片" loading="lazy">` : ''}</div></article>`;
 }).join('');
 app.innerHTML=`<div class="screen-scroll"><div class="page-heading"><button data-page="menu" aria-label="返回菜单">${icon('back')}</button><span>一餐一饭，慢慢珍藏</span></div><div class="history-heading"><span class="menu-kicker">THE FAMILY TABLE</span><h2>吃饭日记</h2><p>把平常的每一餐，留成家的记忆。</p></div>${historyError ? '<div class="history-status">云端暂不可达，显示本机已有的日记 <button data-action="retry-history">重试</button></div>' : ''}${historyLoading && !historyEntries.length ? '<div class="history-empty">正在翻开日记…</div>' : items || (historyError ? '<div class="history-empty">暂时无法读取日记，请检查网络后重试。</div>' : '<div class="history-empty"><strong>日记的第一页，等你来写</strong><p>点好菜后，保存这一餐的菜单吧。</p><button data-page="dishes">去挑选菜品</button></div>')}</div>`;
 bind();
 const retry=app.querySelector('[data-action=retry-history]');if(retry)retry.onclick=loadHistory;
}
async function loadHistory() {
 const request=++historyRequest;
 historyLoading=true; historyError=false;
 try { const cached=await idbGet(cacheKey('meal_history')); if(request===historyRequest && Array.isArray(cached)) { historyEntries=cached; if(state.page==='history')render(); } } catch (_) {}
 try {
  if(offlineMode || !sb) throw new Error('云端不可用');
  const {data,error}=await sb.from('meal_history').select('*').order('meal_date',{ascending:false}).order('created_at',{ascending:false});
  if(error) throw error;
  if(request!==historyRequest)return;
  historyEntries=data.filter(e=>typeof e.meal_date==='string' && typeof e.title==='string' && Array.isArray(e.dishes) && e.dishes.every(d=>d && typeof d.name==='string'));
  idbSet(cacheKey('meal_history'),historyEntries).catch(()=>{});
  prefetchPhotos(historyEntries.map(e=>e.photo));
 } catch (_) { if(request===historyRequest)historyError=true; }
 finally { if(request===historyRequest){historyLoading=false;if(state.page==='history')render();} }
}
async function saveHistory() {
 const selected=selectedDishes(); if(!selected.length || state.diaryPhotoProcessing || state.diarySaving)return;
 const snapshot={selected:[...state.selected],title:state.title,diaryNote:state.diaryNote,diaryPhoto:state.diaryPhoto,diaryPhotoVersion:state.diaryPhotoVersion};
 const entry={user_code:betaCode,id: typeof crypto.randomUUID==='function' ? crypto.randomUUID() : `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,meal_date:localDate(),title:state.title.trim() || '今天的菜单',note:state.diaryNote.trim(),dishes:selected.map(d=>({id:d.id,name:d.name}))};

 state.diarySaving=true;
 const button=app.querySelector('[data-action=save-diary]');button.disabled=true;button.textContent='保存中…';
 try {
  if(offlineMode || !sb)throw new Error('云端不可用');
  if(snapshot.diaryPhoto)entry.photo=await uploadPhoto(snapshot.diaryPhoto,'diary');
  const {data,error}=await sb.from('meal_history').insert(entry).select().single();
  if(error)throw error;
  ++historyRequest;
  historyEntries=[data,...historyEntries.filter(e=>e.id!==data.id)];
  idbSet(cacheKey('meal_history'),historyEntries).catch(()=>{});
  if(recommendationHasData) { recommendationMeals=[{id:data.id,dishes:data.dishes},...recommendationMeals.filter(meal=>meal.id!==data.id)];idbSet(cacheKey('recommendation_meals'),recommendationMeals).catch(()=>{}); }
  loadRecommendations();
  const unchanged=state.title===snapshot.title && state.diaryNote===snapshot.diaryNote && state.diaryPhoto===snapshot.diaryPhoto && state.diaryPhotoVersion===snapshot.diaryPhotoVersion && state.selected.length===snapshot.selected.length && state.selected.every((id,index)=>id===snapshot.selected[index]);
  if (unchanged) { const cleared=clearMenuDraft(); render(); notify(cleared?'这餐已保存，可以开始新一餐':'日记已保存，但本机草稿未能清除'); }
  else notify('这餐已保存；当前菜单有新改动，已保留');
 } catch (error) { notify(state.diaryPhoto && (error.code==='PGRST204' || error.code==='42703') ? '请先更新云端数据库，再保存照片' : '日记保存失败，请检查网络或数据库'); }
 finally { state.diarySaving=false; const current=app.querySelector('[data-action=save-diary]'); if(current){current.disabled=Boolean(state.diaryPhotoProcessing);current.textContent='完成并保存这餐';} }
}

function render(){if(state.page==='shopping')renderShopping();else if(state.page==='dish-detail')renderDishDetail();else if(state.page==='shared-create')renderSharedCreate();else if(state.page==='history')renderHistory();else if(state.page==='menu')renderMenu();else if(state.page==='surprise')renderSurprise();else if(state.page==='meal-plan')renderMealPlan();else if(state.page==='manage')renderManage();else if(state.page==='dish-form')renderDishForm();else renderDishes();if(offlineMode){const scroll=app.querySelector('.screen-scroll');if(scroll){const notice=document.createElement('div');notice.className='offline-notice';notice.setAttribute('role','status');notice.textContent='当前查看本机缓存，联网后将自动恢复';scroll.prepend(notice)}}}
function notify(message){const old=app.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;app.appendChild(el);setTimeout(()=>el.remove(),2400)}
