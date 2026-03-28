// Service Worker for MotoCare SmartCare
// Auto cache invalidation - no manual cache clearing needed!

// IMPORTANT: Change this version when deploying new code
// Format: YYYYMMDD-HHMM (e.g., 20251222-0743)
const CACHE_VERSION = '20251222-0743';
const CACHE_NAME = `motocare-v${CACHE_VERSION}`;

// Static assets to cache (images, fonts, etc.)
const STATIC_CACHE_URLS = [
    '/logo-smartcare.png',
    '/clear-cache.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[SW] Installing version:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_CACHE_URLS);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating version:', CACHE_VERSION);
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - network-first strategy for HTML/API, cache-first for static assets
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Network-first strategy for HTML and API calls
    if (
        request.headers.get('accept')?.includes('text/html') ||
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.hostname.includes('supabase') // Don't cache Supabase API calls
    ) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Don't cache HTML responses
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache as fallback
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-first strategy for static assets (images, fonts, etc.)
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request).then(response => {
                    // Don't cache if not a successful response
                    if (!response || response.status !== 200 || response.type === 'error') {
                        return response;
                    }

                    // Cache static assets only
                    if (
                        url.pathname.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)
                    ) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }

                    return response;
                });
            })
    );
});

// Push notification handler
self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/logo-smartcare.png',
            badge: '/logo-smartcare.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2'
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Message handler for manual cache clearing (if needed)
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            })
        );
    }
});
