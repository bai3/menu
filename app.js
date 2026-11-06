const defaultDishes = [
  { id: 'tomato', name: '番茄炒蛋', category: '家常菜', note: '酸甜开胃，家的味道', image: 'tomato.jpg' },
  { id: 'pork', name: '红烧肉', category: '家常菜', note: '软糯入味，香气满满', image: 'pork.jpg' },
  { id: 'cucumber', name: '拍黄瓜', category: '清爽凉菜', note: '清脆爽口，百吃不厌', image: 'cucumber.jpg' },
  { id: 'fish', name: '清蒸鱼', category: '家常菜', note: '鲜嫩清甜，简单好味', image: 'fish.jpg' },
  { id: 'soup', name: '冬瓜排骨汤', category: '暖心汤羹', note: '清润鲜美，暖暖一碗', image: 'soup.jpg' },
  { id: 'shrimp', name: '蒜蓉虾', category: '家常菜', note: '鲜香入味，餐桌上的小惊喜', image: 'shrimp.jpg' }
];
const betaStorageKey = 'jiayan.beta-code.v1';
const urlBetaCode = new URLSearchParams(location.search).get('code');
let savedBetaCode = '';
try { savedBetaCode = localStorage.getItem(betaStorageKey) || ''; } catch (_) {}
const betaCode = (urlBetaCode !== null ? urlBetaCode : savedBetaCode).trim().toLowerCase();
const cacheKey = key => `${key}:${betaCode}`;
const isValidDish = (d) => d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.category === 'string' && typeof d.note === 'string' && typeof d.image === 'string';
const normalizeDish = d => ({...d, cuisine: typeof d.cuisine === 'string' && d.cuisine ? d.cuisine : '未分类', spice_level: Number.isInteger(d.spice_level) && d.spice_level >= 0 && d.spice_level <= 3 ? d.spice_level : 0, is_available: d.is_available !== false});
let dishes = [];
let dbPromise = null;
function openDB() {
 if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open('jiayan', 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => { dbPromise = null; reject(req.error || new Error('IndexedDB 不可用')); };
  req.onblocked = () => { dbPromise = null; reject(new Error('IndexedDB 被其他页面占用')); };
 });
 return dbPromise;
}
async function idbGet(key) {
 const db = await openDB();
 return new Promise((resolve, reject) => {
  const rq = db.transaction('kv', 'readonly').objectStore('kv').get(key);
  rq.onsuccess = () => resolve(rq.result);
  rq.onerror = () => reject(rq.error);
 });
}
async function idbSet(key, value) {
 const db = await openDB();
 return new Promise((resolve, reject) => {
  const rq = db.transaction('kv', 'readwrite').objectStore('kv').put(value, key);
  rq.onsuccess = () => resolve(true);
  rq.onerror = () => reject(rq.error);
 });
}
async function initDishes() {
 try {
  const stored = await idbGet(cacheKey('dishes'));
  if (Array.isArray(stored) && stored.every(isValidDish)) {
   dishes = stored.map(normalizeDish);
   if (state.page === 'dishes' || state.page === 'manage') render();
   if (document.querySelector('.paper-overlay')) renderPaperMenu();
  }
 } catch (_) { /* 读不到已存数据时保留内置菜单。 */ }
 await syncFromCloud();
 // Realtime cannot carry the per-user request header; refresh on return instead.
 window.addEventListener('focus', syncFromCloud);
 // 申请持久存储：避免浏览器在空间紧张时清理本地数据。
 try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
}
function dishImage(d) { return d.image.startsWith('data:image/') ? d.image : './public/assets/' + d.image; }
function saveLocalDishes(next) {
 dishes = next.map(normalizeDish);
 state.selected = state.selected.filter(id => dishes.some(d => d.id === id && d.is_available));
 idbSet(cacheKey('dishes'), dishes).catch(() => notify('保存失败，浏览器存储不可用'));
}
// 菜谱以云端为准；缓存仅供启动和离线查看。
const sb = (window.JIAYAN_SUPABASE && window.supabase) ? window.supabase.createClient(window.JIAYAN_SUPABASE.url, window.JIAYAN_SUPABASE.publishableKey, { global: { headers: { 'x-beta-code': betaCode } } }) : null;
const cloudFail = () => notify('云端保存失败，请联网后重试');
let dishChangeVersion = 0;
async function cloudUpsertDish(d) {
 dishChangeVersion++;
 if (!sb) { cloudFail(); return false; }
 try {
  const record = { user_code: betaCode, id: d.id, name: d.name, category: d.category, cuisine: d.cuisine, note: d.note, image: d.image, spice_level: d.spice_level, is_available: d.is_available };
  let { error } = await sb.from('dishes').upsert(record);
  if (error && (error.code === 'PGRST204' || error.code === '42703') && /cuisine/i.test(error.message || '')) {
   if (d.cuisine !== '未分类') { notify('请先更新云端数据库，才能保存菜系'); return false; }
   const { cuisine, ...legacyRecord } = record;
   ({ error } = await sb.from('dishes').upsert(legacyRecord));
  }
  if (error) throw error;
  return true;
 } catch (_) { cloudFail(); return false; }
}
async function cloudDeleteDish(id) {
 dishChangeVersion++;
 if (!sb) { cloudFail(); return false; }
 try {
  const { error } = await sb.from('dishes').delete().eq('id', id);
  if (error) throw error;
  return true;
 } catch (_) { cloudFail(); return false; }
}
// 启动时只从云端更新缓存；旧缓存不能作为需要上传的菜品。
async function syncFromCloud() {
 if (!sb) return;
 const version = dishChangeVersion;
 try {
  const { data, error } = await sb.from('dishes').select('*').order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  const cloudDishes = data.map(normalizeDish);
  if (!cloudDishes.every(isValidDish)) throw new Error('云端菜谱格式无效');
  if (version !== dishChangeVersion) return;
  saveLocalDishes(cloudDishes);
  if (state.page === 'dishes' || state.page === 'manage') render();
  if (document.querySelector('.paper-overlay')) renderPaperMenu();
 } catch (_) { notify('云端暂不可达，当前显示本机菜谱'); }
}
// 实时订阅：家人增删改菜，本机即时生效。自己写入的回声与本地一致时跳过，避免无谓重渲染。
function subscribeRealtime() {
 if (!sb) return;
 sb.channel('jiayan-dishes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, (payload) => {
   dishChangeVersion++;
   if (payload.eventType === 'DELETE') {
    const id = payload.old?.id;
    if (!id || !dishes.some(d => d.id === id)) return; // 自己删除的回声
    saveLocalDishes(dishes.filter(d => d.id !== id));
   } else {
    const d = normalizeDish(payload.new);
    if (!isValidDish(d)) return;
    const old = dishes.find(x => x.id === d.id);
    if (old && old.name === d.name && old.category === d.category && old.cuisine === d.cuisine && old.note === d.note && old.image === d.image && old.spice_level === d.spice_level && old.is_available === d.is_available) return; // 回声
    saveLocalDishes(old ? dishes.map(x => x.id === d.id ? d : x) : [...dishes, d]);
   }
   // 表单中的草稿尚未写入 state，重绘会清空用户输入。
   if (state.page !== 'dish-form') render();
   if (document.querySelector('.paper-overlay')) renderPaperMenu();
  })
  .subscribe();
}
const categories = ['全部', '家常菜', '清爽凉菜', '暖心汤羹', '主食', '饮品', '甜点', '小吃', '火锅', '烧烤', '其他'];
const cuisines = ['未分类', '川菜', '鲁菜', '粤菜', '苏菜', '浙菜', '闽菜', '湘菜', '徽菜', '东北菜', '西北菜', '京菜', '日料', '韩料', '泰餐', '越南菜', '印度菜', '法餐', '意餐', '美式料理', '其他'];
function dishImage(d) { return d.image.startsWith('data:image/') ? d.image : './public/assets/' + d.image; }
const state = { diaryNote: '', page: 'dishes', category: '全部', filterMode: 'category', manageFilterMode: 'category', manageFilter: '全部', query: '', selected: [], title: '今天的菜单', editingId: null, draftImage: null };
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
function nav(){return `<nav class="nav" aria-label="页面导航"><button data-page="dishes" class="${state.page==='dishes'?'active':''}" ${state.page==='dishes'?'aria-current="page"':''}>${icon('basket')}<span>点菜</span></button><button data-page="menu" class="${state.page==='menu'?'active':''}" ${state.page==='menu'?'aria-current="page"':''}>${icon('menu')}<span>菜单</span></button></nav>`}
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
function renderDishes(){
 const field = state.filterMode === 'category' ? 'category' : 'cuisine';
 const options = state.filterMode === 'category' ? categories.slice(1) : cuisines;
 const present = new Set(dishes.map(d => d[field]));
 const filters = ['全部', ...options.filter(value => present.has(value)), ...[...present].filter(value => value && !options.includes(value))];
 const filtered = dishes.filter(d => (state.category==='全部'||d[field]===state.category) && `${d.name}${d.category}${d.cuisine}${d.note}`.includes(state.query.trim()));
 app.className='phone-screen';
 app.innerHTML=`<div class="screen-scroll">${''}<header class="topbar"><div class="top-brand">${logo}<div><strong>白家私厨</strong><small>把喜欢的菜端上桌</small></div></div></header>
 ${heroMarkup()}
 <div class="section-title"><div><h2>今天吃什么？</h2><p>挑几道喜欢的菜，凑成一桌好饭</p></div><button class="manage-entry" data-page="manage">${icon('edit')} 编辑菜单</button></div>
 <button class="paper-entry" data-action="paper-mode"><span><small>THE FAMILY MENU</small><strong>翻开纸质菜单</strong><em>像在餐厅一样，慢慢挑选</em></span><span class="paper-entry-mark" aria-hidden="true">菜单<br><i>MENU</i></span><b>打开菜单</b></button>
 <label class="search">${icon('search')}<input type="search" placeholder="搜索想吃的菜" value="${escapeText(state.query)}" aria-label="搜索想吃的菜"></label>
 <div class="filter-switch" role="group" aria-label="筛选方式"><button data-filter-mode="category" aria-pressed="${state.filterMode==='category'}">菜品分类</button><button data-filter-mode="cuisine" aria-pressed="${state.filterMode==='cuisine'}">菜系</button></div>
 <div class="catalog"><nav class="filters" aria-label="${state.filterMode==='category'?'菜品分类':'菜系'}">${filters.map(c=>{const selectedCount=selectedDishes().filter(d=>c==='全部'||d[field]===c).length;return `<button class="filter ${state.category===c?'active':''}" data-category="${c}" aria-pressed="${state.category===c}"><span class="filter-name">${c}</span>${selectedCount ? `<span class="filter-count">${selectedCount}</span>` : ''}</button>`}).join('')}</nav>
 <section class="catalog-content" aria-label="${state.category}菜品"><div class="catalog-heading"><h3>${state.category==='全部'?'全部菜品':state.category}</h3><span>${filtered.length} 道菜</span></div><div class="dish-list">${filtered.length ? filtered.map(d=>`<article class="dish ${d.is_available?'':'dish-unavailable'}"><img class="dish-img" src="${escapeText(dishImage(d))}" alt="${escapeText(d.name)}" onerror="this.style.visibility='hidden'"><div class="dish-info"><h3>${escapeText(d.name)} ${spiceBadge(d)}</h3><p>${escapeText(d.note)}</p><span class="dish-tag">${escapeText(d.category)}${d.cuisine !== '未分类' ? ' · ' + escapeText(d.cuisine) : ''}</span>${d.is_available?'':'<span class="unavailable-label">已下架</span>'}</div><button class="add ${state.selected.includes(d.id)?'selected':''}" data-dish="${escapeText(d.id)}" aria-label="${state.selected.includes(d.id)?'移除':'选择'}${escapeText(d.name)}" aria-pressed="${state.selected.includes(d.id)}" ${d.is_available?'':'disabled'}>${icon(state.selected.includes(d.id)?'check':'plus')}</button></article>`).join('') : '<div class="empty">没有找到这道菜<br>换个关键词试试吧</div>'}</div></section></div></div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" aria-label="${state.selected.length ? `已选${state.selected.length}道菜，下单` : '请先选择菜品'}" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
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

function render(){if(state.page==='history')renderHistory();else if(state.page==='menu')renderMenu();else if(state.page==='manage')renderManage();else if(state.page==='dish-form')renderDishForm();else renderDishes()}
function notify(message){const old=app.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;app.appendChild(el);setTimeout(()=>el.remove(),2400)}

const menuImageStyles = [
 {id:'paper', name:'家常小票', caption:'把这一餐，认真记下来'},
 {id:'bistro', name:'今日食堂', caption:'今天也要吃得有滋有味'},
 {id:'picnic', name:'野餐时光', caption:'把快乐摆上餐桌'},
 {id:'night', name:'深夜食堂', caption:'为每一个平凡的夜晚干杯'},
 {id:'banquet', name:'团圆家宴', caption:'把团圆的滋味端上桌'},
 {id:'garden', name:'春日餐桌', caption:'给生活添一点清新'},
 {id:'postcard', name:'餐桌来信', caption:'把这一餐寄给喜欢的人'}
];

async function drawMenuImage(selected, style){
 if(style.id !== 'paper') return drawDesignedMenu(selected, style.id);
 const width=1080, height=560+selected.length*96;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 // Texture is loaded from the project so the exported image remains self-contained.
 const paper = await new Promise(resolve=>{
   const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>resolve(null);
   image.src='./public/assets/menu-paper.jpg';
 });
 const surface=ctx.createLinearGradient(0,0,width,height);
 surface.addColorStop(0,'#ead6c6');surface.addColorStop(.55,'#e5cbb6');surface.addColorStop(1,'#d8b69e');
 ctx.fillStyle=surface;ctx.fillRect(0,0,width,height);
 // A soft cast shadow and irregular cut edge give the slip depth without obscuring text.
 const edge=()=>{ctx.beginPath();ctx.moveTo(70,48);ctx.lineTo(width-70,48);ctx.lineTo(width-70,height-63);
   for(let x=width-70;x>=70;x-=20)ctx.lineTo(x,height-(Math.round((width-70-x)/20)%2?49:63));ctx.lineTo(70,48);ctx.closePath()};
 ctx.save();ctx.shadowColor='rgba(84,49,32,.24)';ctx.shadowBlur=30;ctx.shadowOffsetX=6;ctx.shadowOffsetY=14;
 ctx.fillStyle='#fff9ed';edge();ctx.fill();ctx.restore();
 ctx.save();edge();ctx.clip();ctx.fillStyle='#fff9ed';ctx.fillRect(70,48,width-140,height-96);
 if(paper){
   const scale=Math.max((width-140)/paper.width,(height-96)/paper.height);
   const pw=paper.width*scale,ph=paper.height*scale;
   ctx.globalAlpha=.68;ctx.drawImage(paper,(width-pw)/2,(height-ph)/2,pw,ph);ctx.globalAlpha=1;
 }
 const light=ctx.createLinearGradient(0,48,width,height-48);
 light.addColorStop(0,'rgba(255,255,255,.16)');light.addColorStop(.6,'rgba(255,255,255,.02)');light.addColorStop(1,'rgba(124,75,43,.035)');
 ctx.fillStyle=light;ctx.fillRect(70,48,width-140,height-96);ctx.restore();
 // Draw the brand mark directly at export resolution so it stays crisp.
 ctx.save();ctx.translate(430,126);ctx.scale(1.2,1.2);ctx.strokeStyle='#b9523e';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(-30,0);ctx.lineTo(30,0);ctx.bezierCurveTo(27,23,15,32,0,32);ctx.bezierCurveTo(-15,32,-27,23,-30,0);ctx.stroke();
 [-16,0,16].forEach(x=>{ctx.beginPath();ctx.moveTo(x,-10);ctx.bezierCurveTo(x-6,-19,x+5,-22,x,-31);ctx.stroke()});ctx.restore();
 ctx.textAlign='left';ctx.fillStyle='#b9523e';ctx.font='bold 42px "Songti SC", "STSong", serif';ctx.fillText('白家私厨',482,140);
 ctx.strokeStyle='#d9b7a4';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(130,225);ctx.lineTo(width-130,225);ctx.stroke();ctx.setLineDash([]);
 let y=302;
 selected.forEach((dish,i)=>{
   ctx.textAlign='left';ctx.fillStyle='#c7745c';ctx.font='26px "PingFang SC", sans-serif';ctx.fillText(String(i+1).padStart(2,'0'),150,y);
   ctx.fillStyle='#4e392f';ctx.font='42px "Songti SC", "STSong", serif';ctx.fillText(dish.name,225,y,600);
   ctx.strokeStyle='#f0e4d9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(225,y+31);ctx.lineTo(width-150,y+31);ctx.stroke();y+=96;
 });
 const line=height-220;ctx.strokeStyle='#d9b7a4';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(130,line);ctx.lineTo(width-130,line);ctx.stroke();ctx.setLineDash([]);
 ctx.textAlign='left';ctx.fillStyle='#8b6a57';ctx.font='28px "PingFang SC", sans-serif';ctx.fillText('本餐合计',150,line+65);
 ctx.textAlign='right';ctx.fillStyle='#b9523e';ctx.font='bold 38px "PingFang SC", sans-serif';ctx.fillText(selected.length+' 道菜',width-150,line+65);
 ctx.textAlign='center';ctx.fillStyle='#b49784';ctx.font='26px "Songti SC", "STSong", serif';ctx.fillText('好好吃饭  ·  好好生活',width/2,height-94);
 return canvas;
}

function drawDesignedMenu(selected, style){
 const width=1080, height=650+selected.length*108;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');
 const serif='"Songti SC", "STSong", serif', sans='"PingFang SC", sans-serif';
 const themes={
  bistro:{bg:'#e4e4d8',paper:'#f7f5ea',ink:'#203a31',accent:'#a74634',muted:'#768579',rule:'#cbd0c1',title:'今日食堂',sub:'一桌好菜，一起吃饭',en:'THE FAMILY TABLE'},
  picnic:{bg:'#e9c6b5',paper:'#fcf6ec',ink:'#5e3c31',accent:'#b95943',muted:'#ad8877',rule:'#ead6c9',title:'今天吃点好的',sub:'把喜欢的味道摆上餐桌',en:'A LITTLE TABLE OF JOY'},
  night:{bg:'#192b28',paper:'#203b34',ink:'#f3ead5',accent:'#d9b67e',muted:'#afbea9',rule:'#5e7667',title:'餐桌有你',sub:'夜晚有灯，饭菜有香',en:'THE EVENING TABLE'},
  banquet:{bg:'#89372e',paper:'#f9efdb',ink:'#67372e',accent:'#ae4b39',muted:'#a4866e',rule:'#ddc1aa',title:'团圆家宴',sub:'人间烟火，欢喜相聚',en:'A FAMILY FEAST'},
  garden:{bg:'#d8e2d2',paper:'#f5f7ec',ink:'#364e39',accent:'#688b68',muted:'#889b84',rule:'#cad9c7',title:'春日餐桌',sub:'日子清甜，饭菜新鲜',en:'FROM OUR LITTLE GARDEN'},
  postcard:{bg:'#cad9d7',paper:'#fbf7ec',ink:'#384f50',accent:'#b86a52',muted:'#859998',rule:'#ccd9d2',title:'餐桌来信',sub:'亲爱的，今天也要好好吃饭',en:'A NOTE FROM OUR KITCHEN'}
 };
 const p=themes[style];
 const text=(value,x,y,size,color,opt={})=>{ctx.fillStyle=color;ctx.textAlign=opt.align||'left';ctx.font=`${opt.bold?'600 ':''}${size}px ${opt.serif?serif:sans}`;ctx.fillText(value,x,y,opt.maxWidth||1080)};
 const line=(x1,y1,x2,y2,color,w=2)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
 const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()};
 // A restrained frame and soft paper shadow give each design the feel of printed stationery.
 ctx.fillStyle=p.bg;ctx.fillRect(0,0,width,height);
 ctx.save();ctx.shadowColor='rgba(39,35,25,.12)';ctx.shadowBlur=28;ctx.shadowOffsetY=10;ctx.fillStyle=p.paper;ctx.fillRect(40,38,1000,height-76);ctx.restore();
 if(style==='bistro'){
  ctx.fillStyle=p.ink;ctx.fillRect(40,38,1000,74);
  text('白家私厨',82,87,27,p.paper,{serif:true,bold:true});text('EST. AT HOME',998,86,20,'#b7c7b4',{align:'right'});
  text(p.en,95,169,21,p.accent,{bold:true});text(p.title,90,260,76,p.ink,{serif:true,bold:true});text(p.sub,96,307,27,p.muted,{serif:true});
  ctx.strokeStyle='#bf8e78';ctx.lineWidth=3;ctx.beginPath();ctx.arc(858,224,78,0,Math.PI*2);ctx.arc(858,224,62,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle=p.ink;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(831,255);ctx.quadraticCurveTo(858,227,878,192);ctx.moveTo(855,232);ctx.quadraticCurveTo(832,225,837,208);ctx.quadraticCurveTo(856,207,861,222);ctx.moveTo(864,217);ctx.quadraticCurveTo(858,197,879,194);ctx.quadraticCurveTo(888,209,869,221);ctx.stroke();
 }else if(style==='picnic'){
  ctx.fillStyle='#cf8a72';ctx.fillRect(40,38,1000,15);ctx.fillRect(40,height-53,1000,15);
  text(p.en,540,126,21,p.accent,{align:'center',bold:true});text(p.title,540,229,69,p.ink,{align:'center',serif:true,bold:true});text(p.sub,540,277,27,p.muted,{align:'center',serif:true});
  ctx.save();ctx.translate(163,208);ctx.rotate(-.2);circle(0,0,35,'#c36c51');circle(43,28,27,'#dc9172');ctx.strokeStyle='#728260';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-34);ctx.quadraticCurveTo(-9,-57,12,-65);ctx.moveTo(43,1);ctx.quadraticCurveTo(46,-17,61,-20);ctx.stroke();ctx.restore();
  ctx.save();ctx.translate(910,220);ctx.rotate(.5);ctx.fillStyle='#8da681';ctx.beginPath();ctx.ellipse(0,0,15,54,0,0,Math.PI*2);ctx.fill();ctx.rotate(-.9);ctx.beginPath();ctx.ellipse(23,0,14,43,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }else if(style==='night'){
  ctx.strokeStyle='#738777';ctx.lineWidth=2;ctx.strokeRect(58,56,964,height-112);
  text('白家私厨  /  HOME KITCHEN',94,112,22,p.accent,{bold:true});text('夜晚有灯',94,181,28,p.muted,{serif:true});text(p.title,90,260,76,p.ink,{serif:true,bold:true});text('THE COMFORT OF A HOME-COOKED MEAL',96,310,19,p.muted);
  ctx.strokeStyle=p.accent;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(770,219);ctx.lineTo(946,219);ctx.bezierCurveTo(939,301,898,322,858,322);ctx.bezierCurveTo(817,322,776,301,770,219);ctx.stroke();[816,858,900].forEach(x=>{ctx.beginPath();ctx.moveTo(x,200);ctx.bezierCurveTo(x-12,182,x+12,170,x,151);ctx.stroke()});
 }else if(style==='banquet'){
  ctx.strokeStyle='#cbab90';ctx.lineWidth=2;ctx.strokeRect(58,56,964,height-112);ctx.strokeRect(66,64,948,height-128);
  text('白 家 私 厨  ·  家 宴',540,124,23,p.accent,{align:'center',bold:true});text(p.title,540,229,78,p.ink,{align:'center',serif:true,bold:true});text(p.sub,540,279,27,p.muted,{align:'center',serif:true});
  line(142,193,230,193,p.rule,2);line(850,193,938,193,p.rule,2);
  ctx.fillStyle=p.accent;ctx.fillRect(862,245,50,50);text('家',887,281,32,p.paper,{align:'center',serif:true,bold:true});
 }else if(style==='garden'){
  text('白家私厨   /   BAI JIA',96,112,22,p.accent,{bold:true});text(p.title,90,229,76,p.ink,{serif:true,bold:true});text(p.sub,96,278,27,p.muted,{serif:true});
  ctx.strokeStyle='#89a781';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(754,319);ctx.quadraticCurveTo(846,246,926,112);ctx.stroke();
  [[790,290,-.8],[828,252,.8],[861,211,-.8],[892,166,.8],[919,124,-.8]].forEach(([x,y,r],i)=>{ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.fillStyle=i%2?'#91ad87':'#b4c8a7';ctx.beginPath();ctx.ellipse(0,0,16,38,0,0,Math.PI*2);ctx.fill();ctx.restore()});circle(943,110,11,'#c8ad6f');
 }else{
  // Perforated stamp and air-mail stripes, kept subtle like vintage stationery.
  ctx.save();ctx.beginPath();ctx.rect(40,38,1000,13);ctx.rect(40,height-51,1000,13);ctx.clip();for(let x=20;x<1080;x+=76){ctx.fillStyle=(Math.floor(x/76)%2)?'#9db9b4':'#cf927b';ctx.beginPath();ctx.moveTo(x,30);ctx.lineTo(x+32,30);ctx.lineTo(x+5,70);ctx.lineTo(x-27,70);ctx.fill();ctx.beginPath();ctx.moveTo(x,height-60);ctx.lineTo(x+32,height-60);ctx.lineTo(x+5,height-20);ctx.lineTo(x-27,height-20);ctx.fill()}ctx.restore();
  text(p.en,96,119,21,p.accent,{bold:true});text(p.title,90,226,76,p.ink,{serif:true,bold:true});text(p.sub,96,278,27,p.muted,{serif:true});
  ctx.strokeStyle='#c69a83';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.strokeRect(820,105,120,120);ctx.setLineDash([]);text('家',880,178,44,p.accent,{align:'center',serif:true});text('HOME',880,203,18,p.muted,{align:'center'});
 }
 const left=104,right=976,top=353;
 line(left,top,right,top,p.rule,2);
 text('今 日 菜 单',left,top+42,23,p.muted,{bold:true});
 text('MENU  /  '+String(selected.length).padStart(2,'0'),right,top+42,20,p.muted,{align:'right'});
 selected.forEach((dish,i)=>{
  const y=top+115+i*108;
  text(String(i+1).padStart(2,'0'),left,y,23,p.accent,{bold:true});
  text(dish.name,left+76,y+2,42,p.ink,{serif:true,maxWidth:740});
  line(left+76,y+35,right,y+35,p.rule,1);
 });
 const footer=height-91;
 text('白家私厨  ·  好好吃饭',left,footer,24,p.muted,{serif:true});
 text(`${selected.length} 道菜`,right,footer,26,p.accent,{align:'right',bold:true});
 return canvas;
}

async function saveMenuImage(){
 const selected=selectedDishes(); if(!selected.length)return;
 const saveBtn=app.querySelector('[data-action=save]');
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='生成中…'}
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 let imageUrl=null;
 try{
  const overlay=document.createElement('div');overlay.className='image-overlay';
  overlay.innerHTML=`<div class="image-dialog" role="dialog" aria-modal="true" aria-label="菜单图片预览"><div class="image-dialog-head"><div><strong>菜单图片</strong><span>左右滑动，挑一张喜欢的菜单</span></div><button class="image-close" aria-label="关闭预览">${icon('close')}</button></div><div class="image-preview"><img alt="生成的家庭菜单图片" draggable="false"></div><div class="image-style-picker"><button class="image-style-prev" type="button" aria-label="上一种样式"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button><div class="image-style-label" aria-live="polite"><strong></strong><span></span></div><button class="image-style-next" type="button" aria-label="下一种样式"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button></div><div class="image-style-dots" aria-label="选择图片样式">${menuImageStyles.map((style,i)=>`<button type="button" aria-label="${style.name}" data-style="${i}"></button>`).join('')}</div><div class="image-actions"><button class="image-save" type="button" hidden>保存到相册</button><a class="image-download" download="白家私厨菜单.jpg">下载图片</a></div><p class="image-save-hint">也可以长按图片保存</p></div>`;
  document.body.appendChild(overlay);
  let index=0, file=null, version=0, closed=false;
  const img=overlay.querySelector('.image-preview img'), download=overlay.querySelector('.image-download'), share=overlay.querySelector('.image-save');
  const changeStyle=async next=>{
   index=(next+menuImageStyles.length)%menuImageStyles.length;
   const current=++version, style=menuImageStyles[index];
   overlay.querySelector('.image-style-label strong').textContent=style.name;
   overlay.querySelector('.image-style-label span').textContent=style.caption;
   overlay.querySelectorAll('[data-style]').forEach((dot,i)=>{dot.classList.toggle('active',i===index);dot.setAttribute('aria-pressed',String(i===index))});
   download.removeAttribute('href');share.hidden=true;
   try{
    const canvas=await drawMenuImage(selected,style);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
    if(!blob)throw new Error('image encoding failed');
    if(closed||current!==version)return;
    const nextUrl=URL.createObjectURL(blob), previousUrl=imageUrl;imageUrl=nextUrl;
    file=new File([blob],`白家私厨菜单-${style.name}.jpg`,{type:'image/jpeg'});
    img.src=nextUrl;img.alt=`${style.name}菜单图片`;download.href=nextUrl;download.download=file.name;
    share.hidden=!(typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}));
    if(previousUrl)URL.revokeObjectURL(previousUrl);
   }catch(_){if(!closed&&current===version)notify('生成菜单图片失败，请重试')}
  };
  const close=()=>{closed=true;overlay.remove();if(imageUrl)URL.revokeObjectURL(imageUrl);document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close();else if(e.key==='ArrowLeft')changeStyle(index-1);else if(e.key==='ArrowRight')changeStyle(index+1)};
  share.onclick=async()=>{if(!file)return;try{await navigator.share({files:[file],title:'白家私厨菜单',text:'好好吃饭，慢慢生活'});close()}catch(err){if(err&&err.name!=='AbortError')notify('未能调起系统保存，试试长按图片')}};
  overlay.querySelector('.image-close').onclick=close;
  overlay.onclick=e=>{if(e.target===overlay)close()};
  overlay.querySelector('.image-style-prev').onclick=()=>changeStyle(index-1);
  overlay.querySelector('.image-style-next').onclick=()=>changeStyle(index+1);
  overlay.querySelectorAll('[data-style]').forEach(dot=>dot.onclick=()=>changeStyle(Number(dot.dataset.style)));
  let touch=null;const preview=overlay.querySelector('.image-preview');
  preview.addEventListener('touchstart',e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
  preview.addEventListener('touchend',e=>{if(!touch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.25)changeStyle(index+(dx<0?1:-1))},{passive:true});
  document.addEventListener('keydown',onKey);overlay.querySelector('.image-close').focus();
  await changeStyle(0);
 }catch(_){notify('生成菜单图片失败，请重试')}
 finally{if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='保存菜单图片'}}
}


// The restaurant menu is a second way to browse the same live catalogue and order.
let paperPage = 0;
let paperTurning = false;
let paperTurnTimer = null;
let pendingPaperTap = null;
function paperPages() {
 const field = state.filterMode === 'cuisine' ? 'cuisine' : 'category';
 const options = field === 'cuisine' ? cuisines : categories.slice(1);
 const groups = [...options, ...new Set(dishes.map(d => d[field]).filter(value => value && !options.includes(value)))];
 const pages = [];
 groups.forEach(group => {
  const items = dishes.filter(d => d[field] === group && d.is_available);
  for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
 });
 if (!pages.length) pages.push([]);
 if (pages.length % 2) pages.push([]);
 return pages;
}
function paperLeaf(items, pageNumber) {
 const field = state.filterMode === 'cuisine' ? 'cuisine' : 'category';
 return `<section class="paper-leaf ${pageNumber % 2 ? 'paper-leaf-right' : 'paper-leaf-left'}"><div class="paper-leaf-inner"><header class="paper-leaf-head"><span>白家私厨</span><span>THE FAMILY MENU</span></header><div class="paper-leaf-title"><span>THE TASTE OF HOME</span><h2>${items.length ? escapeText(items[0][field]) : '家的味道'}</h2><i></i></div><div class="paper-dishes">${items.length ? items.map((d, index) => `<article class="paper-dish paper-dish-${index + 1}" role="button" tabindex="0" data-paper-dish="${escapeText(d.id)}" aria-label="${escapeText(d.name)}，单击加入菜单，双击取消"><img src="${escapeText(dishImage(d))}" alt="" onerror="this.style.visibility='hidden'"><div class="paper-dish-copy"><span>${escapeText(d[field])}</span><h3>${escapeText(d.name)} ${spiceBadge(d)}</h3><p>${escapeText(d.note || '用心烹调，与你分享')}</p></div></article>`).join('') : '<div class="paper-blank">好好吃饭<br><span>慢慢生活</span></div>'}</div><footer class="paper-leaf-foot"><span>一餐一饭，皆是欢喜</span></footer></div></section>`;
}
function openPaperMenu() {
 paperPage = 0;
 document.body.classList.add('paper-open');
 const overlay = document.createElement('div');
 overlay.className = 'paper-overlay';
 overlay.setAttribute('role', 'dialog');
 overlay.setAttribute('aria-modal', 'true');
 overlay.setAttribute('aria-label', '纸质菜单，滑动或点击页面边缘翻页');
 overlay.onkeydown = e => { if (e.key === 'ArrowLeft') turnPaperPage(-1); else if (e.key === 'ArrowRight') turnPaperPage(1); else if (e.key === 'Escape') closePaperMenu(); };
 document.body.appendChild(overlay);
 renderPaperMenu();
 overlay.querySelector('[data-paper-close]').focus();
}
function renderPaperMenu() {
 const overlay = document.querySelector('.paper-overlay');
 if (!overlay) return;
 const pages = paperPages();
 paperPage = Math.max(0, Math.min(paperPage, pages.length / 2 - 1));
 overlay.innerHTML = `<div class="paper-stage"><header class="paper-toolbar"><button type="button" data-paper-close aria-label="返回菜品列表">返回列表</button><div><strong>白家私厨</strong><span> · 纸质菜单</span></div><span class="paper-toolbar-spacer" aria-hidden="true"></span></header><div class="paper-book-wrap"><div class="paper-book" aria-live="polite">${paperLeaf(pages[paperPage * 2], paperPage * 2)}${paperLeaf(pages[paperPage * 2 + 1], paperPage * 2 + 1)}</div></div></div>`;
 overlay.querySelector('[data-paper-close]').onclick = closePaperMenu;
 let touchStart = null;
 const book = overlay.querySelector('.paper-book');
 const activatePaperDish = dish => {
  const id = dish.dataset.paperDish;
  if (!dishes.some(d => d.id === id && d.is_available)) return;
  if (pendingPaperTap && pendingPaperTap.id === id) {
   clearTimeout(pendingPaperTap.timer);
   pendingPaperTap = null;
   state.selected = state.selected.filter(selectedId => selectedId !== id);
   showPaperFeedback(id, false);
   return;
  }
  flushPaperTap();
  pendingPaperTap = { id, timer: setTimeout(flushPaperTap, 350) };
 };
 book.onclick = e => {
  const dish = e.target.closest('[data-paper-dish]');
  if (dish) { activatePaperDish(dish); return; }
  const rect = book.getBoundingClientRect();
  const rotated = matchMedia('(orientation: portrait)').matches;
  const position = rotated ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
  if (position < .18) turnPaperPage(-1);
  else if (position > .82) turnPaperPage(1);
 };
 book.addEventListener('keydown', e => {
  const dish = e.target.closest('[data-paper-dish]');
  if (dish && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activatePaperDish(dish); }
 });
 book.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { touchStart = null; return; }
  const touch = e.changedTouches[0];
  touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
 }, { passive: true });
 book.addEventListener('touchmove', e => {
  if (!touchStart) return;
  const touch = Array.from(e.changedTouches).find(item => item.identifier === touchStart.id);
  if (!touch) return;
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  const delta = matchMedia('(orientation: portrait)').matches ? dy : dx;
  const cross = matchMedia('(orientation: portrait)').matches ? dx : dy;
  if (Math.abs(delta) > 10 && Math.abs(delta) > Math.abs(cross)) e.preventDefault();
 }, { passive: false });
 book.addEventListener('touchend', e => {
  if (!touchStart) return;
  const touch = Array.from(e.changedTouches).find(item => item.identifier === touchStart.id);
  if (!touch) return;
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  touchStart = null;
  // The rotated portrait layout maps the book's horizontal axis to screen Y.
  const rotated = matchMedia('(orientation: portrait)').matches;
  const delta = rotated ? dy : dx, cross = rotated ? dx : dy;
  if (Math.abs(delta) > 45 && Math.abs(delta) > Math.abs(cross)) {
   e.preventDefault(); // Do not also treat the swipe as an edge tap.
   turnPaperPage(delta < 0 ? 1 : -1);
  }
 }, { passive: false });
 book.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
}
function showPaperFeedback(id, added) {
 const stage = document.querySelector('.paper-stage');
 const dish = dishes.find(item => item.id === id);
 if (!stage || !dish) return;
 stage.querySelector('.paper-feedback-message')?.remove();
 const message = document.createElement('div');
 message.className = 'paper-feedback-message';
 message.setAttribute('role', 'status');
 const title = document.createElement('strong');
 title.textContent = added ? '已加入菜单' : '已取消';
 const name = document.createElement('span');
 name.textContent = dish.name;
 message.append(title, name);
 stage.appendChild(message);
 setTimeout(() => message.remove(), 1600);
}
function flushPaperTap() {
 if (!pendingPaperTap) return;
 const { id, timer } = pendingPaperTap;
 clearTimeout(timer);
 pendingPaperTap = null;
 if (!dishes.some(d => d.id === id && d.is_available)) return;
 if (!state.selected.includes(id)) state.selected.push(id);
 showPaperFeedback(id, true);
}
function turnPaperPage(direction) {
 const pages = paperPages();
 const next = paperPage + direction;
 if (paperTurning || next < 0 || next >= pages.length / 2) return;
 const book = document.querySelector('.paper-book');
 if (!book) return;
 flushPaperTap();
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paperPage = next; renderPaperMenu(); return; }
 paperTurning = true;
 book.classList.add('is-turning');
 const currentSide = direction > 0 ? '.paper-leaf-right' : '.paper-leaf-left';
 const front = book.querySelector(currentSide).cloneNode(true);
 const backIndex = direction > 0 ? next * 2 : next * 2 + 1;
 const underIndex = direction > 0 ? next * 2 + 1 : next * 2;
 const sheet = document.createElement('div');
 sheet.className = `paper-sheet ${direction > 0 ? 'turn-forward' : 'turn-backward'}`;
 sheet.setAttribute('aria-hidden', 'true');
 sheet.innerHTML = `<div class="paper-sheet-face paper-sheet-front"></div><div class="paper-sheet-face paper-sheet-back">${paperLeaf(pages[backIndex], backIndex)}</div>`;
 sheet.querySelector('.paper-sheet-front').appendChild(front);
 sheet.querySelectorAll('button, [tabindex]').forEach(element => { element.tabIndex = -1; });
 // Reveal the next stationary page beneath the turning sheet; the reverse of
 // the sheet carries the adjacent page, so there is no blank half-turn.
 const oldLeaf = book.querySelector(currentSide);
 oldLeaf.insertAdjacentHTML('beforebegin', paperLeaf(pages[underIndex], underIndex));
 oldLeaf.remove();
 book.appendChild(sheet);
 paperTurnTimer = setTimeout(() => { paperPage = next; paperTurning = false; renderPaperMenu(); }, 900);
}
function closePaperMenu() {
 flushPaperTap();
 document.querySelector('.paper-overlay')?.remove();
 document.body.classList.remove('paper-open');
 clearTimeout(paperTurnTimer);
 paperTurning = false;
 if (state.page === 'dishes') { render(); app.querySelector('[data-action=paper-mode]')?.focus(); }
}

function bind(){
 bindHero();
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render();if(state.page==='history')loadHistory()});
 app.querySelectorAll('[data-manage-mode]').forEach(b=>b.onclick=()=>{state.manageFilterMode=b.dataset.manageMode;state.manageFilter='全部';render()});
 app.querySelectorAll('[data-manage-filter]').forEach(b=>b.onclick=()=>{state.manageFilter=b.dataset.manageFilter;render();app.querySelector('[data-manage-filter][aria-pressed=true]')?.focus({preventScroll:true})});
 app.querySelectorAll('[data-filter-mode]').forEach(b=>b.onclick=()=>{const scroll=app.querySelector('.screen-scroll').scrollTop;state.filterMode=b.dataset.filterMode;state.category='全部';render();app.querySelector('.screen-scroll').scrollTop=scroll});
 app.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{const scroll=app.querySelector('.screen-scroll').scrollTop;state.category=b.dataset.category;render();app.querySelector('.screen-scroll').scrollTop=scroll});
 app.querySelectorAll('[data-dish]').forEach(b=>b.onclick=()=>{const id=b.dataset.dish;if(!dishes.some(d=>d.id===id && d.is_available))return;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];const scroll=app.querySelector('.screen-scroll').scrollTop;render();app.querySelector('.screen-scroll').scrollTop=scroll});
 app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.selected=state.selected.filter(x=>x!==b.dataset.remove);render()});
 app.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;state.draftImage=null;state.page='dish-form';render()});
 app.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const dish=dishes.find(d=>d.id===b.dataset.delete);if(!dish || !window.confirm(`确定删除“${dish.name}”吗？`))return;b.disabled=true;if(!await cloudDeleteDish(dish.id)){b.disabled=false;return}saveLocalDishes(dishes.filter(d=>d.id!==dish.id));state.selected=state.selected.filter(id=>id!==dish.id);render();notify('菜品已删除');});
 const switchUser=app.querySelector('[data-action=switch-user]');if(switchUser)switchUser.onclick=()=>{state.page='beta-entry';renderBetaEntry({ canCancel: true });};
 const paperEntry=app.querySelector('[data-action=paper-mode]');if(paperEntry)paperEntry.onclick=openPaperMenu;
 const addDish=app.querySelector('[data-action=new-dish]');if(addDish)addDish.onclick=()=>{state.editingId=null;state.draftImage=null;state.page='dish-form';render()};
 app.querySelectorAll('.cover-upload input').forEach(file=>file.onchange=()=>{const item=file.files?.[0];if(!item)return;if(!item.type.startsWith('image/')){notify('请选择图片文件');file.value='';return}const reader=new FileReader();reader.onerror=()=>notify('图片读取失败');reader.onload=()=>{const image=new Image();image.onerror=()=>notify('图片格式不支持');image.onload=()=>{const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);state.draftImage=canvas.toDataURL('image/jpeg',.82);app.querySelector('#cover-preview').src=state.draftImage};image.src=reader.result};reader.readAsDataURL(item)});
 const form=app.querySelector('#dish-form');if(form)form.onsubmit=async e=>{e.preventDefault();const name=form.elements.name.value.trim();if(!name){form.elements.name.focus();return}const existing=dishes.find(d=>d.id===state.editingId);const dish={id:existing?.id || `dish-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,category:form.elements.category.value,cuisine:form.elements.cuisine.value,note:form.elements.note.value.trim(),image:state.draftImage || existing?.image || 'tomato.jpg',spice_level:Number(form.elements.spice_level.value),is_available:form.elements.is_available.value==='true'};const saveButton=form.querySelector('[type=submit]');saveButton.disabled=true;if(!await cloudUpsertDish(dish)){saveButton.disabled=false;return}const latest=dishes.find(d=>d.id===dish.id);saveLocalDishes(latest?dishes.map(d=>d.id===dish.id?dish:d):[...dishes,dish]);state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加');};

 const search=app.querySelector('input[type=search]');if(search)search.oninput=e=>{state.query=e.target.value;const position=e.target.selectionStart;render();const input=app.querySelector('input[type=search]');input.focus();input.setSelectionRange(position,position)};
 const diary=app.querySelector('#diary-note');if(diary)diary.oninput=e=>{state.diaryNote=e.target.value};
 const saveDiary=app.querySelector('[data-action=save-diary]');if(saveDiary)saveDiary.onclick=saveHistory;
 const title=app.querySelector('.menu-title-input');if(title)title.oninput=e=>{state.title=e.target.value};
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
 app.innerHTML = `<div class="beta-scroll"><div class="beta-brand">${logo}<span>白家私厨<small>家的味道</small></span></div><div class="beta-intro"><span class="beta-kicker">A SEAT AT THE TABLE</span><h1>欢迎来到<br>你的私厨</h1><p>输入你的专属内测码，<br>把每一餐的好味道留在这里。</p></div><form class="beta-form" novalidate><label for="beta-code">内测码</label><input id="beta-code" name="code" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" placeholder="请输入 32 位内测码" aria-describedby="beta-help beta-error"><p id="beta-help">验证后会保存在本机，下次打开无需再输入。</p><p id="beta-error" class="beta-error" role="status" aria-live="polite">${escapeText(message)}</p><button class="beta-submit" type="submit">进入白家私厨</button>${canCancel ? '<button class="beta-cancel" type="button">返回当前菜单</button>' : ''}</form><div class="beta-foot"><span></span>好好吃饭，慢慢生活<span></span></div></div>`;
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
  finally { if (button.isConnected) { button.disabled = false; button.textContent = '进入白家私厨'; } }
 };
 const cancel = app.querySelector('.beta-cancel');
 if (cancel) cancel.onclick = () => {
  if (state.page === 'beta-entry') { state.page = 'manage'; render(); }
  else { removeCodeFromAddress(); location.reload(); }
 };
}
async function startApp() {
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
