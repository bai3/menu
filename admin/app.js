(() => {
 'use strict';
 const app = document.querySelector('#app');
 const config = window.JIAYAN_SUPABASE;
 const sb = config && window.supabase?.createClient(config.url, config.publishableKey, { auth: { storageKey: 'jiayan.dashboard.auth' } });
 const state = { users: [], dishes: [], diary: [], user: '', tab: 'dishes', query: '', loading: false, error: '', refreshed: null };
 const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const codeLabel = code => code ? `${code.slice(0, 6)}···${code.slice(-4)}` : '未知用户';
 const date = value => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}); };
 const image = value => typeof value === 'string' && value.startsWith('data:image/') ? value : typeof value === 'string' && /^[\w.-]+\.(jpg|jpeg|png|webp|gif)$/i.test(value) ? `../public/assets/${value}` : '';
 function login(message = '') {
  app.innerHTML = `<main class="login-shell"><div class="login-brand"><span class="brand-mark">白</span><span>白家私厨 <small>内测看板</small></span></div><section class="login-card"><span class="eyebrow">THE FAMILY TABLE / ADMIN</span><h1>把每一份<br><em>好味道</em>，看见。</h1><p>登录管理员账号，查看内测用户的菜品与吃饭日记。</p><form id="login"><label for="email">管理员邮箱</label><input id="email" type="email" autocomplete="username" required placeholder="请输入邮箱"><label for="password">密码</label><input id="password" type="password" autocomplete="current-password" required placeholder="请输入密码"><div class="form-error" role="alert">${esc(message)}</div><button type="submit">登录看板 <span>→</span></button></form></section><div class="login-foot">BAI'S KITCHEN <span>·</span> 好好吃饭，慢慢生活</div></main>`;
  document.querySelector('#login').onsubmit = async e => { e.preventDefault(); const button=e.currentTarget.querySelector('button'); button.disabled=true; const { error }=await sb.auth.signInWithPassword({email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value}); if(error) login('登录失败，请检查邮箱和密码。'); else await load(); };
 }
 async function allRows(table, order) {
  const result=[]; const size=500;
  for(let offset=0;;offset+=size) { const {data,error}=await sb.from(table).select('*').order(order,{ascending:false}).range(offset,offset+size-1); if(error) throw error; result.push(...data); if(data.length<size) return result; }
 }
 async function load() {
  state.loading=true; state.error=''; render();
  try {
   const {data:allowed,error:authError}=await sb.rpc('is_dashboard_admin');
   if(authError) throw new Error('管理员权限尚未配置，请先执行数据库配置脚本。');
   if(!allowed) throw new Error('当前账号没有看板权限，请将账号加入管理员白名单。');
   [state.users,state.dishes,state.diary]=await Promise.all([allRows('beta_users','created_at'),allRows('dishes','created_at'),allRows('meal_history','created_at')]);
   state.refreshed=new Date();
  } catch(e) { state.error=e.message || '数据加载失败，请检查网络后重试。'; }
  finally { state.loading=false; render(); }
 }
 function render() {
  const users=state.users; const { filteredDishes, filteredDiary } = filteredRecords();
  const active = new Set([...state.dishes,...state.diary].map(x=>x.user_code)).size;
  app.innerHTML=`<div class="layout"><aside class="sidebar"><div class="brand"><span class="brand-mark">白</span><div><strong>白家私厨</strong><small>内测数据看板</small></div></div><div class="side-label">WORKSPACE</div><div class="side-active"><span>▦</span> 数据总览 <i></i></div><div class="side-bottom"><span class="status-dot"></span> Supabase 数据源<br><small>仅管理员可访问</small></div></aside><main class="main"><header class="top"><div><span class="eyebrow">BAI'S KITCHEN / OVERVIEW</span><h1>内测数据看板<span>✳</span></h1><p>看看大家的餐桌上，都留下了什么。</p></div><div class="top-actions"><button id="refresh" class="refresh" ${state.loading?'disabled':''}>↻ <span>刷新数据</span></button><button id="logout" class="logout">退出登录</button></div></header><div class="overview-head"><div><span class="section-index">01 / OVERVIEW</span><h2>数据概览</h2></div><p>${state.refreshed ? `更新于 ${esc(date(state.refreshed))}` : '连接 Supabase 实时读取'}</p></div><section class="stats" aria-label="数据概览"><article><span>内测用户</span><strong>${state.error?'—':users.length}</strong><small>已发放的内测码</small><b>01</b></article><article><span>有内容的用户</span><strong>${state.error?'—':active}</strong><small>上传过菜品或日记</small><b>02</b></article><article><span>菜品总数</span><strong>${state.error?'—':state.dishes.length}</strong><small>当前保存的菜品</small><b>03</b></article><article><span>吃饭日记</span><strong>${state.error?'—':state.diary.length}</strong><small>保存过的每一餐</small><b>04</b></article></section><section class="content"><div class="content-head"><div><span class="section-index">02 / COLLECTION</span><h2>餐桌记录 <span>COLLECTION</span></h2><p>按用户查看他们添加的菜品和保存的日记。</p></div><div class="filters"><label><span class="sr-only">选择内测用户</span><select id="user"><option value="">全部内测用户</option>${users.map(u=>`<option value="${esc(u.code)}" ${state.user===u.code?'selected':''}>${esc(codeLabel(u.code))}</option>`).join('')}</select></label><label class="search"><span>⌕</span><input id="search" value="${esc(state.query)}" placeholder="搜索菜品、日记" aria-label="搜索菜品或日记"></label></div></div><div class="tabs"><button data-tab="dishes" aria-selected="${state.tab==='dishes'}">菜品 <span>${filteredDishes.length}</span></button><button data-tab="diary" aria-selected="${state.tab==='diary'}">吃饭日记 <span>${filteredDiary.length}</span></button></div><div class="records">${state.loading?'<div class="empty">正在读取云端数据…</div>':state.error?`<div class="empty error"><strong>暂时无法显示数据</strong><p>${esc(state.error)}</p><button id="retry">重试</button></div>`:state.tab==='dishes'?dishList(filteredDishes):diaryList(filteredDiary)}</div></section><footer>白家私厨 <span>·</span> 一餐一饭，皆是欢喜 <small>READ ONLY DASHBOARD</small></footer></main></div>`;
  document.querySelector('#refresh').onclick=load; document.querySelector('#retry')?.addEventListener('click',load);
  document.querySelector('#logout').onclick=async()=>{await sb.auth.signOut();login();};
  document.querySelector('#user').onchange=e=>{state.user=e.target.value;render();};
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render();});
  const search = document.querySelector('#search');
  const updateSearch = () => { state.query=search.value; updateRecords(); };
  search.addEventListener('input', e => { if (!e.isComposing) updateSearch(); });
  search.addEventListener('compositionend', updateSearch);
 }
 function filteredRecords() {
  const query=state.query.trim().toLowerCase();
  return {
   filteredDishes:state.dishes.filter(d=>(!state.user||d.user_code===state.user)&&`${d.name||''} ${d.note||''} ${d.category||''} ${d.cuisine||''}`.toLowerCase().includes(query)),
   filteredDiary:state.diary.filter(d=>(!state.user||d.user_code===state.user)&&`${d.title||''} ${d.note||''} ${(Array.isArray(d.dishes)?d.dishes:[]).map(x=>x.name||'').join(' ')}`.toLowerCase().includes(query))
  };
 }
 function updateRecords() {
  const {filteredDishes,filteredDiary}=filteredRecords();
  document.querySelector('[data-tab="dishes"] span').textContent=filteredDishes.length;
  document.querySelector('[data-tab="diary"] span').textContent=filteredDiary.length;
  if (!state.loading && !state.error) document.querySelector('.records').innerHTML=state.tab==='dishes'?dishList(filteredDishes):diaryList(filteredDiary);
 }
 function dishList(items) { if(!items.length)return '<div class="empty"><strong>还没有找到菜品</strong><p>换个用户或关键词看看。</p></div>'; return `<div class="dish-grid">${items.map(d=>{const src=image(d.image);return `<article class="dish-card"><div class="dish-image">${src?`<img src="${esc(src)}" alt="" loading="lazy">`:'<span>食</span>'}<span class="availability">${d.is_available===false?'已下架':'已上架'}</span></div><div class="dish-body"><div class="dish-meta">${esc(d.category||'未分类')} ${d.cuisine&&d.cuisine!=='未分类'?' / '+esc(d.cuisine):''}</div><h3>${esc(d.name)}</h3><p>${esc(d.note||'这道菜还没有介绍')}</p><div class="card-foot"><span>${esc(codeLabel(d.user_code))}</span><time>${esc(date(d.created_at))}</time></div></div></article>`;}).join('')}</div>`; }
 function diaryList(items) { if(!items.length)return '<div class="empty"><strong>还没有找到日记</strong><p>换个用户或关键词看看。</p></div>'; return `<div class="diary-list">${items.map(d=>`<article class="diary-card"><div class="diary-date"><strong>${esc((d.meal_date||'').slice(8,10)||'—')}</strong><span>${esc((d.meal_date||'').slice(0,7).replace('-','.'))}</span></div><div class="diary-body"><div class="diary-title"><h3>${esc(d.title)}</h3><span>${esc(codeLabel(d.user_code))}</span></div><div class="dish-names">${(Array.isArray(d.dishes)?d.dishes:[]).map(x=>`<span>${esc(x.name)}</span>`).join('')}</div><p>${esc(d.note||'没有填写文字记录')}</p><small>保存于 ${esc(date(d.created_at))}</small></div></article>`).join('')}</div>`; }
 if(!sb) { app.innerHTML='<div class="loading">Supabase 配置不可用</div>'; return; }
 sb.auth.getSession().then(({data})=>data.session?load():login()).catch(()=>login('连接失败，请检查网络。'));
})();
