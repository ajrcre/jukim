const HIGH_SCORE_KEY = "jukim.highScore";
const COMBO_WINDOW = 1.5;

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Score, combo multiplier and the per-device high score. */
export class ScoreManager {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.highScore = this.loadHighScore();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;
    this.lastSquashAt = -Infinity;
  }

  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.combo / 3) * 0.5);
  }

  /** Records a squash at game time `t`; returns the points awarded. */
  squash(basePoints, t) {
    this.combo = t - this.lastSquashAt <= COMBO_WINDOW ? this.combo + 1 : 1;
    this.lastSquashAt = t;
    const points = Math.round(basePoints * this.multiplier);
    this.score += points;
    return points;
  }

  miss() {
    this.combo = 0;
  }

  bonus(points) {
    this.score += points;
  }

  /** Persists and returns true if the current score is a new record. */
  commit() {
    if (this.score <= this.highScore) return false;
    this.highScore = this.score;
    try {
      this.storage?.setItem(HIGH_SCORE_KEY, String(this.score));
    } catch {
      // Storage may be unavailable (private mode); the record just won't persist.
    }
    return true;
  }

  loadHighScore() {
    try {
      return Number(this.storage?.getItem(HIGH_SCORE_KEY)) || 0;
    } catch {
      return 0;
    }
  }
}
