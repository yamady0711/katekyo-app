// アプリの画面ファイルだけをキャッシュする（AIとの通信はキャッシュしない）
// ファイルを更新したら VERSION を上げる
const VERSION = "v2";
const SHELL = [
  "./", "index.html", "style.css", "app.js", "lib.js", "history.js", "quiz.js", "config.js", "manifest.json",
  "sims/index.js", "sims/util.js", "sims/moon.js", "sims/sun.js", "sims/stars.js",
  "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 同じサイトのファイルは「ネット優先、だめならキャッシュ」。更新がすぐ反映されるようにする
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
