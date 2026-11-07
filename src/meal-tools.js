// Personal menu drafts are scoped to the current beta user and never uploaded as dishes.
const draftStorageKey = () => `jiayan.menu-draft.v1:${betaCode}`;
let draftSaveWarningShown = false;
function restoreMenuDraft() {
 try {
  const draft = JSON.parse(localStorage.getItem(draftStorageKey()) || 'null');
  if (!draft || !Array.isArray(draft.selected)) return;
  state.selected = [...new Set(draft.selected.filter(id => typeof id === 'string' && id.length <= 200))].slice(0, 500);
  if (!state.selected.length) return;
  state.title = typeof draft.title === 'string' ? draft.title.slice(0, 16) : '今天的菜单';
  state.diaryNote = typeof draft.diaryNote === 'string' ? draft.diaryNote.slice(0, 200) : '';
  state.draftRestored = true;
 } catch (_) { /* Invalid or unavailable storage must not block the app. */ }
}
function saveMenuDraft() {
 if (!betaCode) return true;
 try {
  if (state.selected.length) localStorage.setItem(draftStorageKey(), JSON.stringify({selected:state.selected,title:state.title,diaryNote:state.diaryNote}));
  else localStorage.removeItem(draftStorageKey());
  draftSaveWarningShown = false;
  return true;
 } catch (_) {
  if (!draftSaveWarningShown) { draftSaveWarningShown = true; notify('本机无法保存菜单草稿，请检查浏览器存储'); }
  return false;
 }
}
function clearMenuDraft() {
 state.selected=[]; state.title='今天的菜单'; state.diaryNote=''; state.draftRestored=false; state.draftUnavailable=0; state.planResult=null; state.surpriseId=null;
 return saveMenuDraft();
}
// Plan within each selected category; never duplicate a dish or substitute another category silently.
const planCategories = ['家常菜','清爽凉菜','暖心汤羹','主食'];
function planCategoryOptions(catalog) {
 const extra=catalog.filter(d=>d.is_available && typeof d.category==='string' && d.category && !planCategories.includes(d.category)).map(d=>d.category);
 return [...planCategories,...new Set(extra)];
}
function defaultPlanCounts(people) {
 const n=Math.max(1,Math.min(8,Number(people)||2));
 return {'家常菜':Math.min(n,5),'清爽凉菜':n>=4?1:0,'暖心汤羹':1,'主食':0};
}
function makeMealPlan(catalog, counts, random=Math.random) {
 const chosen=[], shortages=[];
 for (const category of [...new Set([...planCategories,...Object.keys(counts)])]) {
  const requested=Math.max(0,Math.min(9,Number(counts[category])||0));
  const seen=new Set(chosen);
  const pool=catalog.filter(d=>{if(!d.is_available || d.category!==category || seen.has(d.id))return false;seen.add(d.id);return true;});
  for (let i=pool.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const picked=pool.slice(0,requested); chosen.push(...picked.map(d=>d.id));
  if (picked.length<requested) shortages.push({category,requested,available:picked.length});
 }
 return {chosen,shortages};
}
function replacePlanDish(catalog, ids, id, random=Math.random) {
 const old=catalog.find(d=>d.id===id);
 if (!old) return null;
 const pool=catalog.filter(d=>d.is_available && d.category===old.category && !ids.includes(d.id));
 return pool.length ? pool[Math.floor(random()*pool.length)].id : null;
}
