// This draft is local to the current open app; the AI receives only selected dish IDs.
const shopping = {items:[], menuKey:'', loading:false, error:'', request:0};
function resetShopping(){shopping.request++;shopping.items=[];shopping.menuKey='';shopping.loading=false;shopping.error=''}
function serializeShoppingDraft(){return shopping.menuKey ? {menuKey:shopping.menuKey,items:shopping.items} : null}
function restoreShoppingDraft(draft){
 if(!draft || typeof draft.menuKey!=='string' || draft.menuKey.length>10000 || !Array.isArray(draft.items) || draft.items.length>100)return;
 if(draft.items.some(item=>!item || typeof item.name!=='string' || !item.name.trim() || item.name.length>30 || !['主食材','调味料'].includes(item.category)))return;
 shopping.menuKey=draft.menuKey;shopping.items=draft.items.map(item=>({name:item.name.trim(),category:item.category,checked:item.checked===true}));
}
const shoppingMenuKey = () => JSON.stringify(selectedDishes().map(d=>[d.id,d.name]));
function renderShopping() {
 app.className='phone-screen shopping-screen';
 const changed=shopping.menuKey && shopping.menuKey!==shoppingMenuKey();
 const groups=['主食材','调味料'];
 const sections=groups.map(category=>{
  const items=shopping.items.map((item,index)=>({...item,index})).filter(item=>item.category===category);
  if(!items.length)return '';
  return `<section class="shopping-group"><h3>${category}</h3>${items.map(item=>`<div class="shopping-row"><input type="checkbox" data-shopping-check="${item.index}" aria-label="已备好${escapeText(item.name)}" ${item.checked?'checked':''}><input class="shopping-name" data-shopping-name="${item.index}" aria-label="编辑${escapeText(item.name)}" maxlength="30" value="${escapeText(item.name)}"><button class="shopping-remove" type="button" data-shopping-remove="${item.index}" aria-label="删除${escapeText(item.name)}">${icon('close')}</button></div>`).join('')}</section>`;
 }).join('');
 app.innerHTML=`<div class="screen-scroll shopping-scroll"><div class="page-heading"><button data-page="menu" aria-label="返回菜单">${icon('back')}</button><span>家的味道</span></div><div class="shopping-heading"><div><h2>买菜清单</h2><p>根据菜单整理，买之前可以调整。</p></div></div>${changed?'<p class="shopping-notice" role="status">菜单已调整，清单仍是上次生成的内容。</p>':''}${shopping.loading?`<div class="shopping-loading" role="status" aria-live="polite"><span class="shopping-loading-spinner" aria-hidden="true"></span><div><strong>正在整理买菜清单</strong><p>${shopping.menuKey?'新清单生成后将替换下方内容':'正在根据菜单整理食材和调味料'}</p></div></div>`:shopping.error?`<div class="shopping-status" role="status">${escapeText(shopping.error)}<button type="button" data-action="shopping-generate">重试</button></div>`:''}${shopping.items.length || shopping.menuKey?`${shopping.items.length ? `<div class="shopping-list">${sections}</div>` : ''}<form class="shopping-add" id="shopping-add"><input name="name" maxlength="30" placeholder="补充需要买的食材" aria-label="补充需要买的食材" required><select name="category" aria-label="食材分类"><option>主食材</option><option>调味料</option></select><button type="submit">添加</button></form>${shopping.items.length ? `<div class="shopping-export"><button type="button" data-action="shopping-copy">复制文字</button><button type="button" data-action="shopping-image">保存图片</button></div>` : ''}<p class="shopping-disclaimer">AI 根据菜名推测，请按家里的做法检查。</p><button class="shopping-regenerate" type="button" data-action="shopping-generate" ${shopping.loading?'disabled':''}>${changed?'根据新菜单重新生成':'重新生成'}</button>`:shopping.loading||shopping.error?'':'<div class="shopping-status">清单里还没有食材。</div>'}</div>`;
 bind();bindShopping();
}
function bindShopping() {
 app.querySelectorAll('[data-shopping-check]').forEach(input=>input.onchange=()=>{shopping.items[Number(input.dataset.shoppingCheck)].checked=input.checked;saveMenuDraft();input.closest('.shopping-row')?.classList.toggle('is-checked',input.checked)});
 app.querySelectorAll('[data-shopping-name]').forEach(input=>input.onchange=()=>{const item=shopping.items[Number(input.dataset.shoppingName)];const name=input.value.trim();if(!name){input.value=item.name;notify('食材名称不能为空');return}item.name=name;input.value=name;saveMenuDraft()});
 app.querySelectorAll('[data-shopping-remove]').forEach(button=>button.onclick=()=>{shopping.items.splice(Number(button.dataset.shoppingRemove),1);saveMenuDraft();renderShopping()});
 const form=app.querySelector('#shopping-add');if(form)form.onsubmit=e=>{e.preventDefault();const name=form.elements.name.value.trim();if(!name)return;if(shopping.items.length>=100){notify('清单最多添加 100 项');return}shopping.items.push({name,category:form.elements.category.value,checked:false});saveMenuDraft();renderShopping()};
 const copy=app.querySelector('[data-action=shopping-copy]');if(copy)copy.onclick=copyShoppingText;
 const image=app.querySelector('[data-action=shopping-image]');if(image)image.onclick=saveShoppingImage;
 app.querySelectorAll('[data-action=shopping-generate]').forEach(button=>button.onclick=()=>{if(shopping.items.length&&!window.confirm('重新生成会替换当前清单，确定继续吗？'))return;generateShopping()});
}
async function generateShopping() {
 const selected=selectedDishes();if(!selected.length){shopping.error='请先选择菜品';renderShopping();return}
 if(selected.length>40){shopping.error='每次最多为 40 道菜生成清单';renderShopping();return}
 if(offlineMode || !window.JIAYAN_SUPABASE){shopping.error='请联网后再生成买菜清单';renderShopping();return}
 const key=shoppingMenuKey(), request=++shopping.request;shopping.loading=true;shopping.error='';if(state.page==='shopping')renderShopping();
 const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),40000);
 try {
  const {data:sessionData,error:sessionError}=await sb.auth.getSession();
  if(sessionError || !sessionData.session)throw new Error('登录已失效，请重新登录');
  const response=await fetch(`${window.JIAYAN_SUPABASE.url}/functions/v1/shopping-list`,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.JIAYAN_SUPABASE.publishableKey,'Authorization':`Bearer ${sessionData.session.access_token}`},body:JSON.stringify({dishIds:selected.map(d=>d.id)}),signal:controller.signal});
  const data=await response.json().catch(()=>({}));if(!response.ok){const messages={unauthorized:'登录已失效，请重新登录',limit:'今天的生成次数已用完，明天再试试',invalid_menu:'菜单有变化，请检查后重试'};throw new Error(messages[data.error]||'生成失败，请稍后重试')}
  if(!Array.isArray(data.ingredients)||!data.ingredients.length||data.ingredients.length>100||data.ingredients.some(item=>!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>30||!['主食材','调味料'].includes(item.category)))throw new Error('清单未能生成，请重试');
  if(request!==shopping.request)return;
  if(key!==shoppingMenuKey())throw new Error('菜单已变化，请重新生成');
  shopping.items=data.ingredients.map(item=>({name:item.name.trim(),category:item.category,checked:false}));shopping.menuKey=key;saveMenuDraft();
 } catch(error) {if(request===shopping.request)shopping.error=error.name==='AbortError'?'生成超时，请稍后重试':error.message==='Failed to fetch'?'网络连接失败，请稍后重试':error.message||'生成失败，请稍后重试'}
 finally {clearTimeout(timer);if(request===shopping.request){shopping.loading=false;if(state.page==='shopping')renderShopping()}}
}
function openShopping() {
 state.page='shopping';render();return generateShopping();
}

