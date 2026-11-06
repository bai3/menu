const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the actual gesture handler with controllable touch and transition events.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const gestureSource = appSource.slice(appSource.indexOf('function bindDetailSwipe('), appSource.indexOf('function bindDishButtons('));

function setup({reducedMotion = false} = {}) {
 const listeners = new Map(), classes = new Set(), properties = new Map(), timers = new Map();
 let nextTimer = 0, backs = 0, attached = true;
 const screen = {
  clientWidth: 360,
  classList: {add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name))},
  style: {setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name)},
  contains: () => attached
 };
 const scroll = {
  parentElement: screen,
  addEventListener: (name, handler) => {if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler)},
  removeEventListener: (name, handler) => listeners.get(name)?.delete(handler)
 };
 const context = {
  window: {matchMedia: () => ({matches: reducedMotion})},
  setTimeout: fn => {const id = ++nextTimer; timers.set(id, fn); return id},
  clearTimeout: id => timers.delete(id)
 };
 vm.runInNewContext(gestureSource, context);
 context.bindDetailSwipe(scroll, () => backs++);
 function emit(type, props = {}) {
  const event = {touches: [], changedTouches: [], cancelable: true, defaultPrevented: false, preventDefault() {this.defaultPrevented = true}, ...props};
  for (const handler of [...(listeners.get(type) || [])]) handler(event);
  return event;
 }
 const touch = (x, y) => ({clientX: x, clientY: y});
 return {emit, touch, classes, properties, scroll, timers, get backs() {return backs}, detach: () => {attached = false}};
}

test('a right swipe follows the finger, suppresses its click, then returns after the transition', () => {
 const h = setup();
 h.emit('touchstart', {touches: [h.touch(30, 100)]});
 const move = h.emit('touchmove', {touches: [h.touch(150, 110)]});
 assert.equal(move.defaultPrevented, true);
 assert.equal(h.properties.get('--detail-swipe-x'), '120px');
 assert.equal(h.classes.has('detail-swipe-active'), true);
 const end = h.emit('touchend', {changedTouches: [h.touch(150, 110)]});
 assert.equal(end.defaultPrevented, true);
 assert.equal(h.backs, 0);
 assert.equal(h.properties.get('--detail-swipe-x'), '360px');
 h.emit('transitionend', {target: h.scroll, propertyName: 'transform'});
 assert.equal(h.backs, 1);
 assert.equal(h.classes.has('detail-swipe-active'), false);
 assert.equal(h.timers.size, 0);
});

test('short horizontal gestures settle back while vertical scrolling and taps remain unblocked', () => {
 const h = setup();
 h.emit('touchstart', {touches: [h.touch(20, 20)]});
 h.emit('touchmove', {touches: [h.touch(60, 22)]});
 h.emit('touchend', {changedTouches: [h.touch(60, 22)]});
 assert.equal(h.properties.get('--detail-swipe-x'), '0px');
 h.emit('transitionend', {target: h.scroll, propertyName: 'transform'});
 assert.equal(h.backs, 0);
 h.emit('touchstart', {touches: [h.touch(20, 20)]});
 assert.equal(h.emit('touchmove', {touches: [h.touch(30, 150)]}).defaultPrevented, false);
 assert.equal(h.emit('touchend', {changedTouches: [h.touch(30, 150)]}).defaultPrevented, false);
 h.emit('touchstart', {touches: [h.touch(20, 20)]});
 assert.equal(h.emit('touchend', {changedTouches: [h.touch(20, 20)]}).defaultPrevented, false);
 assert.equal(h.backs, 0);
});

test('multitouch and cancellation never exit, and a replaced page cannot trigger a stale return', () => {
 const h = setup();
 h.emit('touchstart', {touches: [h.touch(10, 10)]});
 h.emit('touchmove', {touches: [h.touch(100, 10)]});
 h.emit('touchstart', {touches: [h.touch(100, 10), h.touch(120, 10)]});
 h.emit('transitionend', {target: h.scroll, propertyName: 'transform'});
 assert.equal(h.backs, 0);
 h.emit('touchstart', {touches: [h.touch(10, 10)]});
 h.emit('touchmove', {touches: [h.touch(150, 10)]});
 h.emit('touchcancel');
 h.emit('transitionend', {target: h.scroll, propertyName: 'transform'});
 assert.equal(h.backs, 0);
 h.emit('touchstart', {touches: [h.touch(10, 10)]});
 h.emit('touchmove', {touches: [h.touch(150, 10)]});
 h.emit('touchend', {changedTouches: [h.touch(150, 10)]});
 h.detach();
 h.emit('transitionend', {target: h.scroll, propertyName: 'transform'});
 assert.equal(h.backs, 0);
});

test('reduced motion returns immediately without leaving a translated page', () => {
 const h = setup({reducedMotion: true});
 h.emit('touchstart', {touches: [h.touch(10, 10)]});
 h.emit('touchmove', {touches: [h.touch(150, 10)]});
 h.emit('touchend', {changedTouches: [h.touch(150, 10)]});
 assert.equal(h.backs, 1);
 assert.equal(h.classes.has('detail-swipe-active'), false);
 assert.equal(h.properties.has('--detail-swipe-x'), false);
});
