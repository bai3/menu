// A shared meal uses invitation and participant credentials, never the owner's beta code.
const sharedMeal = { invite: '', person: '', data: null, page: 'join', timer: null, busy: false, offline: false, requestVersion: 0, filterMode: 'category', category: '全部', query: '' };
const sharedRandom = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
const sharedKey = token => `jiayan.shared-person:${token}`;
function sharedUrl(token) { const u = new URL(location.href); u.search = ''; u.hash = `meal=${token}`; return u.href; }
function sharedInviteFromUrl() { const token = new URLSearchParams(location.hash.slice(1)).get('meal'); return /^[a-f0-9]{64}$/.test(token || '') ? token : ''; }
async function sharedRpc(name, args) { if (!sb) throw new Error('网络不可用'); const {data,error} = await sb.rpc(name,args); if(error) throw error; return data; }
function sharedStorageGet(key) { try { return localStorage.getItem(key) || ''; } catch (_) { return ''; } }
function sharedStorageSet(key,value) { try { localStorage.setItem(key,value); return true; } catch (_) { return false; } }
function sharedStart(invite) {
 sharedMeal.requestVersion++; sharedMeal.filterMode='category'; sharedMeal.category='全部'; sharedMeal.query=''; sharedMeal.invite=invite; sharedMeal.person=sharedStorageGet(sharedKey(invite)); sharedMeal.data=null; sharedMeal.page='join';
 clearInterval(sharedMeal.timer); sharedLoad();
 sharedMeal.timer=setInterval(()=>{ if(!document.hidden && sharedMeal.invite && !sharedMeal.busy) sharedLoad(true); },5000);
}
function sharedExit() { sharedMeal.requestVersion++; clearInterval(sharedMeal.timer); sharedMeal.invite=''; sharedMeal.data=null; history.replaceState(history.state,'',location.pathname+location.search); location.reload(); }
async function sharedLoad(quiet=false) {
 const version=++sharedMeal.requestVersion, invite=sharedMeal.invite;
 try {
  const d=await sharedRpc('shared_meal_read',{p_invite:invite,p_person:sharedMeal.person || null});
  if(version!==sharedMeal.requestVersion || invite!==sharedMeal.invite || (quiet && sharedMeal.busy))return;
  const changed=sharedMeal.offline || JSON.stringify(d)!==JSON.stringify(sharedMeal.data);
  sharedMeal.offline=false; sharedMeal.data=d;
  if(d.joined && sharedMeal.page==='join')sharedMeal.page='order';
  if(!quiet || changed){const scroll=app.querySelector('.screen-scroll')?.scrollTop || 0;const searchFocused=document.activeElement?.id==='shared-search';const cursor=searchFocused ? document.activeElement.selectionStart : null;renderSharedMeal();const scroller=app.querySelector('.screen-scroll');if(scroller)scroller.scrollTop=scroll;if(searchFocused){const input=app.querySelector('#shared-search');if(input){input.focus({preventScroll:true});if(cursor!==null)input.setSelectionRange(cursor,cursor);}}}
 } catch (_) {
  if(version!==sharedMeal.requestVersion || invite!==sharedMeal.invite)return;
  if(!sharedMeal.data){renderSharedMeal('邀请不存在、已过期，或网络暂不可用');}
  else if(!sharedMeal.offline){sharedMeal.offline=true;const scroll=app.querySelector('.screen-scroll')?.scrollTop || 0;const searchFocused=document.activeElement?.id==='shared-search';const cursor=searchFocused ? document.activeElement.selectionStart : null;renderSharedMeal();const scroller=app.querySelector('.screen-scroll');if(scroller)scroller.scrollTop=scroll;if(searchFocused){const input=app.querySelector('#shared-search');if(input){input.focus({preventScroll:true});if(cursor!==null)input.setSelectionRange(cursor,cursor);}}}
 }
}
function sharedNames(id) { const s=sharedMeal.data; return s.choices.filter(c=>c.dish_id===id).map(c=>s.people.find(p=>p.id===c.person_id)?.name).filter(Boolean).join('、'); }
function sharedRenderShell(content,foot='') { app.className='phone-screen'; app.innerHTML=`<div class="screen-scroll shared-scroll ${foot ? 'has-shared-bottom' : ''}"><header class="topbar"><div class="top-brand">${logo}<div><strong>家宴</strong><small>把喜欢的菜端上桌</small></div></div></header>${content}</div>${foot}`; }
function renderSharedMeal(error='') {
 const d=sharedMeal.data;
 if(!d) { sharedRenderShell(`<div class="shared-intro"><span>一起吃饭 · 一起点菜</span><h2>${error?'暂时无法加入':'正在打开邀请'}</h2><p>${escapeText(error||'请稍等片刻…')}</p><button class="shared-text" data-shared="exit">返回家宴</button></div>`); }
 else if(!d.joined) { sharedRenderShell(`<div class="shared-intro"><span>家宴 · 聚餐邀请</span><h2>好饭，要一起吃</h2><p>邀请你加入「${escapeText(d.title)}」</p><div class="shared-invite-card"><strong>${escapeText(d.title)}</strong><small>${d.status==='completed'?'这次点菜已结束':'一桌好菜，等你来选'}</small></div>${d.status==='open'?'<form id="shared-join"><label for="shared-name">怎么称呼你？</label><input id="shared-name" maxlength="12" required placeholder="例如：妈妈"><button class="shared-primary" type="submit">加入，一起点菜</button></form>':'<p>这次聚餐已完成，邀请已关闭。</p>'}<button class="shared-text" data-shared="exit">返回家宴</button></div>`); }
 else {
  const selected=d.catalog.filter(x=>d.choices.some(c=>c.dish_id===x.id));
  const done=d.status==='completed', menu=sharedMeal.page==='menu', sharing=sharedMeal.page==='share';
  let content=`<div class="shared-heading"><div><span>家宴 · 一起点菜</span><h2>${escapeText(d.title)}</h2><p>${d.people.length} 人加入 · ${sharedMeal.offline?'连接中断，请检查网络':done?'菜单已确定':'聚餐点菜中 · 每 5 秒同步'}</p></div><button class="shared-text" data-shared="exit">退出</button></div>`;
  if(sharing && !done) content+=`<div class="shared-invite-card"><strong>邀请家人朋友一起点</strong><small>复制链接发给大家，打开后就能加入。</small><label for="shared-link">邀请链接</label><input id="shared-link" readonly value="${escapeText(sharedUrl(sharedMeal.invite))}"><button class="shared-secondary" data-shared="copy">复制链接</button></div>`;
  else if(menu || done) content+=`<div class="shared-menu"><div class="shared-menu-head"><small>THE FAMILY TABLE</small><h3>${escapeText(d.title)}</h3><p>${selected.length} 道菜 · ${done?'这一餐，准备好了':'大家一起挑选的好味道'}</p></div>${selected.length?selected.map((x,i)=>`<div class="shared-row"><span class="shared-num">${String(i+1).padStart(2,'0')}</span><div><strong>${escapeText(x.name)}</strong><small>${escapeText(sharedNames(x.id))}想吃</small></div></div>`).join(''):'<p class="shared-empty">还没有人点菜，一起挑几道吧。</p>'}<div class="shared-menu-foot">好好吃饭，慢慢生活</div></div>`;
  else {
   const catalog=d.catalog.map(normalizeDish), field=sharedMeal.filterMode==='category'?'category':'cuisine';
   const options=field==='category'?categories.slice(1):cuisines, present=new Set(catalog.map(x=>x[field]));
   const filters=['全部',...options.filter(x=>present.has(x)),...[...present].filter(x=>x&&!options.includes(x))];
   const filtered=catalog.filter(x=>`${x.name}${x.category}${x.cuisine}${x.note}`.includes(sharedMeal.query.trim()));
   const groups=filters.slice(1).filter(value=>filtered.some(x=>x[field]===value));
   content+=`<div class="shared-bar"><strong>一起挑选喜欢的菜</strong><button class="shared-text" data-shared="share">邀请更多人</button></div>
   <button class="paper-entry shared-paper-entry" data-shared="paper"><span><small>THE FAMILY MENU</small><strong>翻开纸质菜单</strong><em>像在餐厅一样，慢慢挑选</em></span><span class="paper-entry-mark" aria-hidden="true">菜单<br><i>MENU</i></span><b>打开菜单</b></button>
   <label class="search shared-search">${icon('search')}<input id="shared-search" type="search" placeholder="搜索想吃的菜" value="${escapeText(sharedMeal.query)}" aria-label="搜索想吃的菜"></label>
   <div class="filter-switch shared-filter-switch" role="group" aria-label="筛选方式"><button data-shared-filter-mode="category" aria-pressed="${sharedMeal.filterMode==='category'}">菜品分类</button><button data-shared-filter-mode="cuisine" aria-pressed="${sharedMeal.filterMode==='cuisine'}">菜系</button></div>
   <div class="catalog shared-catalog"><nav class="filters" aria-label="${field==='category'?'菜品分类':'菜系'}">${filters.map(c=>{const count=catalog.filter(x=>(c==='全部'||x[field]===c)&&d.choices.some(v=>v.dish_id===x.id)).length;return `<button class="filter ${sharedMeal.category===c?'active':''}" data-shared-category="${escapeText(c)}" aria-pressed="${sharedMeal.category===c}"><span class="filter-name">${escapeText(c)}</span>${count?`<span class="filter-count">${count}</span>`:''}</button>`}).join('')}</nav>
   <section class="catalog-content" aria-label="菜品列表">${filtered.length?`<div class="catalog-heading"><h3>全部菜品</h3><span>${filtered.length} 道菜</span></div>${groups.map(value=>`<section class="catalog-group" data-group="${escapeText(value)}"><div class="catalog-heading"><h3>${escapeText(value)}</h3><span>${filtered.filter(x=>x[field]===value).length} 道菜</span></div><div class="dish-list">${filtered.filter(x=>x[field]===value).map(x=>{const mine=d.choices.some(c=>c.dish_id===x.id&&c.person_id===d.person_id), names=sharedNames(x.id);return `<article class="dish shared-catalog-dish ${names?'has-choices':''}"><div class="shared-dish-photo"><img class="dish-img" src="${escapeText(dishImage(x))}" alt="${escapeText(x.name)}" onerror="this.style.visibility='hidden'">${names?'<span class="shared-picked-badge">已点</span>':''}</div><div class="dish-info"><h3>${escapeText(x.name)} ${spiceBadge(x)}</h3><p>${escapeText(x.note)}</p><span class="dish-tag">${escapeText(x.category)}${x.cuisine!=='未分类'?' · '+escapeText(x.cuisine):''}</span>${names?`<span class="shared-dish-names" title="${escapeText(names)} 想吃"><span class="shared-names-label">想吃</span><span class="shared-names-value">${escapeText(names)}</span></span>`:''}</div><button class="add ${mine?'selected':''}" data-choice="${escapeText(x.id)}" aria-label="${mine?'取消选择':'我也想吃'}${escapeText(x.name)}" aria-pressed="${mine}">${icon(mine?'check':'plus')}</button></article>`}).join('')}</div></section>`).join('')}`:'<div class="empty">没有找到这道菜<br>换个关键词试试吧</div>'}</section></div>`;
  }
  let foot=sharing&&!done?`<button class="shared-primary" data-shared="order">开始点菜</button>`:done?`<button class="shared-primary" data-shared="save" ${selected.length?'':'disabled'}>保存菜单图片</button>`:menu?`<button class="shared-secondary" data-shared="order">继续点菜</button>${d.is_owner?`<button class="shared-primary" data-shared="complete" ${selected.length?'':'disabled'}>完成点菜</button>`:'<span class="shared-wait">等待发起人完成点菜</span>'}`:`<button class="shared-primary" data-shared="menu">查看菜单 · ${selected.length} 道</button>`;
  sharedRenderShell(content,`<div class="bottom shared-bottom">${foot}</div>`);
 }
 app.querySelectorAll('[data-shared]').forEach(b=>b.onclick=()=>sharedAction(b.dataset.shared));
 app.querySelector('#shared-join')?.addEventListener('submit',async e=>{e.preventDefault();const name=app.querySelector('#shared-name').value.trim();if(!name)return;const token=sharedRandom();if(!sharedStorageSet(sharedKey(sharedMeal.invite),token)){notify('无法保存参与身份，请检查浏览器存储');return;} sharedMeal.busy=true;sharedMeal.requestVersion++;try{await sharedRpc('shared_meal_join',{p_invite:sharedMeal.invite,p_person:token,p_name:name});sharedMeal.person=token;await sharedLoad();}catch(_){notify('加入失败，请检查网络或邀请是否有效');}finally{sharedMeal.busy=false;}});
 app.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>sharedChoose(b.dataset.choice,b.getAttribute('aria-pressed')!=='true'));
 app.querySelectorAll('[data-shared-filter-mode]').forEach(b=>b.onclick=()=>{sharedMeal.filterMode=b.dataset.sharedFilterMode;sharedMeal.category='全部';sharedRenderPreservingScroll();});
 bindCatalog(true);
 const search=app.querySelector('#shared-search');if(search){const updateSearch=()=>{sharedMeal.query=search.value;const cursor=search.selectionStart;sharedRenderPreservingScroll();const input=app.querySelector('#shared-search');input?.focus({preventScroll:true});if(input && cursor!==null)input.setSelectionRange(cursor,cursor);};search.oninput=e=>{if(!e.isComposing)updateSearch()};search.oncompositionend=updateSearch;}
}
function sharedRenderPreservingScroll(){const top=app.querySelector('.screen-scroll')?.scrollTop || 0;renderSharedMeal();const scroller=app.querySelector('.screen-scroll');if(scroller)scroller.scrollTop=top;}
async function sharedChoose(id,selected,paper=false){
 if(sharedMeal.busy){notify('正在同步，请稍等');return false;}
 if(sharedMeal.data?.status!=='open'){notify('这次点菜已结束');return false;}
 sharedMeal.busy=true;sharedMeal.requestVersion++;
 const buttons=app.querySelectorAll('[data-choice]');buttons.forEach(b=>b.disabled=true);
 try{await sharedRpc('shared_meal_choose',{p_invite:sharedMeal.invite,p_person:sharedMeal.person,p_dish:id,p_selected:selected});await sharedLoad();if(paper)showPaperFeedback(id,selected);return true;}
 catch(_){notify('点菜失败，请联网后重试');return false;}
 finally{sharedMeal.busy=false;app.querySelectorAll('[data-choice]').forEach(b=>b.disabled=false);}
}

