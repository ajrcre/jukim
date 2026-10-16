import { BACKGROUNDS, DEFAULT_BACKGROUND, imageBackground } from "./backgrounds.js";

/** Paints the selected background strategy, or hides it while the rear camera is the backdrop. */
export class BackgroundManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.strategies = new Map(BACKGROUNDS.map((b) => [b.id, b]));
    this.current = this.strategies.get(DEFAULT_BACKGROUND);
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  list() {
    return [...this.strategies.values()];
  }

  select(id) {
    const s = this.strategies.get(id);
    if (!s) return false;
    this.current = s;
    this.paint();
    return true;
  }

  useImage(image) {
    this.strategies.set("image", imageBackground(image));
    this.select("image");
  }

  setCameraBackdrop(on) {
    this.canvas.hidden = on;
  }

  resize(width, height, dpr) {
    Object.assign(this, { width, height, dpr });
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.paint();
  }

  paint() {
    if (!this.width) return;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.current.draw(this.ctx, this.width, this.height);
  }

  /** Small preview image for the settings panel. */
  thumbnail(strategy, w = 120, h = 80) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    // Paint a larger area scaled down so tile sizes look representative.
    ctx.scale(0.4, 0.4);
    strategy.draw(ctx, w / 0.4, h / 0.4);
    return c.toDataURL();
  }
}
