const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/paper-menu.js', 'utf8');
const gestureSource = source.slice(source.indexOf('function bindPaperDesktopGestures('), source.indexOf('function renderPaperMenu('));

function setup(rotated = false) {
 const listeners = new Map(), windowListeners = new Map(), timers = new Map(), turns = [];
 let nextTimer = 0;
 const overlay = {isConnected: true, addEventListener: (type, fn) => listeners.set(type, fn)};
 const window = {
  addEventListener: (type, fn) => windowListeners.set(type, fn),
  removeEventListener: type => windowListeners.delete(type)
 };
 const context = {window, matchMedia: () => ({matches: rotated}), turnPaperPage: direction => turns.push(direction),
  setTimeout: fn => {const id = ++nextTimer; timers.set(id, fn); return id}, clearTimeout: id => timers.delete(id)};
 vm.runInNewContext(gestureSource, context);
 context.bindPaperDesktopGestures(overlay);
 const target = {closest: selector => selector === '.paper-book' ? {} : null};
 const emit = (handlers, type, props = {}) => {
  const event = {target, pointerType: 'mouse', button: 0, pointerId: 1, clientX: 0, clientY: 0, deltaX: 0, deltaY: 0, deltaMode: 0,
   preventDefault() {this.defaultPrevented = true}, stopPropagation() {this.stopped = true}, ...props};
  handlers.get(type)?.(event);
  return event;
 };
 return {turns, emit: (type, props) => emit(listeners, type, props), end: (type, props) => emit(windowListeners, type, props),
  flush: () => {const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn())}};
}

test('mouse drags turn pages and suppress the resulting click, while taps still work', () => {
 const h = setup();
 h.emit('pointerdown', {clientX: 200});
 h.end('pointerup', {clientX: 120});
 assert.deepEqual(h.turns, [1]);
 assert.equal(h.emit('click').stopped, true);
 h.flush();
 h.emit('pointerdown', {clientX: 100});
 h.end('pointerup', {clientX: 180});
 assert.deepEqual(h.turns, [1, -1]);
 h.flush();
 h.emit('pointerdown', {clientX: 100});
 h.end('pointerup', {clientX: 102});
 assert.equal(h.emit('click').stopped, undefined);
});

test('rotated layout uses vertical mouse movement and ignores cross-axis movement', () => {
 const h = setup(true);
 h.emit('pointerdown', {clientY: 200});
 h.end('pointerup', {clientY: 100});
 h.emit('pointerdown', {clientX: 100});
 h.end('pointerup', {clientX: 200});
 assert.deepEqual(h.turns, [1]);
});

test('continuous trackpad or wheel motion turns once until idle, in both directions', () => {
 const h = setup();
 h.emit('wheel', {deltaX: 25});
 assert.equal(h.emit('wheel', {deltaX: 25}).defaultPrevented, true);
 h.emit('wheel', {deltaX: 100});
 assert.deepEqual(h.turns, [1]);
 h.flush();
 h.emit('wheel', {deltaY: -3, deltaMode: 1});
 assert.deepEqual(h.turns, [1, -1]);
 h.flush();
 assert.equal(h.emit('wheel', {deltaY: 100, ctrlKey: true}).defaultPrevented, undefined);
 assert.deepEqual(h.turns, [1, -1]);
});
