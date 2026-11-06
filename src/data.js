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
   if (state.page === 'dishes' || state.page === 'manage' || state.page === 'surprise') render();
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
  if (state.page === 'dish-detail') {
   const detailScroll = app.querySelector('.screen-scroll')?.scrollTop || 0;
   const choiceFocused = document.activeElement === app.querySelector('[data-detail-toggle]');
   render();
   const scroll = app.querySelector('.screen-scroll'); if (scroll) scroll.scrollTop = detailScroll;
   if (choiceFocused) app.querySelector('[data-detail-toggle]')?.focus({preventScroll:true});
  } else if (state.page === 'dishes' || state.page === 'manage' || state.page === 'surprise') render();
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
