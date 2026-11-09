const nutrition = {result:null, menuKey:'', loading:false, error:'', request:0};
function resetNutrition(){nutrition.request++;nutrition.result=null;nutrition.menuKey='';nutrition.loading=false;nutrition.error=''}
function nutritionMenuKey(){return JSON.stringify(selectedDishes().map(d=>[d.id,d.name]).sort((a,b)=>a[0].localeCompare(b[0])))}
function renderNutrition(){
 const changed=nutrition.menuKey && nutrition.menuKey!==nutritionMenuKey(), result=changed?null:nutrition.result;
 const metrics=[['energyKcal','热量','千卡'],['proteinG','蛋白质','克'],['carbsG','碳水','克'],['fatG','脂肪','克']];
 return `<section class="nutrition-card" aria-label="AI 营养分析"><div class="nutrition-head"><div><span class="nutrition-label">AI · 好好吃饭</span><h3>这一餐的营养</h3></div><button type="button" data-action="nutrition-generate" ${nutrition.loading?'disabled':''}>${nutrition.loading?'分析中…':result?'重新分析':'营养分析'}</button></div><div class="nutrition-content" aria-live="polite" aria-busy="${nutrition.loading}">${nutrition.loading?'<p class="nutrition-status"><span class="shopping-loading-spinner" aria-hidden="true"></span>正在分析今日菜单的营养搭配…</p>':''}${nutrition.error?`<p class="nutrition-error" role="alert">${escapeText(nutrition.error)}</p>`:''}${changed?'<p class="nutrition-hint">菜单已调整，请重新分析。</p>':''}${result?`<p class="nutrition-summary">${escapeText(result.summary)}</p><p class="nutrition-scope">整桌菜估算 · 非每人摄入量</p><dl class="nutrition-metrics">${metrics.map(([key,label,unit])=>`<div><dt>${label}</dt><dd>${Math.round(result.totals[key].min)}–${Math.round(result.totals[key].max)}<small>${unit}</small></dd></div>`).join('')}</dl><div class="nutrition-advice"><h4>搭配亮点</h4><ul>${result.strengths.map(text=>`<li>${escapeText(text)}</li>`).join('')}</ul><h4>可以这样调整</h4><ul>${result.suggestions.map(text=>`<li>${escapeText(text)}</li>`).join('')}</ul></div><details class="nutrition-assumption"><summary>查看估算依据</summary><p>${escapeText(result.assumption)}</p></details>`:!nutrition.loading&&!nutrition.error&&!changed?'<p class="nutrition-hint">看看热量与营养搭配，为今天这一餐添一点参考。</p>':''}</div><p class="nutrition-disclaimer">AI 按菜名与常见份量估算，实际数值随食材和做法变化，仅供饮食参考。</p></section>`;
}
function refreshNutrition(){if(state.page!=='nutrition')return;const card=app.querySelector('.nutrition-card');if(card){card.outerHTML=renderNutrition();bindNutrition()}}
function bindNutrition(){const entry=app.querySelector('[data-action=nutrition-open]');if(entry)entry.onclick=openNutrition;const button=app.querySelector('[data-action=nutrition-generate]');if(button)button.onclick=generateNutrition}
function validNutrition(data){
 if(!data||typeof data.summary!=='string'||!data.summary.trim()||data.summary.length>180||typeof data.assumption!=='string'||!data.assumption.trim()||data.assumption.length>240)return false;
 if(['strengths','suggestions'].some(key=>!Array.isArray(data[key])||data[key].length<1||data[key].length>4||data[key].some(text=>typeof text!=='string'||!text.trim()||text.length>120)))return false;
 return ['energyKcal','proteinG','carbsG','fatG'].every(key=>{const range=data.totals?.[key];return range&&Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.min>=0&&range.max>range.min&&range.max<=(key==='energyKcal'?100000:20000)});
}
async function generateNutrition(){
 if(nutrition.loading)return;
 const selected=selectedDishes();nutrition.error='';
 if(!selected.length||selected.length>40){nutrition.error='请先选择 1–40 道菜再分析';refreshNutrition();return}
 if(offlineMode||!window.JIAYAN_SUPABASE){nutrition.error='请联网后再进行营养分析';refreshNutrition();return}
 const key=nutritionMenuKey(), request=++nutrition.request;
 nutrition.loading=true;refreshNutrition();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),40000);
 try{
  const {data,error}=await sb.auth.getSession();
  if(error||!data.session)throw Error('登录已失效，请重新登录');
  if(request!==nutrition.request)return;
  const response=await fetch(`${window.JIAYAN_SUPABASE.url}/functions/v1/shopping-list`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.JIAYAN_SUPABASE.publishableKey,'Authorization':`Bearer ${data.session.access_token}`},body:JSON.stringify({task:'nutrition',dishIds:selected.map(d=>d.id)}),signal:controller.signal});
  const output=await response.json().catch(()=>({}));
  if(!response.ok){const messages={unauthorized:'登录已失效，请重新登录',limit:'今天的 AI 次数已用完，明天再试试',invalid_menu:'菜单有变化，请检查菜品后重试',invalid_response:'分析数据不完整，请重试'};throw Error(messages[output.error]||'分析失败，请稍后重试')}
  if(!validNutrition(output.nutrition))throw Error('分析数据不完整，请重试');
  if(request!==nutrition.request)return;
  if(key!==nutritionMenuKey())throw Error('菜单已变化，请重新分析');
  nutrition.result=output.nutrition;nutrition.menuKey=key;
 }catch(error){if(request===nutrition.request)nutrition.error=error.name==='AbortError'?'分析超时，请稍后重试':error.message==='Failed to fetch'?'网络连接失败，请稍后重试':error.message||'分析失败，请稍后重试'}
 finally{clearTimeout(timer);if(request===nutrition.request){nutrition.loading=false;refreshNutrition()}}
}

function renderNutritionPage(){
 app.className='phone-screen nutrition-screen';
 const selected=selectedDishes();
 app.innerHTML=`<div class="screen-scroll nutrition-scroll"><div class="page-heading"><button type="button" data-page="menu" aria-label="返回菜单">${icon('back')}</button><span>家的味道</span></div><div class="nutrition-page-heading"><span class="nutrition-label">AI · 今日菜单</span><h2>营养分析</h2><p>看看这一餐的搭配，吃得更有数。</p></div><div class="nutrition-menu-context"><strong>本次分析 · ${selected.length} 道菜</strong><p>${selected.length?selected.map(d=>escapeText(d.name)).join(' · '):'还没有选菜，返回菜单挑几道喜欢的菜。'}</p></div>${renderNutrition()}</div>`;
 bind();
}
function openNutrition(){
 state.page='nutrition';render();
 if(!nutrition.loading && (!nutrition.result || nutrition.menuKey!==nutritionMenuKey()))return generateNutrition();
}
