export class GameLoop {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.last = 0;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }

  tick(now) {
    if (!this.running) return;
    // Clamp dt so a backgrounded tab doesn't teleport everything.
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.update(dt, now / 1000);
    this.render(now / 1000);
    requestAnimationFrame(this.tick);
  }
}
