const HTML_CACHE = 'html-v1';
const STATIC_CACHE = 'static-v2';
const SHELL_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const htmlCache = await caches.open(HTML_CACHE);
      await htmlCache.addAll(SHELL_URLS);
      await caches.open(STATIC_CACHE);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = new Set([HTML_CACHE, STATIC_CACHE]);
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => !expectedCaches.has(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

const shouldBypassCaching = (request) => {
  const connection = self.navigator?.connection;
  if (connection?.saveData) {
    return true;
  }

  const saveDataHeader = request.headers.get('Save-Data');
  if (saveDataHeader === 'on') {
    return true;
  }

  const reducedData = request.headers.get('Sec-CH-Prefers-Reduced-Data');
  if (reducedData === '1') {
    return true;
  }

  return false;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  if (shouldBypassCaching(request)) {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const acceptHeader = request.headers.get('accept') ?? '';

  if (request.mode === 'navigate' || acceptHeader.includes('text/html')) {
    event.respondWith(handleHtmlRequest(event));
    return;
  }

  const isFontRequest = request.destination === 'font' || url.pathname.endsWith('.woff2');

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    isFontRequest
  ) {
    event.respondWith(handleStaticAssetRequest(request));
  }
});

const handleHtmlRequest = (event) => {
  const { request } = event;

  return (async () => {
    const cache = await caches.open(HTML_CACHE);
    const cachedResponse = await cache.match(request);

    const networkFetch = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch((error) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        throw error;
      });

    if (cachedResponse) {
      event.waitUntil(networkFetch.catch(() => undefined));
      return cachedResponse;
    }

    return networkFetch;
  })();
};

const handleStaticAssetRequest = async (request) => {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
};
