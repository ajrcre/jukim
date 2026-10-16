import { FistDetector, palmCenter } from "./gesture.js";

const VISION_VERSION = "0.10.14";
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * Strategy: front-camera hand tracking. Closing an open hand into a fist
 * strikes at the palm position (mirrored so it feels like a mirror).
 */
export class HandGestureInput {
  constructor(video, bus, getSize) {
    this.video = video;
    this.bus = bus;
    this.getSize = getSize;
    this.landmarker = null;
    this.detectors = [new FistDetector(), new FistDetector()];
    this.hands = [];
    this.running = false;
    this.lastVideoTime = -1;
    this.loop = this.loop.bind(this);
  }

  async enable() {
    if (!this.landmarker) {
      const { FilesetResolver, HandLandmarker } = await import(VISION_URL);
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
      });
      try {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, options("GPU"));
      } catch {
        this.landmarker = await HandLandmarker.createFromOptions(fileset, options("CPU"));
      }
    }
    this.running = true;
    requestAnimationFrame(this.loop);
  }

  disable() {
    this.running = false;
    this.hands = [];
  }

  toScreen(p) {
    const { width, height } = this.getSize();
    return { x: (1 - p.x) * width, y: p.y * height };
  }

  loop() {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      const now = performance.now();
      const result = this.landmarker.detectForVideo(v, now);
      this.hands = [];
      (result.landmarks ?? []).forEach((lm, i) => {
        const detector = this.detectors[i] ?? this.detectors[0];
        const fired = detector.update(lm, now / 1000);
        const pos = this.toScreen(palmCenter(lm));
        this.hands.push({ ...pos, closed: detector.closed, scare: 0.55 });
        if (fired) this.bus.emit("strike", { x: pos.x, y: pos.y, radius: 45, source: "hand" });
      });
    }
    requestAnimationFrame(this.loop);
  }

  threats() {
    return this.hands;
  }

  cursors() {
    return this.hands;
  }
}
