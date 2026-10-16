import { test } from "node:test";
import assert from "node:assert/strict";

import { angleDiff } from "../../src/core/math.js";
import { EventBus } from "../../src/core/EventBus.js";
import { MouthDetector, MouthSpawnScheduler, coverMap, mouthCenter, mouthOpenness } from "../../src/camera/mouth.js";
import { Roach } from "../../src/entities/Roach.js";
import { ROACH_TYPES, RoachFactory } from "../../src/entities/RoachFactory.js";
import { RoachRenderer, tripodGroup } from "../../src/entities/RoachRenderer.js";
import { bodyHeight, shadeBody } from "../../src/entities/RoachShader.js";
import { LevelManager, levelConfig } from "../../src/game/LevelManager.js";
import { ScoreManager } from "../../src/game/ScoreManager.js";

// --- face landmark fixtures -------------------------------------------------
function face(gap, cx = 0.5, cy = 0.6) {
  const lm = Array.from({ length: 478 }, () => ({ x: cx, y: cy }));
  lm[61] = { x: cx - 0.05, y: cy };
  lm[291] = { x: cx + 0.05, y: cy };
  lm[13] = { x: cx, y: cy - gap / 2 };
  lm[14] = { x: cx, y: cy + gap / 2 };
  return lm;
}
const CLOSED = face(0.005);
const OPEN = face(0.05);

test("mouth openness separates open from closed", () => {
  assert.ok(mouthOpenness(OPEN) > 0.32);
  assert.ok(mouthOpenness(CLOSED) < 0.18);
  assert.deepEqual(mouthCenter(OPEN), { x: 0.5, y: 0.6 });
});

test("mouth detector reports justOpened once, with hysteresis", () => {
  const d = new MouthDetector();
  assert.deepEqual(d.update(CLOSED), { open: false, justOpened: false });
  assert.deepEqual(d.update(OPEN), { open: true, justOpened: true });
  assert.deepEqual(d.update(OPEN), { open: true, justOpened: false });
  assert.deepEqual(d.update(face(0.025)), { open: true, justOpened: false }, "between thresholds stays open");
  assert.deepEqual(d.update(CLOSED), { open: false, justOpened: false });
});

test("spawn scheduler bursts on open, trickles while open, stops when closed", () => {
  const s = new MouthSpawnScheduler({ burst: [2, 2], interval: [1, 1] });
  const m = (open, justOpened = false) => [{ id: 0, x: 10, y: 20, width: 50, open, justOpened }];
  assert.equal(s.update(0.1, m(true, true)).length, 2);
  assert.equal(s.update(0.5, m(true)).length, 0);
  assert.equal(s.update(0.6, m(true)).length, 1);
  assert.equal(s.update(5, m(false)).length, 0);
  assert.equal(s.update(0.1, []).length, 0);
});

test("cover mapping mirrors and crops like object-fit: cover", () => {
  const video = { width: 1280, height: 720 };
  const screen = { width: 390, height: 844 };
  const c = coverMap({ x: 0.5, y: 0.5 }, video, screen);
  assert.ok(Math.abs(c.x - 195) < 1e-6 && Math.abs(c.y - 422) < 1e-6);
  const left = coverMap({ x: 0.4, y: 0.5 }, video, screen);
  assert.ok(left.x > 195, "mirrored: camera-left appears screen-right");
});

test("roaches emerging from a mouth start small and grow", () => {
  const factory = new RoachFactory();
  const r = factory.spawnFromMouth({ x: 200, y: 300, width: 60 }, { weights: { german: 1 }, speedMul: 1 });
  assert.ok(r.entered);
  assert.ok(r.renderScale < 0.5);
  for (let i = 0; i < 40; i++) r.update(1 / 60, { width: 400, height: 800, threats: [] });
  assert.equal(r.renderScale, 1);
});

// --- body shader ----------------------------------------------------------------
test("body height field covers the body and is empty outside", () => {
  assert.equal(bodyHeight(0, 0).id, "wings");
  assert.equal(bodyHeight(0.25, 0).id, "pronotum");
  assert.equal(bodyHeight(0.9, 0).h, 0);
  assert.equal(bodyHeight(0, 0.6).h, 0);
});

test("shader output is opaque on the body, transparent outside, and lit from the light side", () => {
  const w = 60;
  const h = 30;
  const shade = (lightAngle) => shadeBody({ width: w, height: h, L: 50, W: 22, colors: ROACH_TYPES.american.colors, lightAngle });
  const px = shadeBody({ width: w, height: h, L: 50, W: 22, colors: ROACH_TYPES.american.colors, lightAngle: 0 });
  assert.equal(px[3], 0, "corner is transparent");
  assert.equal(px[(15 * w + 30) * 4 + 3], 255, "centre is opaque");
  // Light from +y side brightens the +y flank more than the -y flank.
  const lit = shade(Math.PI / 2);
  const lum = (x, y) => lit[(y * w + x) * 4] + lit[(y * w + x) * 4 + 1] + lit[(y * w + x) * 4 + 2];
  assert.ok(lum(28, 22) > lum(28, 8));
});

