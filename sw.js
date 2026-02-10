const CACHE_NAME = 'hash-calendar-v5';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './json.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './logo.png',
  './modules/lz-string.min.js',
  './modules/app_launcher.js',
  // Modules
  './modules/agendaRender.js',
  './modules/calendarRender.js',
  './modules/countdownManager.js',
  './modules/focusMode.js',
  './modules/hashcalUrlManager.js',
  './modules/icsImporter.js',
  './modules/modalManager.js',
  './modules/pathImportManager.js',
  './modules/qrCodeManager.js',
  './modules/recurrenceEngine.js',
  './modules/stateSaveManager.js',
  './modules/timezoneManager.js',
  // External resources (Font Awesome, Fonts)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700&family=Space+Grotesk:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }

      // Clone request for fetch
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((response) => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache the new resource (if it's local)
        if (event.request.url.startsWith(self.location.origin)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      });
    })
  );
});
