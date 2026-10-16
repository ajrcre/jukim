import { MouthDetector, coverMap, mouthCenter, mouthWidth } from "./mouth.js";

const VISION_VERSION = "0.10.14";
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MAX_FACES = 4;

/** Tracks faces in the (mirrored, full-screen) front-camera video and reports mouths in screen pixels. */
export class MouthTracker {
  constructor(video, getScreen) {
    this.video = video;
    this.getScreen = getScreen;
    this.landmarker = null;
    this.detectors = Array.from({ length: MAX_FACES }, () => new MouthDetector());
    this.current = [];
    this.running = false;
    this.lastVideoTime = -1;
    this.loop = this.loop.bind(this);
  }

  async enable() {
    if (!this.landmarker) {
      const { FilesetResolver, FaceLandmarker } = await import(VISION_URL);
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: MAX_FACES,
      });
      try {
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, options("CPU"));
      }
    }
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  disable() {
    this.running = false;
    this.current = [];
  }

  loop() {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime && v.videoWidth) {
      this.lastVideoTime = v.currentTime;
      const result = this.landmarker.detectForVideo(v, performance.now());
      const screen = this.getScreen();
      const size = { width: v.videoWidth, height: v.videoHeight };
      this.current = (result.faceLandmarks ?? []).map((lm, i) => {
        const state = this.detectors[i].update(lm);
        const p = coverMap(mouthCenter(lm), size, screen);
        return { id: i, x: p.x, y: p.y, width: mouthWidth(lm) * size.width * p.scale, ...state };
      });
      for (let i = this.current.length; i < MAX_FACES; i++) this.detectors[i].open = false;
    }
    requestAnimationFrame(this.loop);
  }

  /** Consumes this frame's mouths (justOpened is reported once). */
  mouths() {
    const out = this.current;
    this.current = out.map((m) => ({ ...m, justOpened: false }));
    return out;
  }
}
