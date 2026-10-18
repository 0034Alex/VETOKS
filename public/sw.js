self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Запросы не перехватываем: браузер сам идёт в сеть. Так страницы не могут
// прийти пустыми из-за обработчика. Кэш для офлайна добавим позже.
self.addEventListener("fetch", () => {});
