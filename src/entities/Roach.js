import { TAU, angleDiff, clamp, rand, smoothNoise } from "../core/math.js";

let nextId = 1;

/**
 * A single cockroach: position, heading and a tiny behaviour state machine
 * (wander / freeze / flee / leave). Rendering lives in RoachRenderer.
 */
export class Roach {
  constructor({ type, x, y, heading, speedMul = 1, sizeMul = 1, entry = null, emerging = false }) {
    this.id = nextId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.entry = entry;
    this.length = type.length * sizeMul * rand(0.9, 1.1);
    this.width = this.length * type.widthRatio;
    this.cruiseSpeed = rand(type.speed[0], type.speed[1]) * speedMul;
    this.maxSpeed = this.cruiseSpeed * type.fleeBoost;
    this.speed = this.cruiseSpeed;
    this.seed = Math.random() * 100;
    this.gait = Math.random() * TAU;
    this.age = 0;
    this.lifetime = rand(7, 14);
    this.state = "wander";
    this.stateTimer = 0;
    this.entered = emerging;
    // 0..1 progress of squeezing out of a mouth; 1 = fully out.
    this.emerge = emerging ? 0 : 1;
    this.dead = false;
    this.gone = false;
  }

  get fleeing() {
    return this.state === "flee";
  }

  /** Visual scale while emerging (starts small, grows to full size). */
  get renderScale() {
    const t = this.emerge;
    return 0.35 + 0.65 * (1 - (1 - t) * (1 - t));
  }

  /** Is the point (with extra tolerance radius) on the roach's body? */
  hitTest(px, py, tolerance = 0) {
    const dx = px - this.x;
    const dy = py - this.y;
    const cos = Math.cos(-this.heading);
    const sin = Math.sin(-this.heading);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    const a = this.length * 0.55 + tolerance;
    const b = this.width * 0.6 + tolerance;
    return (lx * lx) / (a * a) + (ly * ly) / (b * b) <= 1;
  }

  update(dt, world) {
    this.age += dt;
    this.stateTimer -= dt;
    if (this.emerge < 1) this.emerge = Math.min(1, this.emerge + dt / 0.45);

    const threat = this.nearestThreat(world.threats);
    if (threat && threat.d < this.type.fleeRadius) {
      this.scare(threat.x, threat.y, rand(0.6, 1.2));
    } else if (this.state === "flee" && this.stateTimer <= 0) {
      this.state = "wander";
    }

    if (this.state === "wander" && this.age > this.lifetime) this.state = "leave";

    if (this.state === "wander" && this.entered && Math.random() < this.type.freezeChance * dt) {
      this.state = "freeze";
      this.stateTimer = rand(0.3, 1.6);
    } else if (this.state === "freeze" && this.stateTimer <= 0) {
      this.state = "wander";
    }

    let targetSpeed = this.cruiseSpeed;
    let desired = this.heading + smoothNoise(this.age * 1.4, this.seed) * 0.9;
    // Until it is on screen, head for the entry point instead of wandering off.
    if (!this.entered && this.entry && this.state !== "flee") {
      desired = Math.atan2(this.entry.y - this.y, this.entry.x - this.x);
    }

    switch (this.state) {
      case "freeze":
        targetSpeed = 0;
        desired = this.heading;
        break;
      case "flee":
        targetSpeed = this.maxSpeed;
        desired = Math.atan2(this.y - this.fleeFrom.y, this.x - this.fleeFrom.x) + smoothNoise(this.age * 4, this.seed) * 0.5;
        break;
      case "leave":
        desired = this.exitHeading(world);
        break;
    }

    if (this.entered && this.emerge >= 1 && this.state !== "leave") desired = this.avoidEdges(desired, world);

    const turnRate = this.state === "flee" ? 9 : 4;
    this.heading += clamp(angleDiff(this.heading, desired), -turnRate * dt, turnRate * dt);
    const accel = targetSpeed > this.speed ? 900 : 1400;
    this.speed += clamp(targetSpeed - this.speed, -accel * dt, accel * dt);

    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;
    // Stride length scales with body size; one full gait cycle per stride.
    this.gait += (this.speed * dt) / (this.length * 0.45) * TAU * 0.5;

    const margin = this.length;
    const inside = this.x > margin && this.x < world.width - margin && this.y > margin && this.y < world.height - margin;
    if (inside) this.entered = true;
    const outside =
      this.x < -margin * 2 || this.x > world.width + margin * 2 || this.y < -margin * 2 || this.y > world.height + margin * 2;
    if (outside && (this.entered || this.age > 6)) this.gone = true;
  }

  /** Start (or extend) running away from a point. */
  scare(x, y, duration) {
    if (this.state !== "flee") this.stateTimer = duration;
    this.state = "flee";
    this.fleeFrom = { x, y };
  }

  nearestThreat(threats) {
    let best = null;
    for (const t of threats) {
      // `scare` < 1 makes a threat less frightening (e.g. a slow camera-tracked hand).
      const d = Math.hypot(t.x - this.x, t.y - this.y) / (t.scare ?? 1);
      if (!best || d < best.d) best = { x: t.x, y: t.y, d };
    }
    return best;
  }

  avoidEdges(desired, world) {
    const pad = Math.min(80, Math.min(world.width, world.height) * 0.12);
    let steerX = 0;
    let steerY = 0;
    if (this.x < pad) steerX = 1;
    else if (this.x > world.width - pad) steerX = -1;
    if (this.y < pad) steerY = 1;
    else if (this.y > world.height - pad) steerY = -1;
    if (!steerX && !steerY) return desired;
    return Math.atan2(steerY || Math.sin(desired), steerX || Math.cos(desired));
  }

  exitHeading(world) {
    const options = [
      { d: this.x, a: Math.PI },
      { d: world.width - this.x, a: 0 },
      { d: this.y, a: -Math.PI / 2 },
      { d: world.height - this.y, a: Math.PI / 2 },
    ];
    options.sort((p, q) => p.d - q.d);
    return options[0].a;
  }
}
