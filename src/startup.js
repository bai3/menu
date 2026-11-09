// Only installed PWAs show the H5 splash. Native shells own their startup UI.
(() => {
 const app = document.getElementById('app');
 let done = false;
 const finish = () => {
  if (done || !app.firstElementChild) return;
  done = true;
  observer.disconnect();
  clearTimeout(timer);
  document.getElementById('launch').hidden = true;
  document.documentElement.classList.remove('startup-failed');
  // Wait for the rendered login/home screen to paint before releasing native startup.
  requestAnimationFrame(() => requestAnimationFrame(() => window.JiayanImageExport?.ready?.()));
 };
 const observer = new MutationObserver(finish);
 observer.observe(app, {childList:true});
 const timer = setTimeout(() => {
  document.documentElement.classList.add('startup-failed');
  window.JiayanImageExport?.ready?.();
 }, 15000);
 finish();
})();
