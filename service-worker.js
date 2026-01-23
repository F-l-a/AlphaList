self.addEventListener("install", event => {
    event.waitUntil(
      caches.open("alpha-list-cache").then(cache => {
        return cache.addAll([
          "/",
          "/index.html",
          "/style.css",
          "/script.js",
          "/data.json",
          "/assets/site.webmanifest",
          "/assets/favicon.ico",
          "/assets/apple-touch-icon.png",
          "/assets/favicon-32x32.png",
          "/assets/favicon-16x16.png",
          "/assets/android-chrome-192x192.png",
          "/assets/android-chrome-512x512.png",
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
          "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css",
          "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
        ]);
      })
    );
  });
  
  self.addEventListener("fetch", event => {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  });