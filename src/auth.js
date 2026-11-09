// Supabase persists sessions; local content is scoped by the authenticated UUID.
function authMessage(error) {
 const messages={invalid_credentials:'邮箱或密码不正确',email_not_confirmed:'请先打开邮箱中的验证链接，再登录',user_already_exists:'该邮箱已注册，请直接登录',email_exists:'该邮箱已注册，请直接登录',signup_disabled:'暂未开放注册',over_email_send_rate_limit:'邮件发送太频繁，请稍后重试',over_request_rate_limit:'操作太频繁，请稍后重试',weak_password:'密码强度不足，请使用更长的密码'};
 return messages[error?.code] || (error?.status===429?'操作太频繁，请稍后重试':'操作失败，请检查网络后重试');
}
function authDeadline(promise) {
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('连接超时')),10000)})]).finally(()=>clearTimeout(timer));
}
function authReturnUrl() { return location.origin+location.pathname; }
function renderAuth({mode='login',message='',email=''}={}) {
 const signup=mode==='signup';
 app.className='phone-screen auth-screen';
 app.innerHTML=`<div class="auth-scroll"><div class="auth-top"><div class="auth-brand">${logo}<span>家宴<small>家的味道</small></span></div><button class="appearance-entry" type="button" data-action="appearance" aria-label="外观设置">${icon('appearance')}</button></div><div class="auth-intro"><span class="auth-kicker">A SEAT AT THE TABLE</span><h1>${signup?'为你留一个<br>家的位置':'欢迎回到<br>家的餐桌'}</h1><p>${signup?'创建账号，把喜欢的菜和每一餐的回忆，<br>好好收藏起来。':'登录家宴，<br>继续收藏每一餐的好味道。'}</p></div><div class="auth-tabs" role="group" aria-label="登录或注册"><button type="button" data-auth-mode="login" aria-pressed="${!signup}">登录</button><button type="button" data-auth-mode="signup" aria-pressed="${signup}">注册</button></div><form class="auth-form"><label for="auth-email">邮箱</label><input id="auth-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="254" placeholder="请输入邮箱" value="${escapeText(email)}"><label for="auth-password">密码</label><input id="auth-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" ${signup?'minlength="8"':''} required maxlength="128" placeholder="${signup?'至少 8 位密码':'请输入密码'}">${signup?'<label for="auth-confirm">确认密码</label><input id="auth-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required placeholder="请再次输入密码">':''}<p class="auth-help">${signup?'注册后请查收验证邮件，完成邮箱验证。':'登录后可在不同设备查看你的菜单和日记。'}</p><p id="auth-error" class="auth-error" role="status" aria-live="polite">${escapeText(message)}</p><button class="auth-submit" type="submit">${signup?'注册家宴':'登录家宴'}</button><button class="auth-cancel" type="button" data-auth-resend>重新发送验证邮件</button></form><div class="auth-foot"><span></span>好好吃饭，慢慢生活<span></span></div></div>`;
 const form=app.querySelector('.auth-form'),status=app.querySelector('#auth-error');
 let busy=false;
 const lock=value=>{busy=value;form.querySelectorAll('button').forEach(button=>button.disabled=value);app.querySelectorAll('[data-auth-mode]').forEach(button=>button.disabled=value)};
 app.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>{if(!busy)renderAuth({mode:button.dataset.authMode,email:form.elements.email.value})});
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const email=form.elements.email.value.trim(),password=form.elements.password.value;
  if(signup && password!==form.elements.confirm.value){status.textContent='两次输入的密码不一致';form.elements.confirm.focus();return;}
  lock(true);status.textContent=signup?'正在注册…':'正在登录…';
  try {
   if(!sb)throw new Error('配置不可用');
   const {data,error}=await authDeadline(signup?sb.auth.signUp({email,password,options:{emailRedirectTo:authReturnUrl()}}):sb.auth.signInWithPassword({email,password}));
   if(error)throw error;
   if(data.session){await startApp();return;}
   renderAuth({email,message:'请查收邮箱中的验证链接，验证后即可登录。若已注册，请直接登录。'});
  } catch(error){status.textContent=authMessage(error);}
  finally{lock(false);}
 };
 app.querySelector('[data-auth-resend]').onclick=async()=>{
  if(busy)return;if(!form.elements.email.reportValidity())return;
  lock(true);status.textContent='正在发送…';
  try{if(!sb)throw Error();const {error}=await authDeadline(sb.auth.resend({type:'signup',email:form.elements.email.value.trim(),options:{emailRedirectTo:authReturnUrl()}}));if(error)throw error;status.textContent='如该邮箱需要验证，验证邮件已发送，请查收。';}catch(error){status.textContent=authMessage(error);}finally{lock(false);}
 };
}
function renderAccount() {
 app.className='phone-screen account-screen';
 const email=authUser?.email || '未提供邮箱';
 app.innerHTML=`<div class="screen-scroll account-scroll"><div class="page-heading"><button type="button" data-page="menu" aria-label="返回菜单">${icon('back')}</button><span>我的家宴</span></div><div class="account-heading"><span class="account-avatar">${icon('account')}</span><h2>我的账号</h2><p>一餐一饭，都在这里。</p></div><h3 class="account-section-label">账号信息</h3><section class="account-info" aria-label="账号信息"><span>登录邮箱</span><strong>${escapeText(email)}</strong></section><h3 class="account-section-label">偏好设置</h3><button class="account-setting" type="button" data-action="appearance"><span>${icon('appearance')}<span class="account-setting-copy"><strong>外观设置</strong><small>选择喜欢的配色与明暗</small></span></span>${icon('forward')}</button><button class="account-sign-out" type="button" data-action="sign-out">退出登录</button><p class="account-footnote">好好吃饭，慢慢生活</p></div>`;
 bind();
}
function clearAccountView() {
 authUser=null;ownerKey='';offlineMode=false;dishes=[];dishChangeVersion++;
 historyEntries=[];historyRequest++;recommendationMeals=[];recommendationHasData=false;
 state.selected=[];state.diaryNote='';state.diaryPhoto='';state.draftImage=null;state.editingId=null;state.planResult=null;state.title='今天的菜单';state.page='dishes';
 resetShopping();
 document.querySelectorAll('.paper-overlay,.image-dialog,.detail-backdrop').forEach(node=>node.remove());
 for(const url of photoUrls.values())URL.revokeObjectURL(url);
 photoUrls.clear();
}
async function signOutAccount() {
 const button=app.querySelector('[data-action=sign-out]');if(button)button.disabled=true;
 try{const {error}=await sb.auth.signOut({scope:'local'});if(error)throw error;clearAccountView();location.reload();}
 catch(_){if(button)button.disabled=false;notify('退出失败，请重试');}
}
async function loadAccountCache() {
 const key=await idbGet(cacheKey('verified-owner'));
 const cached=await idbGet(cacheKey('dishes'));
 if(typeof key!=='string' || !key || !Array.isArray(cached) || !cached.every(isValidDish))return false;
 ownerKey=key;dishes=cached.map(normalizeDish);offlineMode=true;restoreMenuDraft();render();return true;
}
async function migrateAccountDraft() {
 // Only use a server-verified ownership key, never a code from the URL.
 const oldKey=`jiayan.menu-draft.v1:${ownerKey}`;
 try{const old=localStorage.getItem(oldKey);if(old && !localStorage.getItem(draftStorageKey()))localStorage.setItem(draftStorageKey(),old);localStorage.removeItem(oldKey);localStorage.removeItem('jiayan.beta-code.v1');}catch(_){}
}
async function startApp() {
 const url=new URL(location.href);if(url.searchParams.has('code')){url.searchParams.delete('code');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
 const invite=sharedInviteFromUrl();if(invite){sharedStart(invite);return;}
 try{
  if(!sb)throw Error();
  const {data,error}=await authDeadline(sb.auth.getSession());if(error)throw error;
  if(!data.session){renderAuth();return;}
  authUser=data.session.user;
  const verified=await authDeadline(sb.auth.getUser());
  if(verified.error){if(verified.error.status>=400 && verified.error.status<500){clearAccountView();renderAuth({message:'登录已失效，请重新登录'});return;}throw verified.error;}
  if(verified.data.user?.id!==authUser.id)throw Error();
  const result=await authDeadline(sb.rpc('current_owner_key'));
  if(result.error || !result.data){renderAuth({message:'账户数据尚未就绪，请联系管理员检查数据库迁移'});return;}
  ownerKey=result.data;
  await idbSet(cacheKey('verified-owner'),ownerKey).catch(()=>{});
  await migrateAccountDraft();restoreMenuDraft();render();await initDishes();
 }catch(_){if(authUser){try{if(await loadAccountCache())return;}catch(_){}}renderAuth({message:'连接失败，请检查网络后重试'});}
}
// Do not await Supabase calls inside this callback: it runs under the session lock.
if(sb)sb.auth.onAuthStateChange((event,session)=>{
 if(event==='SIGNED_OUT' || (authUser && session?.user && authUser.id!==session.user.id)){
  clearAccountView();if(!sharedInviteFromUrl())renderAuth({message:event==='SIGNED_OUT'?'已退出登录':''});
 }
});
