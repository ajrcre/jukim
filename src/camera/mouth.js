// Pure mouth-tracking logic over MediaPipe face landmarks (478 points, normalised 0..1).
// Inner lips: 13 (upper) / 14 (lower). Mouth corners: 61 / 291.

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Lip gap relative to mouth width: ~0 closed, ~0.5+ wide open. */
export function mouthOpenness(lm) {
  const width = d(lm[61], lm[291]);
  return width > 1e-6 ? d(lm[13], lm[14]) / width : 0;
}

export function mouthCenter(lm) {
  return { x: (lm[13].x + lm[14].x) / 2, y: (lm[13].y + lm[14].y) / 2 };
}

export function mouthWidth(lm) {
  return d(lm[61], lm[291]);
}

/**
 * Maps a normalised video point to screen pixels for a <video> shown with
 * object-fit: cover, optionally mirrored (selfie view).
 */
export function coverMap(p, video, screen, mirror = true) {
  const scale = Math.max(screen.width / video.width, screen.height / video.height);
  const vw = video.width * scale;
  const vh = video.height * scale;
  const nx = mirror ? 1 - p.x : p.x;
  return { x: (screen.width - vw) / 2 + nx * vw, y: (screen.height - vh) / 2 + p.y * vh, scale };
}

/** Hysteresis open/closed state per mouth. */
export class MouthDetector {
  constructor({ openAbove = 0.32, closeBelow = 0.18 } = {}) {
    this.openAbove = openAbove;
    this.closeBelow = closeBelow;
    this.open = false;
  }

  /** Returns { open, justOpened } for this frame. */
  update(landmarks) {
    const r = mouthOpenness(landmarks);
    let justOpened = false;
    if (!this.open && r > this.openAbove) {
      this.open = true;
      justOpened = true;
    } else if (this.open && r < this.closeBelow) {
      this.open = false;
    }
    return { open: this.open, justOpened };
  }
}

/**
 * Decides when roaches crawl out of open mouths: a burst when a mouth opens,
 * then a steady trickle while it stays open.
 */
export class MouthSpawnScheduler {
  constructor({ burst = [1, 2], interval = [0.6, 1.2], random = Math.random } = {}) {
    this.burst = burst;
    this.interval = interval;
    this.random = random;
    this.timers = new Map();
  }

  /** mouths: [{ id, x, y, width, open, justOpened }] -> spawn points. */
  update(dt, mouths) {
    const spawns = [];
    const seen = new Set();
    for (const m of mouths) {
      seen.add(m.id);
      if (!m.open) {
        this.timers.delete(m.id);
        continue;
      }
      if (m.justOpened || !this.timers.has(m.id)) {
        const n = this.burst[0] + Math.floor(this.random() * (this.burst[1] - this.burst[0] + 1));
        for (let i = 0; i < n; i++) spawns.push(m);
        this.timers.set(m.id, this.nextInterval());
        continue;
      }
      const left = this.timers.get(m.id) - dt;
      if (left <= 0) {
        spawns.push(m);
        this.timers.set(m.id, this.nextInterval());
      } else {
        this.timers.set(m.id, left);
      }
    }
    for (const id of this.timers.keys()) if (!seen.has(id)) this.timers.delete(id);
    return spawns;
  }

  nextInterval() {
    return this.interval[0] + this.random() * (this.interval[1] - this.interval[0]);
  }
}
