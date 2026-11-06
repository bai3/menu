const categories = ['全部', '家常菜', '清爽凉菜', '暖心汤羹', '主食', '饮品', '甜点', '小吃', '火锅', '烧烤', '其他'];
const cuisines = ['未分类', '川菜', '鲁菜', '粤菜', '苏菜', '浙菜', '闽菜', '湘菜', '徽菜', '东北菜', '西北菜', '京菜', '日料', '韩料', '泰餐', '越南菜', '印度菜', '法餐', '意餐', '美式料理', '其他'];
const state = { diaryNote: '', page: 'dishes', category: '全部', filterMode: 'category', manageFilterMode: 'category', manageFilter: '全部', query: '', selected: [], title: '今天的菜单', editingId: null, draftImage: null, surpriseId: null };
const app = document.querySelector('#app');
const icon = (name) => {
 const paths = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  check:'<path d="m5 12 4.5 4.5L19 7"/>',
  edit:'<path d="M12 20h8M4 20l3.6-.8L19 7.8 16.2 5 4.8 16.4 4 20Z"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  home:'<path d="M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
  basket:'<path d="M3 9h18l-2 10H5L3 9Z"/><path d="m8 9 4-6 4 6M9 13v3m3-3v3m3-3v3"/>',
  cheers:'<path d="M3 5.5 9.5 3l2.2 6a3.5 3.5 0 0 1-6.6 2.4L3 5.5ZM13.8 9l1.8-5 6.2 2.3-1.8 5a3.3 3.3 0 0 1-6.2-2.3ZM8.5 13.6l1.8 5M7.8 20l5-1.8M16.1 13.2l-1.7 4.7M12.1 17.1l4.5 1.6M11 2l.4-1.5M13 4l1.4-1"/>',
  surprise:'<path d="M5 12c0 4 3 7 7 7s7-3 7-7H5ZM8 8c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4"/><path d="M3 10h18"/>',
  menu:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  back:'<path d="m14 6-6 6 6 6"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="14" r="3.5"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 19 5.5-5.5a1 1 0 0 1 1.4 0L21 19"/>',
  all:'<path d="M4 10h16l-2 9H6l-2-9Z"/><path d="m8 10 4-6 4 6M9 14v2m3-2v2m3-2v2"/>',
  hot:'<path d="M4 13h16c-.5 4-3.5 7-8 7s-7.5-3-8-7ZM7 10c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4"/>',
  cold:'<path d="M12 20c4-3 6-7 5-12-5 0-9 2-10 7-1 3 1 5 5 5ZM8 18l6-6M12 15l-3-1"/>',
  soup:'<path d="M4 13h16c-.5 4-3.5 7-8 7s-7.5-3-8-7ZM8 9c-1-2 2-2 1-4m4 4c-1-2 2-2 1-4"/>'
 };
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
};
const logo = `<span class="brand-mark" aria-label="白家私厨标志"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 22h24c-.7 7-5.5 11-12 11S8.7 29 8 22Z"/><path d="M13 18c-2-3 3-4 1-7M20 18c-2-3 3-4 1-7M27 18c-2-3 3-4 1-7"/></svg></span>`;
const categoryIcon = {'全部':'all','家常菜':'hot','清爽凉菜':'cold','暖心汤羹':'soup'};
const spiceLabels = ['不辣', '微辣', '中辣', '特辣'];
const spiceBadge = d => d.spice_level ? `<span class="spice-badge" role="img" aria-label="${spiceLabels[d.spice_level]}" title="${spiceLabels[d.spice_level]}">${'<span aria-hidden="true">🌶</span>'.repeat(d.spice_level)}</span>` : '';
const escapeText = (str) => String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
function nav(){return `<nav class="nav" aria-label="页面导航"><button data-page="dishes" class="${state.page==='dishes'?'active':''}" ${state.page==='dishes'?'aria-current="page"':''}>${icon('basket')}<span>点菜</span></button><button data-page="surprise" class="${state.page==='surprise'?'active':''}" ${state.page==='surprise'?'aria-current="page"':''}>${icon('surprise')}<span>吃点随便</span></button><button data-page="menu" class="${state.page==='menu'?'active':''}" ${state.page==='menu'?'aria-current="page"':''}>${icon('menu')}<span>菜单</span></button></nav>`}
const heroSlides = [
 { image:'hero.jpg', tag:'白家私厨 / 家的味道', title:'今天，<br>一起好好吃饭。', note:'把喜欢的菜，点给爱的人', seal:'家味' },
 { image:'soup.jpg', tag:'一碗热汤 / 一份牵挂', title:'热汤上桌，<br>心也暖了。', note:'忙碌的日子，也要记得喝口汤', seal:'暖意' },
 { image:'shrimp.jpg', tag:'寻常日子 / 认真吃饭', title:'一餐一饭，<br>都是小欢喜。', note:'和喜欢的人，分享喜欢的味道', seal:'欢喜' }
];
let heroIndex = 0;
function heroMarkup() {
 return `<section class="hero" aria-label="餐桌温馨提示" aria-roledescription="轮播图">${heroSlides.map((slide,i)=>`<div class="hero-slide ${i===heroIndex?'active':''}" role="group" aria-label="第 ${i+1} 张，共 ${heroSlides.length} 张" aria-hidden="${i!==heroIndex}"><div class="hero-image" style="background-image:linear-gradient(90deg,rgba(58,32,22,.76),rgba(65,37,25,.36) 68%,rgba(65,37,25,.12)),url('./public/assets/${slide.image}')"></div><div class="hero-text"><span class="tag">${slide.tag}</span><h2>${slide.title}</h2><p>${slide.note}</p></div><span class="hero-seal">${slide.seal}</span></div>`).join('')}<div class="hero-dots" aria-label="选择轮播图片">${heroSlides.map((_,i)=>`<button type="button" data-hero-slide="${i}" aria-label="查看第 ${i+1} 张" aria-pressed="${i===heroIndex}"></button>`).join('')}</div></section>`;
}
function showHero(index) {
 const hero=app.querySelector('.hero'); if(!hero)return;
 heroIndex=(index+heroSlides.length)%heroSlides.length;
 hero.querySelectorAll('.hero-slide').forEach((slide,i)=>{slide.classList.toggle('active',i===heroIndex);slide.setAttribute('aria-hidden',String(i!==heroIndex))});
 hero.querySelectorAll('[data-hero-slide]').forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===heroIndex)));
}
function bindHero() {
 const hero=app.querySelector('.hero'); if(!hero)return;
 hero.querySelectorAll('[data-hero-slide]').forEach(dot=>dot.onclick=()=>showHero(Number(dot.dataset.heroSlide)));
 let startX=0, startY=0;
 hero.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;startY=e.touches[0].clientY},{passive:true});
 hero.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy))showHero(heroIndex+(dx<0?1:-1))},{passive:true});
}
setInterval(()=>{const hero=app.querySelector('.hero');if(hero && !document.hidden && !hero.matches(':hover') && !hero.contains(document.activeElement) && !matchMedia('(prefers-reduced-motion: reduce)').matches)showHero(heroIndex+1)},6000);
function selectedDishes(){return state.selected.map(id=>dishes.find(d=>d.id===id)).filter(Boolean)}
function filteredDishes() {
 return dishes.filter(d => `${d.name}${d.category}${d.cuisine}${d.note}`.includes(state.query.trim()));
}
function catalogContent(filtered){
 const field = state.filterMode === 'category' ? 'category' : 'cuisine';
 const options = state.filterMode === 'category' ? categories.slice(1) : cuisines;
 const present = [...new Set(filtered.map(d => d[field]))];
 const groups = [...options.filter(value => present.includes(value)), ...present.filter(value => !options.includes(value))];
 if (!groups.length) return '<div class="empty">没有找到这道菜<br>换个关键词试试吧</div>';
 return `<div class="catalog-heading"><h3>全部菜品</h3><span>${filtered.length} 道菜</span></div>` + groups.map(value => {
  const group = filtered.filter(d => d[field] === value);
  return `<section class="catalog-group" data-group="${escapeText(value)}"><div class="catalog-heading"><h3>${escapeText(value)}</h3><span>${group.length} 道菜</span></div><div class="dish-list">${group.map(d=>`<article class="dish ${d.is_available?'':'dish-unavailable'}"><img class="dish-img" src="${escapeText(dishImage(d))}" alt="${escapeText(d.name)}" onerror="this.style.visibility='hidden'"><div class="dish-info"><h3>${escapeText(d.name)} ${spiceBadge(d)}</h3><p>${escapeText(d.note)}</p><span class="dish-tag">${escapeText(d.category)}${d.cuisine !== '未分类' ? ' · ' + escapeText(d.cuisine) : ''}</span>${d.is_available?'':'<span class="unavailable-label">已下架</span>'}</div><button class="add ${state.selected.includes(d.id)?'selected':''}" data-dish="${escapeText(d.id)}" aria-label="${state.selected.includes(d.id)?'移除':'选择'}${escapeText(d.name)}" aria-pressed="${state.selected.includes(d.id)}" ${d.is_available?'':'disabled'}>${icon(state.selected.includes(d.id)?'check':'plus')}</button></article>`).join('')}</div></section>`;
 }).join('');
}
function updateCatalogNavigation(shared = false) {
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
 scroll.addEventListener('scroll', () => updateCatalogNavigation(shared), {passive:true});
 const selector = shared ? '[data-shared-category]' : '[data-category]';
 app.querySelectorAll(selector).forEach(button => button.onclick = () => {
  const category = shared ? button.dataset.sharedCategory : button.dataset.category;
  const target = category === '全部' ? app.querySelector('.catalog') : [...app.querySelectorAll('.catalog-group')].find(group => group.dataset.group === category);
  if (target) scroll.scrollTo({top: scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top, behavior: 'auto'});
  updateCatalogNavigation(shared);
 });
 updateCatalogNavigation(shared);
}
function renderDishes(){
 const field = state.filterMode === 'category' ? 'category' : 'cuisine';
 const options = state.filterMode === 'category' ? categories.slice(1) : cuisines;
 const present = new Set(dishes.map(d => d[field]));
 const filters = ['全部', ...options.filter(value => present.has(value)), ...[...present].filter(value => value && !options.includes(value))];
 const filtered = filteredDishes();
 app.className='phone-screen';
 app.innerHTML=`<div class="screen-scroll">${''}<header class="topbar"><div class="top-brand">${logo}<div><strong>白家私厨</strong><small>把喜欢的菜端上桌</small></div></div><button class="shared-entry" data-action="shared-create">邀请一起点</button></header>
 ${heroMarkup()}
 <div class="section-title"><div><h2>今天吃什么？</h2><p>挑几道喜欢的菜，凑成一桌好饭</p></div><button class="manage-entry" data-page="manage">${icon('edit')} 编辑菜单</button></div>
 <button class="paper-entry" data-action="paper-mode"><span><small>THE FAMILY MENU</small><strong>翻开纸质菜单</strong><em>像在餐厅一样，慢慢挑选</em></span><span class="paper-entry-mark" aria-hidden="true">菜单<br><i>MENU</i></span><b>打开菜单</b></button>
 <label class="search">${icon('search')}<input type="search" placeholder="搜索想吃的菜" value="${escapeText(state.query)}" aria-label="搜索想吃的菜"></label>
 <div class="filter-switch" role="group" aria-label="筛选方式"><button data-filter-mode="category" aria-pressed="${state.filterMode==='category'}">菜品分类</button><button data-filter-mode="cuisine" aria-pressed="${state.filterMode==='cuisine'}">菜系</button></div>
 <div class="catalog"><nav class="filters" aria-label="${state.filterMode==='category'?'菜品分类':'菜系'}">${filters.map(c=>{const selectedCount=selectedDishes().filter(d=>c==='全部'||d[field]===c).length;return `<button class="filter ${state.category===c?'active':''}" data-category="${escapeText(c)}" aria-pressed="${state.category===c}"><span class="filter-name">${escapeText(c)}</span>${selectedCount ? `<span class="filter-count">${selectedCount}</span>` : ''}</button>`}).join('')}</nav>
 <section class="catalog-content" aria-label="菜品列表">${catalogContent(filtered)}</section></div></div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" aria-label="${state.selected.length ? `已选${state.selected.length}道菜，下单` : '请先选择菜品'}" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
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
 app.classList.add('page-shaking');
 const card = app.querySelector('.surprise-card');
 const content = card?.querySelector('.surprise-result, .surprise-placeholder');
 if (content) {
  content.outerHTML = `<div class="surprise-shaking" role="status"><div class="shaking-orbit"><span class="shake-mark shake-mark-left">✦</span><span class="shake-mark shake-mark-right">✳</span><div class="shaking-bowl">${icon('cheers')}</div></div><strong>正在为你挑选好菜</strong><span>摇一摇，好味道马上来</span><div class="shake-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
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
function renderSurprise() {
 app.className='phone-screen surprise-screen';
 const dish = dishes.find(d => d.id === state.surpriseId && d.is_available);
 const remaining = dishes.filter(d => d.is_available && !state.selected.includes(d.id)).length;
 app.innerHTML=`<div class="screen-scroll surprise-scroll"><header class="topbar"><div class="top-brand">${logo}<div><strong>白家私厨</strong><small>把喜欢的菜端上桌</small></div></div></header><div class="surprise-heading"><span class="menu-kicker">给选择一点灵感</span><h2>今天，<span>吃点随便</span></h2><p>不知道吃什么？让这顿饭多一点惊喜。</p></div><section class="surprise-card" aria-live="polite"><div class="surprise-card-top"><span>白家私厨 · 今日灵感</span><span>✳</span></div>${dish ? `<div class="surprise-result"><img src="${escapeText(dishImage(dish))}" alt=""><span>${state.selected.includes(dish.id) ? '已加入菜单' : '为你选中了'}</span><h3>${escapeText(dish.name)}</h3><p>${escapeText(dish.note || '这一餐，值得期待')}</p></div>` : `<div class="surprise-placeholder"><div class="surprise-bowl"><span class="surprise-spark spark-one">✳</span><span class="surprise-spark spark-two">✦</span><svg viewBox="0 0 160 140" fill="none" aria-hidden="true"><ellipse cx="80" cy="119" rx="55" ry="8" fill="#D9B49A" opacity=".3"/><path d="M26 78h108c-3 26-21 40-54 40S29 104 26 78Z" fill="#B9644E"/><ellipse cx="80" cy="78" rx="54" ry="12" fill="#D98D70"/><ellipse cx="80" cy="77" rx="43" ry="8" fill="#F8E5CA"/><path d="M55 74c-5-12 0-21 5-25 5 8 6 16 3 25m30 0c-3-14 4-23 10-26 3 10 1 19-4 27" fill="#9BA77A" stroke="#7C8A60" stroke-width="2"/><circle cx="79" cy="72" r="11" fill="#D67759"/><path d="M76 63c2-4 7-5 9-1M70 43c-5-7 4-10 0-17m17 14c-5-7 4-10 0-17" stroke="#C58C70" stroke-width="2.5" stroke-linecap="round"/></svg></div><h3>下一道好菜，会是什么？</h3><p>点一下，让美味自己来敲门</p></div>`}<div class="surprise-card-foot">${remaining ? `还有 ${remaining} 道菜可以抽取` : '没有更多可抽取的菜了'}</div></section><div class="surprise-actions ${dish ? 'has-result' : ''}">${dish ? `<button class="surprise-add" data-action="add-surprise" ${state.selected.includes(dish.id) ? 'disabled' : ''}>${state.selected.includes(dish.id) ? '已加入菜单' : '加入菜单'}</button>` : ''}<button class="surprise-draw" data-action="surprise" ${remaining ? '' : 'disabled'}>${dish ? '再选一道' : '摇一摇，选一道'}</button></div><button class="motion-toggle" data-action="enable-motion" ${motionEnabled ? 'disabled' : ''}>${motionEnabled ? '摇动感应已开启 · 摇动手机即可选菜' : '开启手机摇动感应'}</button><p class="surprise-hint">摇出喜欢的菜，再加入菜单</p></div><div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
}
function renderMenu(){
 app.className='phone-screen menu-screen';
 const selected=selectedDishes();
 app.innerHTML=`<div class="screen-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="menu-heading"><div><span class="menu-kicker">这一餐，留给家人</span><h2>今天的菜单</h2></div><button class="history-entry" data-page="history">吃饭日记</button></div>
 <section class="menu-card"><div class="menu-card-top"><span class="menu-card-mark">${icon('hot')}</span><small>今天吃什么</small><input class="menu-title-input" aria-label="菜单标题，可编辑" maxlength="16" value="${escapeText(state.title)}"><div class="menu-meta"><span>${new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</span><span>点击标题可修改</span></div></div>${selected.length ? `<div class="menu-rows">${selected.map((d,i)=>`<div class="menu-row"><span class="number">${String(i+1).padStart(2,'0')}</span><img class="menu-dish-img" src="${escapeText(dishImage(d))}" alt=""><span class="name">${escapeText(d.name)}</span><button data-remove="${escapeText(d.id)}" aria-label="从菜单移除${escapeText(d.name)}">${icon('close')}</button></div>`).join('')}</div>` : `<div class="menu-empty"><div class="menu-empty-art" aria-hidden="true"><svg viewBox="0 0 180 126" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="113" rx="65" ry="7" fill="#EAD5C1" opacity=".55"/><path d="M37 74h106c-3 24-20 37-53 37S40 98 37 74Z" fill="#C47157"/><path d="M37 74c0-7 24-12 53-12s53 5 53 12-24 12-53 12-53-5-53-12Z" fill="#E8AB8F"/><path d="M47 73c0-5 19-9 43-9s43 4 43 9-19 9-43 9-43-4-43-9Z" fill="#F8E4C7"/><path d="M65 69c-5-10-2-21 4-27 5 7 7 17 4 27M102 67c-2-13 4-23 12-27 3 10 1 21-6 29" fill="#99A77D" stroke="#75885F" stroke-width="2" stroke-linejoin="round"/><path d="M69 48l1 18m42-19-7 18" stroke="#75885F" stroke-width="1.5" stroke-linecap="round"/><circle cx="86" cy="69" r="10" fill="#D8795E"/><path d="M82 61c2-4 6-5 8-1m-5 0 2 5" stroke="#75885F" stroke-width="2" stroke-linecap="round"/><path d="M83 40c-6-7 5-10 0-17M98 37c-6-7 5-10 0-17" stroke="#D8A98E" stroke-width="2.5" stroke-linecap="round"/><path d="M34 48l-3-4m-4 12h-5m129-4 4-5m2 14h5" stroke="#D8A98E" stroke-width="2" stroke-linecap="round"/><path d="M58 96c9 5 20 7 32 7" stroke="#E8A78C" stroke-width="2" stroke-linecap="round"/></svg></div><div class="menu-empty-copy"><strong>一桌好菜，从这里开始</strong><p>挑几道喜欢的菜，<br>为今天添一点期待。</p></div><button data-page="dishes">去挑选菜品</button></div>`}<div class="menu-card-foot"><span></span>好好吃饭，慢慢生活<span></span></div></section>${selected.length ? `<div class="diary-compose"><label for="diary-note">写下这一餐 <span>选填</span></label><textarea id="diary-note" maxlength="200" placeholder="今天的饭，有什么想记下的？">${escapeText(state.diaryNote)}</textarea><button data-action="save-diary">保存到吃饭日记</button></div>` : ''}</div>
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
 app.innerHTML=`<div class="screen-scroll manage-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><span class="menu-kicker">把喜欢的菜留下来</span><h2>编辑菜单</h2><p>管理家里的菜，点菜时随心挑选</p></div><span>${dishes.length} 道菜</span></div><button class="beta-switch" data-action="switch-user">切换内测用户</button><div class="filter-switch manage-filter-switch" role="group" aria-label="编辑菜单筛选方式"><button data-manage-mode="category" aria-pressed="${state.manageFilterMode==='category'}">菜品分类</button><button data-manage-mode="cuisine" aria-pressed="${state.manageFilterMode==='cuisine'}">菜系</button></div><nav class="manage-filters" aria-label="${state.manageFilterMode==='category'?'菜品分类':'菜系'}筛选">${filters.map(value=>`<button data-manage-filter="${escapeText(value)}" aria-pressed="${state.manageFilter===value}">${escapeText(value)}</button>`).join('')}</nav><div class="manage-list" aria-label="筛选后的菜品">${filtered.length ? filtered.map(d=>`<article class="manage-dish"><img src="${escapeText(dishImage(d))}" alt=""><div class="manage-dish-copy"><strong>${escapeText(d.name)}</strong><span>${escapeText(d.category)}${d.cuisine !== '未分类' ? ' · ' + escapeText(d.cuisine) : ''}</span>${spiceBadge(d)}${d.is_available?'':'<span class="manage-unavailable">已下架</span>'}</div><button data-edit="${escapeText(d.id)}" aria-label="编辑${escapeText(d.name)}">编辑</button><button class="delete-dish" data-delete="${escapeText(d.id)}" aria-label="删除${escapeText(d.name)}">删除</button></article>`).join('') : `<div class="manage-empty">${dishes.length ? '这个分类暂时没有菜品' : '菜单还没有菜，先添加一道吧'}</div>`}</div></div><div class="manage-bottom"><button class="manage-add" data-action="new-dish">${icon('plus')} 添加菜品</button></div>`;
 bind();
}
function renderDishForm(){
 const dish = dishes.find(d=>d.id===state.editingId);
 const image = state.draftImage || dish?.image || 'tomato.jpg';
 app.className='phone-screen manage-screen';
 app.innerHTML=`<div class="screen-scroll form-scroll">${''}<div class="page-heading"><button data-page="manage" aria-label="返回编辑菜单">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><span class="menu-kicker">为餐桌添一道好菜</span><h2>${dish?'编辑菜品':'添加菜品'}</h2></div></div><form id="dish-form" class="dish-form"><label class="form-label" for="dish-name">菜品名称 <em>必填</em></label><input id="dish-name" name="name" maxlength="24" required placeholder="例如：番茄炒蛋" value="${escapeText(dish?.name || '')}"><label class="form-label" for="dish-category">菜品分类</label><select id="dish-category" name="category">${[...categories.slice(1), ...(dish?.category && !categories.includes(dish.category) ? [dish.category] : [])].map(c=>`<option value="${escapeText(c)}" ${dish?.category===c?'selected':''}>${escapeText(c)}</option>`).join('')}</select><label class="form-label" for="dish-cuisine">菜系</label><select id="dish-cuisine" name="cuisine">${[...cuisines, ...(dish?.cuisine && !cuisines.includes(dish.cuisine) ? [dish.cuisine] : [])].map(c=>`<option value="${escapeText(c)}" ${dish?.cuisine===c?'selected':''}>${escapeText(c)}</option>`).join('')}</select><div class="form-pair"><div><label class="form-label" for="dish-spice">辣度</label><select id="dish-spice" name="spice_level">${spiceLabels.map((label, level)=>`<option value="${level}" ${(dish?.spice_level ?? 0)===level?'selected':''}>${label}</option>`).join('')}</select></div><div><label class="form-label" for="dish-availability">上架状态</label><select id="dish-availability" name="is_available"><option value="true" ${dish?.is_available!==false?'selected':''}>上架</option><option value="false" ${dish?.is_available===false?'selected':''}>下架</option></select></div></div><label class="form-label" for="dish-note">一句介绍 <span>选填</span></label><input id="dish-note" name="note" maxlength="36" placeholder="写一句这道菜的味道" value="${escapeText(dish?.note || '')}"><div class="form-label">菜品封面</div><div class="cover-picker"><img id="cover-preview" src="${escapeText(dishImage({image}))}" alt="菜品封面预览"><div><strong>换一张喜欢的图片</strong><span>拍一张，或从相册挑选</span><div class="cover-actions"><label class="cover-upload">${icon('camera')}拍照<input type="file" accept="image/*" capture="environment"></label><label class="cover-upload">${icon('image')}从相册选择<input type="file" accept="image/*"></label></div></div></div><button class="form-save" type="submit">保存菜品</button></form></div>`;
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
  return `<article class="diary-card"><div class="diary-date"><strong>${escapeText(parts[2])}</strong><span>${escapeText(parts[0])}.${escapeText(parts[1])}</span></div><div class="diary-content"><div class="diary-card-title"><h3>${escapeText(entry.title)}</h3><span>${entry.dishes.length} 道菜</span></div><p class="diary-dishes">${entry.dishes.map(d=>escapeText(d.name)).join(' · ')}</p>${entry.note ? `<p class="diary-note">${escapeText(entry.note)}</p>` : ''}</div></article>`;
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
  if(!sb) throw new Error('云端不可用');
  const {data,error}=await sb.from('meal_history').select('*').order('meal_date',{ascending:false}).order('created_at',{ascending:false});
  if(error) throw error;
  if(request!==historyRequest)return;
  historyEntries=data.filter(e=>typeof e.meal_date==='string' && typeof e.title==='string' && Array.isArray(e.dishes) && e.dishes.every(d=>d && typeof d.name==='string'));
  idbSet(cacheKey('meal_history'),historyEntries).catch(()=>{});
 } catch (_) { if(request===historyRequest)historyError=true; }
 finally { if(request===historyRequest){historyLoading=false;if(state.page==='history')render();} }
}
async function saveHistory() {
 const selected=selectedDishes(); if(!selected.length)return;
 const entry={user_code:betaCode,id: typeof crypto.randomUUID==='function' ? crypto.randomUUID() : `meal-${Date.now()}-${Math.random().toString(36).slice(2)}`,meal_date:localDate(),title:state.title.trim() || '今天的菜单',note:state.diaryNote.trim(),dishes:selected.map(d=>({id:d.id,name:d.name}))};
 const button=app.querySelector('[data-action=save-diary]');button.disabled=true;button.textContent='保存中…';
 try {
  if(!sb)throw new Error('云端不可用');
  const {data,error}=await sb.from('meal_history').insert(entry).select().single();
  if(error)throw error;
  ++historyRequest;
  historyEntries=[data,...historyEntries.filter(e=>e.id!==data.id)];
  idbSet(cacheKey('meal_history'),historyEntries).catch(()=>{});
  notify('已保存到吃饭日记');
 } catch (_) { notify('日记保存失败，请检查网络或数据库'); }
 finally { if(button.isConnected){button.disabled=false;button.textContent='保存到吃饭日记';} }
}

function render(){if(state.page==='shared-create')renderSharedCreate();else if(state.page==='history')renderHistory();else if(state.page==='menu')renderMenu();else if(state.page==='surprise')renderSurprise();else if(state.page==='manage')renderManage();else if(state.page==='dish-form')renderDishForm();else renderDishes()}
function notify(message){const old=app.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;app.appendChild(el);setTimeout(()=>el.remove(),2400)}
