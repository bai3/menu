// 家宴 Service Worker：预缓存全部静态资源，离线也能打开。
// 更新页面内容后，把下面 VERSION 加一（如 'v2'）即可让所有客户端换用新缓存。
const VERSION = 'v169';
const CACHE = `jiayan-${VERSION}`;
// 本机开发不使用离线缓存，已有旧 Worker 更新后也会切换到网络。
const LOCAL_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);
const ASSETS = [
  './',
  './index.html',
  './style.css?v=166',
  './theme.css?v=166',
  './locale.css?v=166',
  './theme.js?v=166',
  './src/i18n.js?v=166',
  './src/confirm-dialog.js?v=166',
  './src/data.js?v=166',
  './src/auth.js?v=166',
  './src/startup.js?v=166',
  './src/photo-storage.js?v=166',
  './src/views.js?v=166',
  './src/meal-tools.js?v=166',
  './src/shopping-list.js?v=166',
  './src/nutrition.js?v=166',
  './src/menu-image.js?v=166',
  './src/paper-menu.js?v=166',
  './app.js?v=166',
  './shared-meal.js?v=166',
  './manifest.json',
  './config.js?v=166',
  './public/vendor/supabase.js?v=166',
  './public/assets/icon.svg',
  './public/assets/icon-192.png',
  './public/assets/icon-512.png',
  './public/assets/icon-maskable-512.png',
  './public/assets/apple-touch-icon.png',
  './public/assets/hero.jpg',
  './public/assets/menu-paper.jpg',
  './public/assets/tomato.jpg',
  './public/assets/pork.jpg',
  './public/assets/cucumber.jpg',
  './public/assets/fish.jpg',
  './public/assets/soup.jpg',
  './public/assets/shrimp.jpg'
];

self.addEventListener('install', (event) => {
  if (LOCAL_DEV) { event.waitUntil(self.skipWaiting()); return; }
  event.waitUntil(
    // cache: 'reload' 强制绕过 HTTP 缓存，确保预缓存的永远是最新文件。
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  if (LOCAL_DEV) {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('jiayan-')).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
    return;
  }
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('jiayan-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (LOCAL_DEV) return;
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 页面导航优先使用当前版本的预缓存首页，不必等待慢网络。
  // 新版本由 Service Worker 更新时整体预缓存，避免首页与脚本版本不一致。
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match('./index.html')).then((hit) => hit || fetch(request)));
    return;
  }
  // 其余静态资源：缓存优先，未命中时取网络并顺手入缓存。
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => new Response('', { status: 504, statusText: 'Offline' })))
  );
});
