import { Game } from "./game/Game.js";
import { UI } from "./ui/UI.js";
import { SoundManager } from "./audio/SoundManager.js";
import { BackgroundManager } from "./background/BackgroundManager.js";
import { CameraManager } from "./camera/CameraManager.js";
import { PointerInput } from "./input/PointerInput.js";
import { HandGestureInput } from "./input/HandGestureInput.js";

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
const handVideo = document.querySelector("#handVideo");

const sound = new SoundManager();
const background = new BackgroundManager(document.querySelector("#bg"));
const camera = new CameraManager();
let cameraMode = "off";
let handInput = null;

const ui = new UI({
  start: () => {
    sound.unlock();
    game.newGame();
  },
  next: () => game.nextLevel(),
  pause: () => game.pause(),
  resume: () => {
    ui.closeSettings();
    game.resume();
  },
  menu: () => game.quitToMenu(),
  setCamera: (mode) => setCamera(mode),
  setMuted: (muted) => {
    sound.setMuted(muted);
    prefs.set("muted", muted ? "1" : "0");
  },
  uploadBackground: (file) => {
    const img = new Image();
    img.onload = () => {
      background.useImage(img);
      if (cameraMode === "rear") setCamera("off");
      refreshBackgrounds();
    };
    img.src = URL.createObjectURL(file);
  },
});

const game = new Game({ canvas: gameCanvas, ui, sound });

const pointer = new PointerInput(gameCanvas, game.bus);
pointer.enable();
game.input.add(pointer);

function refreshBackgrounds() {
  const items = background.list().map((b) => ({ id: b.id, label: b.label, thumb: background.thumbnail(b) }));
  ui.renderBackgrounds(items, cameraMode === "rear" ? null : background.current.id, (id) => {
    if (cameraMode === "rear") setCamera("off");
    background.select(id);
    if (id !== "image") prefs.set("background", id);
    refreshBackgrounds();
  });
}

async function setCamera(mode) {
  if (handInput) {
    handInput.disable();
    game.input.remove(handInput);
  }
  camera.stop();
  background.setCameraBackdrop(false);
  handVideo.hidden = true;
  cameraMode = "off";

  try {
    if (mode === "rear") {
      await camera.start("environment", bgVideo);
      background.setCameraBackdrop(true);
      cameraMode = "rear";
    } else if (mode === "front") {
      await camera.start("user", handVideo);
      cameraMode = "front";
      ui.toast("טוען זיהוי ידיים…");
      handInput ??= new HandGestureInput(handVideo, game.bus, () => ({ width: game.width, height: game.height }));
      await handInput.enable();
      game.input.add(handInput);
      ui.toast("פתחו כף יד מעל ג'וק וסגרו לאגרוף ✊");
    }
  } catch (err) {
    camera.stop();
    background.setCameraBackdrop(false);
    cameraMode = "off";
    ui.toast(err?.name === "NotAllowedError" ? "אין הרשאה למצלמה" : "לא הצלחנו להפעיל את המצלמה");
  }
  ui.setCameraOption(cameraMode);
  refreshBackgrounds();
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

background.select(prefs.get("background", background.current.id));
const muted = prefs.get("muted", "0") === "1";
sound.setMuted(muted);
document.querySelector("#sound-toggle").checked = !muted;
ui.setCameraAvailable(CameraManager.supported);

resize();
refreshBackgrounds();
game.boot();
if (new URLSearchParams(location.search).has("debug")) window.__game = game;

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
