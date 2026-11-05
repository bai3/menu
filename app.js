const defaultDishes = [
  { id: 'tomato', name: '番茄炒蛋', category: '家常菜', note: '酸甜开胃，家的味道', image: 'tomato.jpg' },
  { id: 'pork', name: '红烧肉', category: '家常菜', note: '软糯入味，香气满满', image: 'pork.jpg' },
  { id: 'cucumber', name: '拍黄瓜', category: '清爽凉菜', note: '清脆爽口，百吃不厌', image: 'cucumber.jpg' },
  { id: 'fish', name: '清蒸鱼', category: '家常菜', note: '鲜嫩清甜，简单好味', image: 'fish.jpg' },
  { id: 'soup', name: '冬瓜排骨汤', category: '暖心汤羹', note: '清润鲜美，暖暖一碗', image: 'soup.jpg' },
  { id: 'shrimp', name: '蒜蓉虾', category: '家常菜', note: '鲜香入味，餐桌上的小惊喜', image: 'shrimp.jpg' }
];
const storageKey = 'jiayan.dishes.v1'; // 旧版 localStorage 键，首次启动时把数据迁入 IndexedDB 后移除。
const isValidDish = (d) => d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.category === 'string' && typeof d.note === 'string' && typeof d.image === 'string';
let dishes = defaultDishes.map(d => ({...d}));
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
  const legacy = localStorage.getItem(storageKey);
  if (legacy !== null) {
   const parsed = JSON.parse(legacy);
   if (Array.isArray(parsed) && parsed.every(isValidDish)) await idbSet('dishes', parsed);
  }
  localStorage.removeItem(storageKey);
 } catch (_) { /* 迁移失败不阻塞启动，菜单仍用默认菜品。 */ }
 try {
  const stored = await idbGet('dishes');
  if (Array.isArray(stored) && stored.every(isValidDish)) {
   dishes = stored;
   if (state.page === 'dishes' || state.page === 'manage') render();
  }
 } catch (_) { /* 读不到已存数据时保留内置菜单。 */ }
 await syncFromCloud();
 // 申请持久存储：避免浏览器在空间紧张时清理本地数据。
 try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
}
function dishImage(d) { return d.image.startsWith('data:image/') ? d.image : './public/assets/' + d.image; }
function saveLocalDishes(next) {
 dishes = next;
 idbSet('dishes', next).catch(() => notify('保存失败，浏览器存储不可用'));
}
// —— 云同步（Supabase）：本地先行，云端失败只提示，不回滚 UI ——
const sb = (window.JIAYAN_SUPABASE && window.supabase) ? window.supabase.createClient(window.JIAYAN_SUPABASE.url, window.JIAYAN_SUPABASE.publishableKey) : null;
const cloudFail = () => notify('已存本机，联网后同步到云端');
async function cloudUpsertDish(d) {
 if (!sb) return;
 const { error } = await sb.from('dishes').upsert({ id: d.id, name: d.name, category: d.category, note: d.note, image: d.image });
 if (error) cloudFail();
}
async function cloudDeleteDish(id) {
 if (!sb) return;
 const { error } = await sb.from('dishes').delete().eq('id', id);
 if (error) cloudFail();
}
// 启动同步：云端为准合并本机。空表时把本机菜全部上云（种子）；
// 同 id 云端优先（LWW）；只在本机存在的菜自动补传（保住离线期间的增改）。
async function syncFromCloud() {
 if (!sb) return;
 let rows;
 try {
  const { data, error } = await sb.from('dishes').select('*').order('created_at', { ascending: true }).order('id', { ascending: true });
  if (error) throw error;
  rows = data;
 } catch (_) { notify('云端暂不可达，当前显示本机菜谱'); return; }
 const toDish = (r) => ({ id: r.id, name: r.name, category: r.category, note: r.note, image: r.image });
 const cloudDishes = rows.map(toDish).filter(isValidDish);
 const cloudIds = new Set(cloudDishes.map(d => d.id));
 const localOnly = dishes.filter(d => !cloudIds.has(d.id));
 if (!cloudDishes.length && localOnly.length) {
  const { error } = await sb.from('dishes').upsert(localOnly);
  if (error) cloudFail();
  return; // 本机数据已是权威，无需合并
 }
 if (localOnly.length) {
  const { error } = await sb.from('dishes').upsert(localOnly);
  if (error) cloudFail();
 }
 saveLocalDishes([...cloudDishes, ...localOnly]);
 if (state.page === 'dishes' || state.page === 'manage') render();
}
const categories = ['全部', '家常菜', '清爽凉菜', '暖心汤羹'];
function dishImage(d) { return d.image.startsWith('data:image/') ? d.image : './public/assets/' + d.image; }
const state = { page: 'dishes', category: '全部', query: '', selected: [], title: '今天的菜单', editingId: null, draftImage: null };
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
const escapeText = (str) => String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
function nav(){return `<nav class="nav" aria-label="页面导航"><button data-page="dishes" class="${state.page==='dishes'?'active':''}" ${state.page==='dishes'?'aria-current="page"':''}>${icon('basket')}<span>点菜</span></button><button data-page="menu" class="${state.page==='menu'?'active':''}" ${state.page==='menu'?'aria-current="page"':''}>${icon('menu')}<span>菜单</span></button></nav>`}
function selectedDishes(){return state.selected.map(id=>dishes.find(d=>d.id===id)).filter(Boolean)}
function renderDishes(){
 const filtered = dishes.filter(d => (state.category==='全部'||d.category===state.category) && `${d.name}${d.category}${d.note}`.includes(state.query.trim()));
 app.className='phone-screen';
 app.innerHTML=`<div class="screen-scroll">${''}<header class="topbar"><div class="top-brand">${logo}<div><strong>白家私厨</strong><small>把喜欢的菜端上桌</small></div></div></header>
 <section class="hero"><div class="hero-image"></div><div class="hero-text"><span class="tag">白家私厨 &nbsp; / &nbsp; 家的味道</span><h2>今天，<br>一起好好吃饭。</h2><p>把喜欢的菜，点给爱的人</p></div><span class="hero-seal">家味</span></section>
 <div class="section-title"><div><h2>今天吃什么？</h2><p>挑几道喜欢的菜，凑成一桌好饭</p></div><button class="manage-entry" data-page="manage">${icon('edit')} 编辑菜单</button></div>
 <label class="search">${icon('search')}<input type="search" placeholder="搜索想吃的菜" value="${escapeText(state.query)}" aria-label="搜索想吃的菜"></label>
 <div class="catalog"><nav class="filters" aria-label="菜品分类">${categories.map(c=>{const selectedCount=selectedDishes().filter(d=>c==='全部'||d.category===c).length;return `<button class="filter ${state.category===c?'active':''}" data-category="${c}" aria-pressed="${state.category===c}"><span class="filter-name">${c}</span>${selectedCount ? `<span class="filter-count">${selectedCount}</span>` : ''}</button>`}).join('')}</nav>
 <section class="catalog-content" aria-label="${state.category}菜品"><div class="catalog-heading"><h3>${state.category==='全部'?'全部菜品':state.category}</h3><span>${filtered.length} 道菜</span></div><div class="dish-list">${filtered.length ? filtered.map(d=>`<article class="dish"><img class="dish-img" src="${escapeText(dishImage(d))}" alt="${escapeText(d.name)}" onerror="this.style.visibility='hidden'"><div class="dish-info"><h3>${escapeText(d.name)}</h3><p>${escapeText(d.note)}</p><span class="dish-tag">${escapeText(d.category)}</span></div><button class="add ${state.selected.includes(d.id)?'selected':''}" data-dish="${d.id}" aria-label="${state.selected.includes(d.id)?'移除':'选择'}${escapeText(d.name)}" aria-pressed="${state.selected.includes(d.id)}">${icon(state.selected.includes(d.id)?'check':'plus')}</button></article>`).join('') : '<div class="empty">没有找到这道菜<br>换个关键词试试吧</div>'}</div></section></div></div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action" data-action="make-menu" aria-label="${state.selected.length ? `已选${state.selected.length}道菜，下单` : '请先选择菜品'}" ${state.selected.length?'':'disabled'}><strong>下单</strong>${state.selected.length ? `<span class="order-count">${state.selected.length}</span>` : ''}</button></div></div>`;
 bind();
}
function renderMenu(){
 app.className='phone-screen menu-screen';
 const selected=selectedDishes();
 app.innerHTML=`<div class="screen-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="menu-heading"><div><span class="menu-kicker">这一餐，留给家人</span><h2>今天的菜单</h2></div><span class="menu-heading-count">${selected.length}<small>道菜</small></span></div>
 <section class="menu-card"><div class="menu-card-top"><span class="menu-card-mark">${icon('hot')}</span><small>今天吃什么</small><input class="menu-title-input" aria-label="菜单标题，可编辑" maxlength="16" value="${escapeText(state.title)}"><div class="menu-meta"><span>${new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}</span><span>点击标题可修改</span></div></div>${selected.length ? `<div class="menu-rows">${selected.map((d,i)=>`<div class="menu-row"><span class="number">${String(i+1).padStart(2,'0')}</span><img class="menu-dish-img" src="${escapeText(dishImage(d))}" alt=""><span class="name">${escapeText(d.name)}</span><button data-remove="${d.id}" aria-label="从菜单移除${escapeText(d.name)}">${icon('close')}</button></div>`).join('')}</div>` : `<div class="menu-empty"><div class="menu-empty-art" aria-hidden="true"><svg viewBox="0 0 180 126" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="113" rx="65" ry="7" fill="#EAD5C1" opacity=".55"/><path d="M37 74h106c-3 24-20 37-53 37S40 98 37 74Z" fill="#C47157"/><path d="M37 74c0-7 24-12 53-12s53 5 53 12-24 12-53 12-53-5-53-12Z" fill="#E8AB8F"/><path d="M47 73c0-5 19-9 43-9s43 4 43 9-19 9-43 9-43-4-43-9Z" fill="#F8E4C7"/><path d="M65 69c-5-10-2-21 4-27 5 7 7 17 4 27M102 67c-2-13 4-23 12-27 3 10 1 21-6 29" fill="#99A77D" stroke="#75885F" stroke-width="2" stroke-linejoin="round"/><path d="M69 48l1 18m42-19-7 18" stroke="#75885F" stroke-width="1.5" stroke-linecap="round"/><circle cx="86" cy="69" r="10" fill="#D8795E"/><path d="M82 61c2-4 6-5 8-1m-5 0 2 5" stroke="#75885F" stroke-width="2" stroke-linecap="round"/><path d="M83 40c-6-7 5-10 0-17M98 37c-6-7 5-10 0-17" stroke="#D8A98E" stroke-width="2.5" stroke-linecap="round"/><path d="M34 48l-3-4m-4 12h-5m129-4 4-5m2 14h5" stroke="#D8A98E" stroke-width="2" stroke-linecap="round"/><path d="M58 96c9 5 20 7 32 7" stroke="#E8A78C" stroke-width="2" stroke-linecap="round"/></svg></div><div class="menu-empty-copy"><strong>一桌好菜，从这里开始</strong><p>挑几道喜欢的菜，<br>为今天添一点期待。</p></div><button data-page="dishes">去挑选菜品</button></div>`}<div class="menu-card-foot"><span></span>好好吃饭，慢慢生活<span></span></div></section><div class="menu-secondary"><button data-action="copy" ${selected.length?'':'disabled'}>复制菜单</button></div></div>
 <div class="bottom"><div class="order-dock">${nav()}<button class="dock-action dock-save" data-action="save" ${selected.length?'':'disabled'}>保存菜单图片</button></div></div>`;
 bind();
}
function renderManage(){
 app.className='phone-screen manage-screen';
 app.innerHTML=`<div class="screen-scroll manage-scroll">${''}<div class="page-heading"><button data-page="dishes" aria-label="返回点菜">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><span class="menu-kicker">把喜欢的菜留下来</span><h2>编辑菜单</h2><p>管理家里的菜，点菜时随心挑选</p></div><span>${dishes.length} 道菜</span></div><div class="manage-list">${dishes.length ? dishes.map(d=>`<article class="manage-dish"><img src="${escapeText(dishImage(d))}" alt=""><div class="manage-dish-copy"><strong>${escapeText(d.name)}</strong><span>${escapeText(d.category)}</span></div><button data-edit="${escapeText(d.id)}" aria-label="编辑${escapeText(d.name)}">编辑</button><button class="delete-dish" data-delete="${escapeText(d.id)}" aria-label="删除${escapeText(d.name)}">删除</button></article>`).join('') : '<div class="manage-empty">菜单还没有菜，先添加一道吧</div>'}</div></div><div class="manage-bottom"><button class="manage-add" data-action="new-dish">${icon('plus')} 添加菜品</button></div>`;
 bind();
}
function renderDishForm(){
 const dish = dishes.find(d=>d.id===state.editingId);
 const image = state.draftImage || dish?.image || 'tomato.jpg';
 app.className='phone-screen manage-screen';
 app.innerHTML=`<div class="screen-scroll form-scroll">${''}<div class="page-heading"><button data-page="manage" aria-label="返回编辑菜单">${icon('back')}</button><span>家的味道</span></div><div class="manage-heading"><div><span class="menu-kicker">为餐桌添一道好菜</span><h2>${dish?'编辑菜品':'添加菜品'}</h2></div></div><form id="dish-form" class="dish-form"><label class="form-label" for="dish-name">菜品名称 <em>必填</em></label><input id="dish-name" name="name" maxlength="24" required placeholder="例如：番茄炒蛋" value="${escapeText(dish?.name || '')}"><label class="form-label" for="dish-category">菜品分类</label><select id="dish-category" name="category">${categories.slice(1).map(c=>`<option value="${c}" ${dish?.category===c?'selected':''}>${c}</option>`).join('')}</select><label class="form-label" for="dish-note">一句介绍 <span>选填</span></label><input id="dish-note" name="note" maxlength="36" placeholder="写一句这道菜的味道" value="${escapeText(dish?.note || '')}"><div class="form-label">菜品封面</div><div class="cover-picker"><img id="cover-preview" src="${escapeText(dishImage({image}))}" alt="菜品封面预览"><div><strong>换一张喜欢的图片</strong><span>拍一张，或从相册挑选</span><div class="cover-actions"><label class="cover-upload">${icon('camera')}拍照<input type="file" accept="image/*" capture="environment"></label><label class="cover-upload">${icon('image')}从相册选择<input type="file" accept="image/*"></label></div></div></div><button class="form-save" type="submit">保存菜品</button></form></div>`;
 bind();
}
function render(){if(state.page==='menu')renderMenu();else if(state.page==='manage')renderManage();else if(state.page==='dish-form')renderDishForm();else renderDishes()}
function notify(message){const old=app.querySelector('.toast');if(old)old.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;app.appendChild(el);setTimeout(()=>el.remove(),2400)}

