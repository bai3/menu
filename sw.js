// 家宴 Service Worker：预缓存全部静态资源，离线也能打开。
// 更新页面内容后，把下面 VERSION 加一（如 'v2'）即可让所有客户端换用新缓存。
const VERSION = 'v16';
const CACHE = `jiayan-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './config.js',
  './public/vendor/supabase.js',
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
  event.waitUntil(
    // cache: 'reload' 强制绕过 HTTP 缓存，确保预缓存的永远是最新文件。
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 页面导航：网络优先，断网时回落到缓存的首页。
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
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
