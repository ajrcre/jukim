// Strategy pattern: where new roaches come from during play.

import { MouthSpawnScheduler } from "../camera/mouth.js";

/** Classic mode: roaches walk in from the screen edges at the level's pace. */
export class EdgeSpawner {
  update(dt, game) {
    const n = game.level.update(dt, game.world.roaches.length);
    for (let i = 0; i < n; i++) game.world.spawn(game.level.config);
  }
}

/**
 * Mouth mode: roaches crawl out of open mouths seen by the front camera.
 * With no faces in view, a trickle still comes from the edges so play continues.
 */
export class MouthSpawner {
  constructor(tracker, { edgeFallback = 0.4 } = {}) {
    this.tracker = tracker;
    this.scheduler = new MouthSpawnScheduler();
    this.edgeFallback = edgeFallback;
  }

  update(dt, game) {
    const { level, world } = game;
    const edgeCount = level.update(dt, world.roaches.length);
    const mouths = this.tracker.mouths();
    for (const mouth of this.scheduler.update(dt, mouths)) {
      if (world.roaches.length >= level.config.maxOnScreen) break;
      world.spawnFromMouth(mouth, level.config);
    }
    if (!mouths.length) {
      for (let i = 0; i < edgeCount; i++) if (Math.random() < this.edgeFallback) world.spawn(level.config);
    }
  }
}