async function saveMenuImage(){
 const selected=selectedDishes(); if(!selected.length)return;
 const saveBtn=app.querySelector('[data-action=save]');
 if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='生成中…'}
 // 先让「生成中」状态上屏，再开始绘制和编码，避免按钮来不及更新。
 await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 try{
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
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));
 if(!blob){notify('生成菜单图片失败，请重试');return}
 const file=new File([blob],'白家私厨菜单.jpg',{type:'image/jpeg'});
 // 网页没有直写相册的 API；支持 Web Share 的浏览器可调起系统面板，面板里有「存储图像」。
 const canShare=typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});
 const imageUrl=URL.createObjectURL(blob);
 const overlay=document.createElement('div');overlay.className='image-overlay';
 overlay.innerHTML=`<div class="image-dialog" role="dialog" aria-modal="true" aria-label="菜单图片预览"><div class="image-dialog-head"><div><strong>菜单图片</strong><span>${canShare?'保存到相册，或长按图片':'长按图片保存，也可以点击下载'}</span></div><button class="image-close" aria-label="关闭预览">${icon('close')}</button></div><div class="image-preview"><img src="${imageUrl}" alt="生成的家庭菜单图片"></div><div class="image-actions">${canShare?'<button class="image-save" type="button">保存到相册</button>':''}<a class="image-download" href="${imageUrl}" download="白家私厨菜单.jpg">下载图片</a></div></div>`;
 document.body.appendChild(overlay);
 const close=()=>{overlay.remove();URL.revokeObjectURL(imageUrl);document.removeEventListener('keydown',onKey)};
 const onKey=e=>{if(e.key==='Escape')close()};
 const saveToAlbum=overlay.querySelector('.image-save');
 if(saveToAlbum)saveToAlbum.onclick=async()=>{try{await navigator.share({files:[file],title:'白家私厨菜单',text:'好好吃饭，慢慢生活'});close()}catch(err){if(err&&err.name!=='AbortError')notify('未能调起系统保存，试试长按图片')}};
 overlay.querySelector('.image-close').onclick=close;
 overlay.onclick=e=>{if(e.target===overlay)close()};
 document.addEventListener('keydown',onKey);
 overlay.querySelector('.image-close').focus();
 }finally{
  if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='保存菜单图片'}
 }
}

