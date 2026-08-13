const CACHE_NAME = "nextlap-cache-v4";
const RUNTIME_CACHE = "nextlap-runtime-v4";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css?v=29",
  "./app.js?v=29",
  "./manifest.json",
  "./logo.png",
  "./supabase-config.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/fit-file-parser@1.6.0/dist/fit-file-parser.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))
        )
      )
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] 预缓存部分失败:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/storage/v1/") ||
    url.pathname.includes("/realtime/v1/")
  ) {
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return resp;
        })
        .catch(() =>
          caches.match(req).then(
            (hit) => hit || caches.match("./index.html")
          )
        )
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type !== "opaque") {
            const copy = resp.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => hit);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