test("renderer light buckets wrap around", () => {
  assert.equal(RoachRenderer.bucketOf(0), 0);
  assert.equal(RoachRenderer.bucketOf(Math.PI * 2), 0);
  assert.equal(RoachRenderer.bucketOf(-Math.PI / 8), 15);
});

// --- roach ---------------------------------------------------------------------
test("roach hit test uses the rotated body ellipse", () => {
  const r = new Roach({ type: ROACH_TYPES.american, x: 100, y: 100, heading: Math.PI / 2 });
  assert.ok(r.hitTest(100, 100));
  assert.ok(r.hitTest(100, 100 + r.length * 0.45), "along the body axis");
  assert.ok(!r.hitTest(100 + r.length * 0.45, 100), "sideways is outside the narrow body");
  assert.ok(r.hitTest(100 + r.length * 0.45, 100, 20), "tolerance widens the hit area");
});

test("spawned roaches start off-screen and walk onto it", () => {
  const factory = new RoachFactory();
  const world = { width: 800, height: 600, threats: [] };
  for (let i = 0; i < 20; i++) {
    const r = factory.spawn(800, 600, { weights: { german: 1 }, speedMul: 1 });
    const offscreen = r.x < 0 || r.x > 800 || r.y < 0 || r.y > 600;
    assert.ok(offscreen, "spawns outside the screen");
    for (let t = 0; t < 300 && !r.entered; t++) r.update(1 / 60, world);
    assert.ok(r.entered, "enters within 5 seconds");
  }
});

test("roach flees from a nearby threat", () => {
  const r = new Roach({ type: ROACH_TYPES.german, x: 400, y: 300, heading: 0 });
  r.entered = true;
  const world = { width: 800, height: 600, threats: [{ x: 380, y: 300 }] };
  for (let t = 0; t < 30; t++) r.update(1 / 60, world);
  assert.equal(r.state, "flee");
  assert.ok(r.x > 400, "moved away from the threat");
});

test("roach scared without a live threat does not crash", () => {
  const r = new Roach({ type: ROACH_TYPES.german, x: 400, y: 300, heading: 0 });
  r.scare(390, 300, 0.5);
  r.update(1 / 60, { width: 800, height: 600, threats: [] });
  assert.equal(r.state, "flee");
});

test("tripod gait pairs front+hind of one side with the middle of the other", () => {
  assert.equal(tripodGroup(0, 1), tripodGroup(2, 1));
  assert.equal(tripodGroup(0, 1), tripodGroup(1, -1));
  assert.notEqual(tripodGroup(0, 1), tripodGroup(0, -1));
});

// --- levels & score ---------------------------------------------------------------
test("difficulty increases with level", () => {
  const a = levelConfig(1);
  const b = levelConfig(5);
  assert.ok(b.target > a.target);
  assert.ok(b.spawnInterval < a.spawnInterval);
  assert.ok(b.speedMul > a.speedMul);
  assert.equal(a.weights.golden, 0);
});

test("level manager respects max on screen and detects outcome", () => {
  const lm = new LevelManager();
  assert.equal(lm.update(100, lm.config.maxOnScreen), 0);
  assert.ok(lm.failed);
  lm.start(1);
  for (let i = 0; i < lm.config.target; i++) lm.recordSquash();
  assert.ok(lm.complete);
});

test("score combo multiplier and high score persistence", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const s = new ScoreManager(storage);
  for (let i = 0; i < 3; i++) s.squash(10, i * 0.5);
  assert.equal(s.multiplier, 1.5);
  assert.equal(s.squash(10, 1.6), 15);
  s.miss();
  assert.equal(s.multiplier, 1);
  assert.ok(s.commit());
  assert.equal(new ScoreManager(storage).highScore, s.score);
});

test("score manager survives broken storage", () => {
  const storage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  const s = new ScoreManager(storage);
  s.squash(10, 0);
  assert.ok(s.commit());
});

test("event bus delivers and unsubscribes", () => {
  const bus = new EventBus();
  const got = [];
  const off = bus.on("x", (p) => got.push(p));
  bus.emit("x", 1);
  off();
  bus.emit("x", 2);
  assert.deepEqual(got, [1]);
});

test("angleDiff wraps around", () => {
  assert.ok(Math.abs(angleDiff(3, -3) - (2 * Math.PI - 6)) < 1e-9);
});
