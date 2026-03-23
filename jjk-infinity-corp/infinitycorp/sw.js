const CACHE_NAME = 'infinity-cache-v1';
const ASSETS = [
    'index.html',
    'Aiden Yip - Jujutsu Kaisen_ Gojo Satoru Hollow Purple Theme _ EPIC VERSION (Besto Quality Remix).mp3'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((resp) => {
                // don't cache opaque responses (cross-origin) or errors
                if (!resp || resp.status !== 200) return resp;
                const respClone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
                return resp;
            }).catch(() => caches.match('index.html'));
        })
    );
});
