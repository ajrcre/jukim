import { test } from "node:test";
import assert from "node:assert/strict";

import { angleDiff } from "../../src/core/math.js";
import { EventBus } from "../../src/core/EventBus.js";
import { FistDetector, opennessRatio, palmCenter } from "../../src/input/gesture.js";
import { Roach } from "../../src/entities/Roach.js";
import { ROACH_TYPES, RoachFactory } from "../../src/entities/RoachFactory.js";
import { tripodGroup } from "../../src/entities/RoachRenderer.js";
import { LevelManager, levelConfig } from "../../src/game/LevelManager.js";
import { ScoreManager } from "../../src/game/ScoreManager.js";

// --- hand landmark fixtures -------------------------------------------------
function hand(spread) {
  // Wrist at (0.5, 0.8); MCPs ~0.15 above; tips `spread` further out.
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  const xs = [0.44, 0.48, 0.52, 0.56];
  [5, 9, 13, 17].forEach((i, k) => (lm[i] = { x: xs[k], y: 0.65 }));
  [8, 12, 16, 20].forEach((i, k) => (lm[i] = { x: xs[k], y: 0.65 - spread }));
  return lm;
}
const OPEN = hand(0.15);
const FIST = hand(-0.02);

test("openness ratio separates open hand from fist", () => {
  assert.ok(opennessRatio(OPEN) > 1.6);
  assert.ok(opennessRatio(FIST) < 1.3);
});

test("palm center averages palm landmarks", () => {
  const c = palmCenter(OPEN);
  assert.ok(Math.abs(c.x - 0.5) < 0.01);
  assert.ok(c.y > 0.65 && c.y < 0.8);
});

test("fist detector fires once on open -> closed and respects cooldown", () => {
  const d = new FistDetector({ cooldown: 0.3 });
  assert.equal(d.update(FIST, 0), false, "fist without prior open hand does not fire");
  assert.equal(d.update(OPEN, 0.1), false);
  assert.equal(d.update(FIST, 0.2), true);
  assert.equal(d.update(FIST, 0.25), false, "holding the fist does not refire");
  assert.equal(d.update(OPEN, 0.3), false);
  assert.equal(d.update(FIST, 0.35), false, "inside cooldown");
  assert.equal(d.update(OPEN, 0.6), false);
  assert.equal(d.update(FIST, 0.7), true);
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
