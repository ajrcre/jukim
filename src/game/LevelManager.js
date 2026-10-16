/** Difficulty curve and per-level timer/progress. */
export function levelConfig(level) {
  const n = level - 1;
  return {
    level,
    duration: 30 + Math.min(n, 6) * 3,
    target: 8 + n * 4,
    spawnInterval: Math.max(0.3, 1.5 - n * 0.14),
    maxOnScreen: Math.min(26, 4 + n * 2),
    speedMul: 1 + Math.min(n, 10) * 0.08,
    weights: {
      german: 4 + n * 1.5,
      american: Math.max(1.5, 5 - n * 0.4),
      golden: level >= 2 ? 0.45 : 0,
    },
  };
}

export class LevelManager {
  constructor() {
    this.start(1);
  }

  start(level) {
    this.config = levelConfig(level);
    this.timeLeft = this.config.duration;
    this.squashed = 0;
    this.spawnTimer = 0.4;
  }

  get level() {
    return this.config.level;
  }

  get complete() {
    return this.squashed >= this.config.target;
  }

  get failed() {
    return this.timeLeft <= 0 && !this.complete;
  }

  /** Advances time; returns how many roaches should spawn now. */
  update(dt, onScreen) {
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.spawnTimer -= dt;
    let spawn = 0;
    while (this.spawnTimer <= 0) {
      this.spawnTimer += this.config.spawnInterval * (0.6 + Math.random() * 0.8);
      if (onScreen + spawn < this.config.maxOnScreen) spawn++;
    }
    return spawn;
  }

  recordSquash() {
    this.squashed++;
  }
}
