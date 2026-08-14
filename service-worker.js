/* ============================================================
 * NextLap PWA - Service Worker
 * 负责：离线缓存 + 资源预加载 + 运行时缓存
 * ============================================================ */

const CACHE_NAME = "nextlap-cache-v9";
const RUNTIME_CACHE = "nextlap-runtime-v9";

/* -------- 预缓存（App Shell 核心资源） -------- */
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css?v=34",
  "./app.js?v=34",
  "./manifest.json",
  "./logo.png",
  "./supabase-config.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdn.jsdelivr.net/npm/fit-file-parser@1.6.0/dist/fit-file-parser.min.js"
];

/* -------- 安装：预缓存核心资源 -------- */
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

/* -------- 激活：清理旧缓存 -------- */
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

/* -------- 拦截请求：缓存策略 -------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  /* 只处理 GET 请求 */
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* 跳过 Supabase / Fit parser / 外部 CDN 的跨域 POST 等（保持默认） */
  if (
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/storage/v1/") ||
    url.pathname.includes("/realtime/v1/")
  ) {
    return;
  }

  /* 策略 1：导航请求（HTML 页面）—— 网络优先，失败回退缓存 */
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

  /* 策略 2：静态资源（JS/CSS/图片）—— 缓存优先，失败再网络 */
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

/* -------- 接收来自页面的消息（手动触发更新） -------- */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
