self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Пропускаем все запросы напрямую в сеть — кэширование добавим позже,
  // когда понадобится офлайн-режим.
  event.respondWith(fetch(event.request));
});