async function sharedAction(action) {
 if(action==='exit') return sharedExit();
 if(action==='paper') return openPaperMenu();
 if(action==='order'||action==='menu'||action==='share'){sharedMeal.page=action;return renderSharedMeal();}
 if(action==='copy'){try{const url=sharedUrl(sharedMeal.invite);if(navigator.clipboard && navigator.clipboard.writeText){await navigator.clipboard.writeText(url);notify('邀请链接已复制');}else{app.querySelector('#shared-link')?.select();notify('请长按链接复制');}}catch(e){if(e.name!=='AbortError')notify('分享失败，请检查浏览器权限');}return;}
 if(action==='complete'){if(!confirm('确定完成点菜？完成后大家将不能继续添加菜品。'))return;sharedMeal.busy=true;sharedMeal.requestVersion++;try{await sharedRpc('shared_meal_complete',{p_invite:sharedMeal.invite});await sharedLoad();}catch(_){notify('完成失败，请联网后重试');}finally{sharedMeal.busy=false;}return;}
 if(action==='save'){const chosen=sharedMeal.data.catalog.filter(x=>sharedMeal.data.choices.some(c=>c.dish_id===x.id));return saveMenuImage(chosen,sharedMeal.data.title);}
}
function renderSharedCreate() {
 app.className='phone-screen';
 app.innerHTML=`<div class="screen-scroll shared-create-scroll"><header class="shared-create-nav"><button class="shared-back" type="button" data-page="dishes">返回点菜</button><span>家宴 · 邀请一起点</span></header><main class="shared-create-content"><div class="shared-create-heading"><h1>邀请一起点</h1><p>一桌好菜，邀请大家一起决定。</p></div><form id="shared-create" class="shared-create-form"><div class="shared-form-heading"><span>发起聚餐</span><small>为这一餐起个名字</small></div><label for="shared-title">菜单名称</label><input id="shared-title" maxlength="16" value="今天一起吃什么" required><label for="shared-host">怎么称呼你</label><input id="shared-host" maxlength="12" placeholder="例如：小白" required><div class="shared-create-divider"></div><div class="shared-create-info"><strong>邀请有效期</strong><span>1 小时</span></div><p class="shared-create-note">邀请过期后，已加入的家人仍可继续点菜。</p><button class="shared-primary" type="submit">创建并邀请</button></form>${sharedStorageGet('jiayan.shared-last:'+betaCode) ? '<button class="shared-create-resume" data-action="shared-resume">返回上次聚餐</button>' : ''}<div class="shared-create-footer"><span></span>好好吃饭，慢慢生活<span></span></div></main></div>`;
 app.querySelector('[data-page]').onclick=()=>{state.page='dishes';render()};
 const resume=app.querySelector('[data-action=shared-resume]');if(resume)resume.onclick=()=>{const token=sharedStorageGet('jiayan.shared-last:'+betaCode);location.hash=`meal=${token}`;sharedStart(token)};
 app.querySelector('#shared-create').onsubmit=async e=>{e.preventDefault();const title=app.querySelector('#shared-title').value.trim(),name=app.querySelector('#shared-host').value.trim();if(!title||!name)return;const invite=sharedRandom(),person=sharedRandom();if(!sharedStorageSet(sharedKey(invite),person)){notify('无法保存参与身份，请检查浏览器存储');return;}const button=e.target.querySelector('button');button.disabled=true;try{await sharedRpc('shared_meal_create',{p_title:title,p_name:name,p_invite:invite,p_person:person});sharedStorageSet('jiayan.shared-last:'+betaCode,invite);location.hash=`meal=${invite}`;sharedStart(invite);sharedMeal.page='share';}catch(_){button.disabled=false;notify('创建失败，请检查网络和数据库配置');}};
}
window.addEventListener('focus',()=>{if(sharedMeal.invite&&!sharedMeal.busy)sharedLoad(true)});

document.addEventListener('visibilitychange',()=>{if(!document.hidden && sharedMeal.invite && !sharedMeal.busy)sharedLoad(true)});
