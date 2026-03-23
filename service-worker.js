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
const CACHE_NAME = 'alpha-list-cache-v2.3'; // Increment the version to invalidate old caches and force the update of the assets
const SUPPORTED_TRANSLATION_LANGS = ['de', 'es', 'fr', 'it'];
const TRANSLATION_FILE_NAMES = ['ability', 'egg-group', 'locationPokeapi', 'move', 'pokemon-species', 'region'];
const REMOTE_TRANSLATIONS_BASE = 'https://cdn.jsdelivr.net/gh/F-l-a/Poke-translator@main/translations/PokemmoClientDump';

const CORE_ASSETS = [
  `${BASE_URL}/`,
  `${BASE_URL}/index.html`,
  `${BASE_URL}/style.css`,
  `${BASE_URL}/script.js`,
  `${BASE_URL}/data.json`,
  `${BASE_URL}/move-properties.json`,
  `${BASE_URL}/assets/site.webmanifest`,
  `${BASE_URL}/assets/favicon.ico`,
  `${BASE_URL}/assets/apple-touch-icon.png`,
  `${BASE_URL}/assets/favicon-32x32.png`,
  `${BASE_URL}/assets/favicon-16x16.png`,
  `${BASE_URL}/assets/android-chrome-192x192.png`,
  `${BASE_URL}/assets/android-chrome-512x512.png`,
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

const PRE_CACHE_TRANSLATION_URLS = [
  ...SUPPORTED_TRANSLATION_LANGS.flatMap(lang =>
    TRANSLATION_FILE_NAMES.map(fileName =>
      `${REMOTE_TRANSLATIONS_BASE}/${lang}/${fileName}-${lang}.json`
    )
  ),
  ...SUPPORTED_TRANSLATION_LANGS.map(lang =>
    `${BASE_URL}/translations/Extra/extra-${lang}.json`
  )
];

self.addEventListener("install", event => {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);

      // Best effort for translations: do not fail SW install if one URL is unavailable.
      await Promise.allSettled(
        PRE_CACHE_TRANSLATION_URLS.map(async (url) => {
          const response = await fetch(url, { cache: 'no-cache' });
          if (!response.ok) return;
          await cache.put(url, response.clone());
        })
      );
    })());
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