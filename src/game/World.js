import { RoachFactory } from "../entities/RoachFactory.js";
import { FloatingText, MissMark, Splat } from "../entities/Splat.js";

const MAX_SPLATS = 40;

/** Everything on the floor: live roaches, remains and short-lived effects. */
export class World {
  constructor(bus, renderer) {
    this.bus = bus;
    this.renderer = renderer;
    this.factory = new RoachFactory();
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.clear();
  }

  clear() {
    this.roaches = [];
    this.splats = [];
    this.effects = [];
  }

  resize(width, height, dpr) {
    Object.assign(this, { width, height, dpr });
  }

  spawn(config) {
    const roach = this.factory.spawn(this.width, this.height, config);
    this.roaches.push(roach);
    this.bus.emit("spawn", roach);
  }

  spawnFromMouth(mouth, config) {
    const roach = this.factory.spawnFromMouth(mouth, config);
    this.roaches.push(roach);
    this.bus.emit("spawn", roach);
  }

  update(dt, threats) {
    const world = { width: this.width, height: this.height, threats };
    for (const r of this.roaches) r.update(dt, world);
    this.roaches = this.roaches.filter((r) => !r.gone && !r.dead);
    for (const s of this.splats) s.update(dt);
    this.splats = this.splats.filter((s) => !s.done);
    for (const e of this.effects) e.update(dt);
    this.effects = this.effects.filter((e) => !e.done);
  }

  /** Squashes every roach under the strike; returns the squashed roaches. */
  strike({ x, y, radius }) {
    const hit = this.roaches.filter((r) => r.hitTest(x, y, radius));
    for (const r of hit) {
      r.dead = true;
      this.splats.push(new Splat(r, this.renderer));
    }
    if (this.splats.length > MAX_SPLATS) this.splats.splice(0, this.splats.length - MAX_SPLATS);
    if (!hit.length) this.effects.push(new MissMark(x, y, radius + 10));
    // Survivors nearby panic.
    for (const r of this.roaches) {
      if (Math.hypot(r.x - x, r.y - y) < r.type.fleeRadius * 1.6) r.scare(x, y, 0.8);
    }
    return hit;
  }

  popup(x, y, text, color) {
    this.effects.push(new FloatingText(x, y, text, color));
  }

  /** 0..1 measure of scuttling for the scurry sound. */
  activity() {
    let a = 0;
    for (const r of this.roaches) a += r.speed / 400;
    return a;
  }

  draw(ctx, time) {
    for (const s of this.splats) s.draw(ctx);
    for (const r of this.roaches) this.renderer.draw(ctx, r, time);
    for (const e of this.effects) e.draw(ctx);
  }
}