function bind(){
 app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state.page=b.dataset.page;render()});
 app.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{const scroll=app.querySelector('.screen-scroll').scrollTop;state.category=b.dataset.category;render();app.querySelector('.screen-scroll').scrollTop=scroll});
 app.querySelectorAll('[data-dish]').forEach(b=>b.onclick=()=>{const id=b.dataset.dish;state.selected=state.selected.includes(id)?state.selected.filter(x=>x!==id):[...state.selected,id];const scroll=app.querySelector('.screen-scroll').scrollTop;render();app.querySelector('.screen-scroll').scrollTop=scroll});
 app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.selected=state.selected.filter(x=>x!==b.dataset.remove);render()});
 app.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{state.editingId=b.dataset.edit;state.draftImage=null;state.page='dish-form';render()});
 app.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const dish=dishes.find(d=>d.id===b.dataset.delete);if(!dish || !window.confirm(`确定删除“${dish.name}”吗？`))return;saveLocalDishes(dishes.filter(d=>d.id!==dish.id));cloudDeleteDish(dish.id);state.selected=state.selected.filter(id=>id!==dish.id);render();notify('菜品已删除');});
 const addDish=app.querySelector('[data-action=new-dish]');if(addDish)addDish.onclick=()=>{state.editingId=null;state.draftImage=null;state.page='dish-form';render()};
 app.querySelectorAll('.cover-upload input').forEach(file=>file.onchange=()=>{const item=file.files?.[0];if(!item)return;if(!item.type.startsWith('image/')){notify('请选择图片文件');file.value='';return}const reader=new FileReader();reader.onerror=()=>notify('图片读取失败');reader.onload=()=>{const image=new Image();image.onerror=()=>notify('图片格式不支持');image.onload=()=>{const scale=Math.min(1,800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);state.draftImage=canvas.toDataURL('image/jpeg',.82);app.querySelector('#cover-preview').src=state.draftImage};image.src=reader.result};reader.readAsDataURL(item)});
 const form=app.querySelector('#dish-form');if(form)form.onsubmit=e=>{e.preventDefault();const name=form.elements.name.value.trim();if(!name){form.elements.name.focus();return}const existing=dishes.find(d=>d.id===state.editingId);const dish={id:existing?.id || `dish-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,category:form.elements.category.value,note:form.elements.note.value.trim(),image:state.draftImage || existing?.image || 'tomato.jpg'};const next=existing?dishes.map(d=>d.id===existing.id?dish:d):[...dishes,dish];saveLocalDishes(next);cloudUpsertDish(dish);state.editingId=null;state.draftImage=null;state.page='manage';render();notify(existing?'菜品已更新':'菜品已添加');};

 const search=app.querySelector('input[type=search]');if(search)search.oninput=e=>{state.query=e.target.value;const position=e.target.selectionStart;render();const input=app.querySelector('input[type=search]');input.focus();input.setSelectionRange(position,position)};
 const title=app.querySelector('.menu-title-input');if(title)title.oninput=e=>{state.title=e.target.value};
 const make=app.querySelector('[data-action=make-menu]');if(make)make.onclick=()=>{state.page='menu';render()};
 const copy=app.querySelector('[data-action=copy]');if(copy)copy.onclick=async()=>{const text=`${state.title || '今天的菜单'}\n${categories.filter(c=>c!=='全部' && selectedDishes().some(d=>d.category===c)).map(c=>`${c}\n${selectedDishes().filter(d=>d.category===c).map((d,i)=>`${i+1}. ${d.name}`).join('\n')}`).join('\n\n')}\n好好吃饭 · 好好生活`;try{await navigator.clipboard.writeText(text);notify('菜单已复制，分享给家人吧')}catch{const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();try{document.execCommand('copy');notify('菜单已复制，分享给家人吧')}catch{notify('复制失败，请手动选择菜单内容')}area.remove()}};
 const save=app.querySelector('[data-action=save]');if(save)save.onclick=saveMenuImage;
}
render();
initDishes();
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}) });
