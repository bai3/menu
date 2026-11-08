/* Appearance settings are shared by this browser's visits, including offline launches. */
(() => {
 const key = 'jiayan.appearance.v1';
 const palettes = {terracotta: '暖陶红', green: '餐桌绿', plum: '烟熏梅'};
 const modes = {system: '跟随系统', light: '明亮', dark: '深色'};
 const media = window.matchMedia('(prefers-color-scheme: dark)');
 let settings = {palette: 'terracotta', mode: 'system'};
 let opener = null;
 const valid = value => ({
  palette: Object.prototype.hasOwnProperty.call(palettes, value?.palette) ? value.palette : 'terracotta',
  mode: Object.prototype.hasOwnProperty.call(modes, value?.mode) ? value.mode : 'system'
 });
 try { settings = valid(JSON.parse(localStorage.getItem(key) || '{}')); } catch (_) {}
 function apply() {
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && media.matches);
  document.documentElement.dataset.palette = settings.palette;
  document.documentElement.dataset.appearance = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#211e1c' : '#f8f0e4');
 }
 function updateControls(dialog) {
  dialog.querySelectorAll('[data-palette]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === settings.palette)));
  dialog.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode)));
 }
 function save(dialog) {
  apply();
  try { localStorage.setItem(key, JSON.stringify(settings)); dialog.querySelector('.appearance-status').textContent = '已保存在本机'; }
  catch (_) { dialog.querySelector('.appearance-status').textContent = '本机无法保存设置，重新打开后可能需要重新选择'; }
  updateControls(dialog);
 }
 function close(dialog) { dialog.remove(); document.removeEventListener('keydown', onKey); opener?.focus({preventScroll:true}); opener = null; }
 function onKey(event) {
  const dialog = document.querySelector('.appearance-overlay');
  if (!dialog) return;
  if (event.key === 'Escape') { event.preventDefault(); close(dialog); }
  if (event.key === 'Tab') {
   const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
   const first = buttons[0], last = buttons[buttons.length - 1];
   if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
   else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
 }
 function open(trigger) {
  if (document.querySelector('.appearance-overlay')) return;
  opener = trigger;
  const overlay = document.createElement('div');
  overlay.className = 'appearance-overlay';
  overlay.innerHTML = `<section class="appearance-dialog" role="dialog" aria-modal="true" aria-labelledby="appearance-title"><div class="appearance-head"><div><span>MAKE IT YOURS</span><h2 id="appearance-title">外观设置</h2><p>让餐桌，变成你喜欢的样子。</p></div><button type="button" class="appearance-close" aria-label="关闭外观设置"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6.5 6.5 11 11m0-11-11 11"/></svg></button></div><div class="appearance-section"><div class="appearance-label"><strong>主题配色</strong><span>选一种喜欢的颜色</span></div><div class="appearance-palettes" role="group" aria-label="主题配色"><button type="button" data-palette="terracotta"><i></i><strong>暖陶红</strong><small>温暖家常</small></button><button type="button" data-palette="green"><i></i><strong>餐桌绿</strong><small>自然清新</small></button><button type="button" data-palette="plum"><i></i><strong>烟熏梅</strong><small>沉静柔和</small></button></div></div><div class="appearance-section"><div class="appearance-label"><strong>显示模式</strong><span>随时切换</span></div><div class="appearance-modes" role="group" aria-label="显示模式"><button type="button" data-mode="system">跟随系统</button><button type="button" data-mode="light">明亮</button><button type="button" data-mode="dark">深色</button></div></div><p class="appearance-status" role="status" aria-live="polite">设置会自动保存在本机</p></section>`;
  document.body.appendChild(overlay);
  updateControls(overlay);
  overlay.querySelector('.appearance-close').onclick = () => close(overlay);
  overlay.addEventListener('click', event => {
   if (event.target === overlay) { close(overlay); return; }
   const palette = event.target.closest('[data-palette]');
   const mode = event.target.closest('[data-mode]');
   if (palette && Object.prototype.hasOwnProperty.call(palettes, palette.dataset.palette)) { settings.palette = palette.dataset.palette; save(overlay); }
   if (mode && Object.prototype.hasOwnProperty.call(modes, mode.dataset.mode)) { settings.mode = mode.dataset.mode; save(overlay); }
  });
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.appearance-close').focus();
 }
 apply();
 const onSystemChange = () => { if (settings.mode === 'system') apply(); };
 if (media.addEventListener) media.addEventListener('change', onSystemChange);
 else if (media.addListener) media.addListener(onSystemChange);
 window.addEventListener('storage', event => {
  if (event.key !== key) return;
  try { settings = valid(JSON.parse(event.newValue || '{}')); } catch (_) { settings = valid({}); }
  apply();
  const dialog = document.querySelector('.appearance-overlay'); if (dialog) updateControls(dialog);
 });
 document.addEventListener('click', event => {
  const trigger = event.target.closest('[data-action="appearance"]');
  if (trigger) open(trigger);
 });
})();
