// One shared confirmation surface for actions that can change or replace data.
let activeConfirmation = false;
function confirmAction({title, message, confirmLabel='确定', cancelLabel='再想想'}) {
 if(activeConfirmation)return Promise.resolve(false);
 activeConfirmation=true;
 return new Promise(resolve=>{
  const previousFocus=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='confirm-dialog';
  dialog.setAttribute('aria-labelledby','confirm-dialog-title');
  dialog.setAttribute('aria-describedby','confirm-dialog-message');
  dialog.innerHTML='<div class="confirm-dialog-content"><div class="confirm-dialog-mark" aria-hidden="true">家</div><p class="confirm-dialog-kicker">家宴 · 温馨提示</p><h2 id="confirm-dialog-title"></h2><p id="confirm-dialog-message" class="confirm-dialog-message"></p><div class="confirm-dialog-actions"><button type="button" class="confirm-dialog-cancel"></button><button type="button" class="confirm-dialog-confirm"></button></div></div>';
  dialog.querySelector('#confirm-dialog-title').textContent=title;
  dialog.querySelector('#confirm-dialog-message').textContent=message;
  const cancel=dialog.querySelector('.confirm-dialog-cancel'),confirm=dialog.querySelector('.confirm-dialog-confirm');
  cancel.textContent=cancelLabel;confirm.textContent=confirmLabel;
  let finished=false;
  const finish=result=>{
   if(finished)return;
   finished=true;activeConfirmation=false;
   if(dialog.open)dialog.close();
   dialog.remove();
   if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
   resolve(result);
  };
  cancel.addEventListener('click',()=>finish(false));
  confirm.addEventListener('click',()=>finish(true));
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)});
  dialog.addEventListener('close',()=>finish(false));
  document.body.appendChild(dialog);
  dialog.showModal();
  cancel.focus();
 });
}
