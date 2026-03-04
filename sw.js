const CACHE_NAME = "hash-calendar-v6";
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./json.html",
  "./styles.css",
  "./script.js",
  "./manifest.json",
  "./favicon.ico",
  "./favicon.png",
  "./apple-touch-icon.png",
  "./logo.png",
  "./modules/lz-string.min.js",
];

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

function isAppCodePath(pathname) {
  return pathname === "/" || pathname.endsWith(".html") || pathname.endsWith(".js") || pathname.endsWith(".css") || pathname.endsWith(".json");
}

async function putInCache(cache, request, response) {
  if (!response || response.status !== 200 || response.type === "error") return;
  await cache.put(request, response.clone());
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    await putInCache(cache, request, response);
    return response;
  } catch (_error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await cache.match("./index.html");
      if (fallback) return fallback;
    }
    throw _error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(async (response) => {
      await putInCache(cache, request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkFetch;
    return cached;
  }

  const network = await networkFetch;
  if (network) return network;
  return fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => (cacheName === CACHE_NAME ? null : caches.delete(cacheName)))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  if (!isSameOrigin(request.url)) return;

  const url = new URL(request.url);
  if (request.mode === "navigate" || isAppCodePath(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
