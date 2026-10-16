// Pure hand-gesture logic over MediaPipe hand landmarks (21 points, normalised 0..1).
// Landmark indices: 0 wrist, 5/9/13/17 finger MCPs, 8/12/16/20 fingertips.

const TIPS = [8, 12, 16, 20];
const PALM = [0, 5, 9, 13, 17];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Mean fingertip-to-wrist distance relative to palm size: ~2 open hand, ~1 fist. */
export function opennessRatio(lm) {
  const palm = d(lm[0], lm[9]);
  if (palm <= 1e-6) return 0;
  const tips = TIPS.reduce((sum, i) => sum + d(lm[i], lm[0]), 0) / TIPS.length;
  return tips / palm;
}

export function palmCenter(lm) {
  let x = 0;
  let y = 0;
  for (const i of PALM) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / PALM.length, y: y / PALM.length };
}

/**
 * State machine per hand: open -> closed transition fires a "squash".
 * Hysteresis between the thresholds avoids flicker; cooldown avoids double hits.
 */
export class FistDetector {
  constructor({ closeBelow = 1.3, openAbove = 1.6, cooldown = 0.3 } = {}) {
    this.closeBelow = closeBelow;
    this.openAbove = openAbove;
    this.cooldown = cooldown;
    this.state = "unknown";
    this.lastFire = -Infinity;
  }

  /** Returns true when this frame completes an open->fist transition. */
  update(landmarks, time) {
    const r = opennessRatio(landmarks);
    if (r > this.openAbove) {
      this.state = "open";
      return false;
    }
    if (r < this.closeBelow) {
      const fire = this.state === "open" && time - this.lastFire >= this.cooldown;
      this.state = "closed";
      if (fire) this.lastFire = time;
      return fire;
    }
    return false;
  }

  get closed() {
    return this.state === "closed";
  }
}
