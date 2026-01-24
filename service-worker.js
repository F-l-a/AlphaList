// Function to get the base URL, handling GitHub Pages subfolder for Service Worker
function getBaseUrl() {
    const path = self.location.pathname;
    if (path.includes('/AlphaList/')) {
        return '/AlphaList';
    } else {
        return '';
    }
}

const BASE_URL = getBaseUrl();
const CACHE_NAME = 'alpha-list-cache-v1'; // Increment the version to invalidate old caches and force the update of the assets

self.addEventListener("install", event => {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll([
          `${BASE_URL}/`,
          `${BASE_URL}/index.html`,
          `${BASE_URL}/style.css`,
          `${BASE_URL}/script.js`,
          `${BASE_URL}/data.json`,
          `${BASE_URL}/assets/site.webmanifest`,
          `${BASE_URL}/assets/favicon.ico`,
          `${BASE_URL}/assets/apple-touch-icon.png`,
          `${BASE_URL}/assets/favicon-32x32.png`,
          `${BASE_URL}/assets/favicon-16x16.png`,
          `${BASE_URL}/assets/android-chrome-192x192.png`,
          `${BASE_URL}/assets/android-chrome-512x512.png`,
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
          "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css",
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
        ]);
      })
    );
  });
  
  self.addEventListener('activate', event => {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  self.addEventListener("fetch", event => {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => {
          return cache.match(event.request);
        });
      })
    );
  });