// Service worker: precaches the game's own files for offline play; CDN/model requests are left alone.
const CACHE = "jukim-v1";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "src/main.js",
  "src/core/EventBus.js",
  "src/core/GameLoop.js",
  "src/core/math.js",
  "src/game/Game.js",
  "src/game/GameStateMachine.js",
  "src/game/LevelManager.js",
  "src/game/ScoreManager.js",
  "src/game/World.js",
  "src/entities/Roach.js",
  "src/entities/RoachFactory.js",
  "src/entities/RoachRenderer.js",
  "src/entities/Splat.js",
  "src/input/gesture.js",
  "src/input/PointerInput.js",
  "src/input/HandGestureInput.js",
  "src/background/backgrounds.js",
  "src/background/BackgroundManager.js",
  "src/camera/CameraManager.js",
  "src/audio/SoundManager.js",
  "src/ui/UI.js",
  "assets/sounds/squash1.mp3",
  "assets/sounds/squash2.mp3",
  "assets/sounds/squash3.mp3",
  "assets/sounds/miss.mp3",
  "assets/sounds/scurry.mp3",
  "assets/sounds/levelup.mp3",
  "assets/sounds/gameover.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  // Network-first so new deploys show up immediately; cache keeps it playable offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});
