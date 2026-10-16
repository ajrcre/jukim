import { Game } from "./game/Game.js";
import { EdgeSpawner, MouthSpawner } from "./game/spawners.js";
import { UI } from "./ui/UI.js";
import { Lobby } from "./ui/Lobby.js";
import { Splash } from "./ui/Splash.js";
import { SoundManager } from "./audio/SoundManager.js";
import { BackgroundManager } from "./background/BackgroundManager.js";
import { CameraManager } from "./camera/CameraManager.js";
import { MouthTracker } from "./camera/MouthTracker.js";
import { PointerInput } from "./input/PointerInput.js";

const prefs = {
  get(key, fallback) {
    try {
      return localStorage.getItem(`jukim.${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`jukim.${key}`, value);
    } catch {
      // Preferences are a convenience; ignore storage failures.
    }
  },
};

const stage = document.querySelector("#stage");
const gameCanvas = document.querySelector("#game");
const bgVideo = document.querySelector("#bgVideo");

const sound = new SoundManager();
const background = new BackgroundManager(document.querySelector("#bg"));
const camera = new CameraManager();
let tracker = null;

const savedBackground = prefs.get("background", background.current.id);
const settings = {
  mode: prefs.get("mode", "classic"),
  background: savedBackground === "rear" || background.select(savedBackground) ? savedBackground : background.current.id,
  muted: prefs.get("muted", "0") === "1",
};
sound.setMuted(settings.muted);

const thumbnails = () => background.list().map((b) => ({ id: b.id, label: b.label, thumb: background.thumbnail(b) }));

const lobby = new Lobby({
  settings,
  backgrounds: thumbnails(),
  onChange(s) {
    if (s.background !== "rear") background.select(s.background);
    sound.setMuted(s.muted);
    prefs.set("mode", s.mode);
    if (s.background !== "image") prefs.set("background", s.background);
    prefs.set("muted", s.muted ? "1" : "0");
  },
  onStart: (s) => start(s),
  onUpload(file) {
    const img = new Image();
    img.onload = () => {
      background.useImage(img);
      lobby.setBackgrounds(thumbnails());
      lobby.set({ background: "image" });
    };
    img.src = URL.createObjectURL(file);
  },
});

const ui = new UI(
  {
    pause: () => game.pause(),
    resume: () => game.resume(),
    next: () => game.nextLevel(),
    restart: () => game.newGame(game.spawner),
    lobby: () => {
      stopCamera();
      game.toLobby();
    },
  },
  lobby,
);

const game = new Game({ canvas: gameCanvas, ui, sound });
const pointer = new PointerInput(gameCanvas, game.bus);
pointer.enable();
game.input = pointer;

function stopCamera() {
  tracker?.disable();
  camera.stop();
  bgVideo.classList.remove("mirror");
  background.setCameraBackdrop(false);
}

/** Starts whatever camera the settings need and returns the matching spawner. */
async function prepare(s) {
  stopCamera();
  if (s.mode === "mouth") {
    bgVideo.classList.add("mirror");
    await camera.start("user", bgVideo);
    background.setCameraBackdrop(true);
    ui.toast("טוען זיהוי פנים…", 0);
    tracker ??= new MouthTracker(bgVideo, () => ({ width: game.width, height: game.height }));
    await tracker.enable();
    ui.toast("פתחו את הפה… 😮🪳");
    return new MouthSpawner(tracker);
  }
  if (s.background === "rear") {
    await camera.start("environment", bgVideo);
    background.setCameraBackdrop(true);
  }
  return new EdgeSpawner();
}

async function start(s) {
  sound.unlock();
  const button = document.querySelector("#start-btn");
  button.disabled = true;
  try {
    const spawner = await prepare(s);
    game.newGame(spawner);
  } catch (err) {
    stopCamera();
    ui.toast(err?.name === "NotAllowedError" ? "אין הרשאה למצלמה" : "לא הצלחנו להפעיל את המצלמה");
  } finally {
    button.disabled = false;
  }
}

function resize() {
  const { width, height } = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  game.resize(width, height, dpr);
  background.resize(width, height, dpr);
}

window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "p") game.playing ? game.pause() : game.resume();
});

if (!CameraManager.supported) {
  document.querySelector('[data-mode="mouth"]').disabled = true;
}

resize();
game.boot();

const splash = new Splash(document.querySelector("#splash"), document.querySelector("#splash-svg"));
splash.play(async () => {
  await sound.unlock();
  sound.play("cartoon_scream", { volume: 0.8 });
  sound.play("slipper_whack");
  splash.hide();
  game.toLobby();
});

if (new URLSearchParams(location.search).has("debug")) window.__game = game;

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
