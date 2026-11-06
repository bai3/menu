// The restaurant menu uses the active catalogue without mixing local and shared selections.
function paperDishes() { return sharedMeal.invite && sharedMeal.data?.joined ? sharedMeal.data.catalog.map(normalizeDish) : dishes; }
function paperFilterMode() { return sharedMeal.invite && sharedMeal.data?.joined ? sharedMeal.filterMode : state.filterMode; }
let paperPage = 0;
let paperTurning = false;
let paperTurnTimer = null;
let pendingPaperTap = null;
function paperPages() {
 const field = paperFilterMode() === 'cuisine' ? 'cuisine' : 'category';
 const options = field === 'cuisine' ? cuisines : categories.slice(1);
 const groups = [...options, ...new Set(paperDishes().map(d => d[field]).filter(value => value && !options.includes(value)))];
 const pages = [];
 groups.forEach(group => {
  const items = paperDishes().filter(d => d[field] === group && d.is_available);
  for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
 });
 if (!pages.length) pages.push([]);
 if (pages.length % 2) pages.push([]);
 return pages;
}
function paperLeaf(items, pageNumber) {
 const field = paperFilterMode() === 'cuisine' ? 'cuisine' : 'category';
 return `<section class="paper-leaf ${pageNumber % 2 ? 'paper-leaf-right' : 'paper-leaf-left'}"><div class="paper-leaf-inner"><header class="paper-leaf-head"><span>白家私厨</span><span>THE FAMILY MENU</span></header><div class="paper-leaf-title"><span>THE TASTE OF HOME</span><h2>${items.length ? escapeText(items[0][field]) : '家的味道'}</h2><i></i></div><div class="paper-dishes">${items.length ? items.map((d, index) => `<article class="paper-dish paper-dish-${index + 1}" role="button" tabindex="0" data-paper-dish="${escapeText(d.id)}" aria-label="${escapeText(d.name)}，单击加入菜单，双击取消"><img src="${escapeText(dishImage(d))}" alt="" onerror="this.style.visibility='hidden'"><div class="paper-dish-copy"><span>${escapeText(d[field])}</span><h3>${escapeText(d.name)} ${spiceBadge(d)}</h3><p>${escapeText(d.note || '用心烹调，与你分享')}</p></div></article>`).join('') : '<div class="paper-blank">好好吃饭<br><span>慢慢生活</span></div>'}</div><footer class="paper-leaf-foot"><span>一餐一饭，皆是欢喜</span></footer></div></section>`;
}
function openPaperMenu() {
 paperPage = 0;
 document.body.classList.add('paper-open');
 const overlay = document.createElement('div');
 overlay.className = 'paper-overlay';
 overlay.setAttribute('role', 'dialog');
 overlay.setAttribute('aria-modal', 'true');
 overlay.setAttribute('aria-label', '纸质菜单，滑动或点击页面边缘翻页');
 overlay.onkeydown = e => { if (e.key === 'ArrowLeft') turnPaperPage(-1); else if (e.key === 'ArrowRight') turnPaperPage(1); else if (e.key === 'Escape') closePaperMenu(); };
 document.body.appendChild(overlay);
 renderPaperMenu();
 overlay.querySelector('[data-paper-close]').focus();
}
function renderPaperMenu() {
 const overlay = document.querySelector('.paper-overlay');
 if (!overlay) return;
 const pages = paperPages();
 paperPage = Math.max(0, Math.min(paperPage, pages.length / 2 - 1));
 overlay.innerHTML = `<div class="paper-stage"><header class="paper-toolbar"><button type="button" data-paper-close aria-label="返回菜品列表">返回列表</button><div><strong>白家私厨</strong><span> · 纸质菜单</span></div><span class="paper-toolbar-spacer" aria-hidden="true"></span></header><div class="paper-book-wrap"><div class="paper-book" aria-live="polite">${paperLeaf(pages[paperPage * 2], paperPage * 2)}${paperLeaf(pages[paperPage * 2 + 1], paperPage * 2 + 1)}</div></div></div>`;
 overlay.querySelector('[data-paper-close]').onclick = closePaperMenu;
 let touchStart = null;
 const book = overlay.querySelector('.paper-book');
 const activatePaperDish = dish => {
  const id = dish.dataset.paperDish;
  if (!paperDishes().some(d => d.id === id && d.is_available)) return;
  if (pendingPaperTap && pendingPaperTap.id === id) {
   clearTimeout(pendingPaperTap.timer);
   pendingPaperTap = null;
   if (sharedMeal.invite) sharedChoose(id, false, true);
   else { state.selected = state.selected.filter(selectedId => selectedId !== id); showPaperFeedback(id, false); }
   return;
  }
  flushPaperTap();
  pendingPaperTap = { id, timer: setTimeout(flushPaperTap, 350) };
 };
 book.onclick = e => {
  const dish = e.target.closest('[data-paper-dish]');
  if (dish) { activatePaperDish(dish); return; }
  const rect = book.getBoundingClientRect();
  const rotated = matchMedia('(orientation: portrait)').matches;
  const position = rotated ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
  if (position < .18) turnPaperPage(-1);
  else if (position > .82) turnPaperPage(1);
 };
 book.addEventListener('keydown', e => {
  const dish = e.target.closest('[data-paper-dish]');
  if (dish && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activatePaperDish(dish); }
 });
 book.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { touchStart = null; return; }
  const touch = e.changedTouches[0];
  touchStart = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
 }, { passive: true });
 book.addEventListener('touchmove', e => {
  if (!touchStart) return;
  const touch = Array.from(e.changedTouches).find(item => item.identifier === touchStart.id);
  if (!touch) return;
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  const delta = matchMedia('(orientation: portrait)').matches ? dy : dx;
  const cross = matchMedia('(orientation: portrait)').matches ? dx : dy;
  if (Math.abs(delta) > 10 && Math.abs(delta) > Math.abs(cross)) e.preventDefault();
 }, { passive: false });
 book.addEventListener('touchend', e => {
  if (!touchStart) return;
  const touch = Array.from(e.changedTouches).find(item => item.identifier === touchStart.id);
  if (!touch) return;
  const dx = touch.clientX - touchStart.x, dy = touch.clientY - touchStart.y;
  touchStart = null;
  // The rotated portrait layout maps the book's horizontal axis to screen Y.
  const rotated = matchMedia('(orientation: portrait)').matches;
  const delta = rotated ? dy : dx, cross = rotated ? dx : dy;
  if (Math.abs(delta) > 45 && Math.abs(delta) > Math.abs(cross)) {
   e.preventDefault(); // Do not also treat the swipe as an edge tap.
   turnPaperPage(delta < 0 ? 1 : -1);
  }
 }, { passive: false });
 book.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
}
function showPaperFeedback(id, added) {
 const stage = document.querySelector('.paper-stage');
 const dish = paperDishes().find(item => item.id === id);
 if (!stage || !dish) return;
 stage.querySelector('.paper-feedback-message')?.remove();
 const message = document.createElement('div');
 message.className = 'paper-feedback-message';
 message.setAttribute('role', 'status');
 const title = document.createElement('strong');
 title.textContent = added ? '已加入菜单' : '已取消';
 const name = document.createElement('span');
 name.textContent = dish.name;
 message.append(title, name);
 stage.appendChild(message);
 setTimeout(() => message.remove(), 1600);
}
function flushPaperTap() {
 if (!pendingPaperTap) return;
 const { id, timer } = pendingPaperTap;
 clearTimeout(timer);
 pendingPaperTap = null;
 if (!paperDishes().some(d => d.id === id && d.is_available)) return;
 if (sharedMeal.invite) sharedChoose(id, true, true);
 else { if (!state.selected.includes(id)) state.selected.push(id); showPaperFeedback(id, true); }
}
function turnPaperPage(direction) {
 const pages = paperPages();
 const next = paperPage + direction;
 if (paperTurning || next < 0 || next >= pages.length / 2) return;
 const book = document.querySelector('.paper-book');
 if (!book) return;
 flushPaperTap();
 if (matchMedia('(prefers-reduced-motion: reduce)').matches) { paperPage = next; renderPaperMenu(); return; }
 paperTurning = true;
 book.classList.add('is-turning');
 const currentSide = direction > 0 ? '.paper-leaf-right' : '.paper-leaf-left';
 const front = book.querySelector(currentSide).cloneNode(true);
 const backIndex = direction > 0 ? next * 2 : next * 2 + 1;
 const underIndex = direction > 0 ? next * 2 + 1 : next * 2;
 const sheet = document.createElement('div');
 sheet.className = `paper-sheet ${direction > 0 ? 'turn-forward' : 'turn-backward'}`;
 sheet.setAttribute('aria-hidden', 'true');
 sheet.innerHTML = `<div class="paper-sheet-face paper-sheet-front"></div><div class="paper-sheet-face paper-sheet-back">${paperLeaf(pages[backIndex], backIndex)}</div>`;
 sheet.querySelector('.paper-sheet-front').appendChild(front);
 sheet.querySelectorAll('button, [tabindex]').forEach(element => { element.tabIndex = -1; });
 // Reveal the next stationary page beneath the turning sheet; the reverse of
 // the sheet carries the adjacent page, so there is no blank half-turn.
 const oldLeaf = book.querySelector(currentSide);
 oldLeaf.insertAdjacentHTML('beforebegin', paperLeaf(pages[underIndex], underIndex));
 oldLeaf.remove();
 book.appendChild(sheet);
 paperTurnTimer = setTimeout(() => { paperPage = next; paperTurning = false; renderPaperMenu(); }, 900);
}
function closePaperMenu() {
 flushPaperTap();
 document.querySelector('.paper-overlay')?.remove();
 document.body.classList.remove('paper-open');
 clearTimeout(paperTurnTimer);
 paperTurning = false;
 if (sharedMeal.invite && sharedMeal.data?.joined) { renderSharedMeal(); app.querySelector('[data-shared=paper]')?.focus(); }
 else if (state.page === 'dishes') { render(); app.querySelector('[data-action=paper-mode]')?.focus(); }
}