// Include checked items so a shared list still shows what has already been prepared.
function shoppingText(items) {
 const groups=['主食材','调味料'].map(category=>{
  const rows=items.filter(item=>item.category===category);
  return rows.length ? `${category}\n${rows.map(item=>`${item.checked?'☑':'☐'} ${item.name}`).join('\n')}` : '';
 }).filter(Boolean);
 return ['家宴 · 买菜清单',...groups].join('\n\n');
}
async function copyShoppingText() {
 const text=shoppingText(shopping.items);if(!shopping.items.length)return;
 try {
  let copied=false;
  if(navigator.clipboard?.writeText)try{await navigator.clipboard.writeText(text);copied=true}catch(_){}
  if(!copied){
   const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(field);
   try{field.select();copied=document.execCommand('copy')}finally{field.remove()}
  }
  if(!copied)throw new Error('copy failed');notify('清单已复制');
 } catch (_) {notify('复制失败，请检查浏览器权限后重试')}
}

function drawShoppingImage(items) {
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('canvas unavailable');
 const width=720, margin=64, maxWidth=width-margin*2-55;canvas.width=width;
 ctx.font='30px "PingFang SC",sans-serif';
 const groups=['主食材','调味料'].map(category=>({category,rows:items.filter(i=>i.category===category).map(item=>{
  let line='',lines=[];for(const char of item.name){if(line && ctx.measureText(line+char).width>maxWidth){lines.push(line);line=char}else line+=char}if(line)lines.push(line);
  return {...item,lines};
 })})).filter(group=>group.rows.length);
 const height=250+groups.reduce((n,g)=>n+72+g.rows.reduce((sum,row)=>sum+Math.max(58,row.lines.length*40+18),0),0)+100;
 canvas.height=height;ctx.fillStyle='#f5e9db';ctx.fillRect(0,0,width,height);ctx.fillStyle='#fffcf7';ctx.fillRect(24,24,width-48,height-48);
 ctx.fillStyle='#ab604b';ctx.font='600 21px "PingFang SC",sans-serif';ctx.fillText('家宴  ·  好好吃饭',margin,94);
 ctx.fillStyle='#49382e';ctx.font='600 54px "Songti SC","STSong",serif';ctx.fillText('买菜清单',margin,164);
 ctx.fillStyle='#9f8877';ctx.font='21px "PingFang SC",sans-serif';ctx.fillText('打勾表示已备好',margin,205);
 let y=250;
 for(const group of groups){
  ctx.fillStyle='#a86b55';ctx.font='600 24px "PingFang SC",sans-serif';ctx.fillText(group.category,margin,y+20);y+=56;
  for(const item of group.rows){
   ctx.strokeStyle=item.checked?'#ad735f':'#cbb8a9';ctx.lineWidth=2;ctx.strokeRect(margin,y-21,23,23);
   if(item.checked){ctx.strokeStyle='#ad735f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(margin+5,y-10);ctx.lineTo(margin+10,y-5);ctx.lineTo(margin+19,y-17);ctx.stroke()}
   ctx.fillStyle=item.checked?'#a99a8f':'#49382e';ctx.font='30px "PingFang SC",sans-serif';
   item.lines.forEach((line,index)=>ctx.fillText(line,margin+48,y+index*40));
   y+=Math.max(58,item.lines.length*40+18);
  }
  y+=16;
 }
 ctx.fillStyle='#a28c7b';ctx.font='20px "PingFang SC",sans-serif';ctx.fillText('按家里的做法，慢慢准备。',margin,height-65);
 return canvas;
}
async function saveShoppingImage() {
 if(!shopping.items.length)return;let imageUrl=null,overlay=null;
 try {
  const canvas=drawShoppingImage(shopping.items);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw Error('image encoding failed');
  imageUrl=URL.createObjectURL(blob);const file=new File([blob],'家宴买菜清单.png',{type:'image/png'});
  overlay=document.createElement('div');overlay.className='image-overlay';
  overlay.innerHTML=`<div class="image-dialog shopping-image-dialog" role="dialog" aria-modal="true" aria-label="买菜清单图片预览"><div class="image-dialog-head"><div><strong>买菜清单</strong><span>保存图片，买菜时随手查看</span></div><button class="image-close" type="button" aria-label="关闭预览">${icon('close')}</button></div><div class="image-preview"><img alt="买菜清单图片"></div><div class="image-actions"><button class="image-save" type="button" hidden>保存到相册</button><a class="image-download" download="家宴买菜清单.png">下载图片</a></div><p class="image-save-hint">也可以长按图片保存</p></div>`;
  document.body.appendChild(overlay);const img=overlay.querySelector('img'),download=overlay.querySelector('.image-download'),share=overlay.querySelector('.image-save');img.src=imageUrl;download.href=imageUrl;share.hidden=!(typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}));
  const close=()=>{overlay.remove();URL.revokeObjectURL(imageUrl);document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  overlay.querySelector('.image-close').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};
  share.onclick=async()=>{try{await navigator.share({files:[file],title:'家宴买菜清单'});close()}catch(error){if(error?.name!=='AbortError')notify('未能打开系统保存，试试长按图片')}};
  overlay.querySelector('.image-close').focus();
 } catch(_){if(overlay)overlay.remove();if(imageUrl)URL.revokeObjectURL(imageUrl);notify('生成清单图片失败，请重试')}
}
