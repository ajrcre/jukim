import { TAU, rand } from "../core/math.js";
import { drawAntennae, drawBody, drawLeg, makeCanvas } from "./RoachRenderer.js";

const GOO = ["#e9dfb4", "#d8c98e", "#cdb87a"];
const JUICE = "rgba(92,62,22,0.75)";

function blob(ctx, x, y, r, color, roughness = 0.35) {
  const n = 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + rand(-roughness, roughness));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x + Math.cos(a - 0.26) * rr * 1.1, y + Math.sin(a - 0.26) * rr * 1.1, px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Squashed roach remains: pre-rendered goo + flattened body, with legs that twitch for a moment. */
export class Splat {
  constructor(roach, dpr = 1, { fadeStart = 15, fadeEnd = 20 } = {}) {
    this.x = roach.x;
    this.y = roach.y;
    this.heading = roach.heading + rand(-0.2, 0.2);
    this.L = roach.length;
    this.W = roach.width;
    this.type = roach.type;
    this.seed = roach.seed;
    this.age = 0;
    this.fadeStart = fadeStart;
    this.fadeEnd = fadeEnd;
    this.legs = [];
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const detached = Math.random() < 0.3;
        this.legs.push({
          i,
          side,
          splay: rand(-25, 25) * (Math.PI / 180),
          dx: detached ? rand(0.2, 0.6) * this.L * side : 0,
          dy: detached ? rand(-0.4, 0.4) * this.L : 0,
          twitch: Math.random() < 0.6,
          freq: rand(18, 35),
        });
      }
    }
    this.sprite = this.render(dpr);
  }

  get done() {
    return this.age >= this.fadeEnd;
  }

  update(dt) {
    this.age += dt;
  }

  render(dpr) {
    const { L, W } = this;
    const size = L * 3.2;
    const canvas = makeCanvas(Math.ceil(size * dpr), Math.ceil(size * dpr));
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    c.translate(size / 2, size / 2);
    c.rotate(this.heading);

    // Brown juice under everything.
    blob(c, rand(-3, 3), rand(-3, 3), L * 0.55, JUICE, 0.45);
    // Droplets flung outward.
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU);
      const d = rand(0.45, 1.3) * L;
      blob(c, Math.cos(a) * d, Math.sin(a) * d * 0.8, rand(0.02, 0.07) * L, Math.random() < 0.5 ? JUICE : GOO[i % 3], 0.3);
    }
    // Streaks in the slap direction.
    c.strokeStyle = JUICE;
    c.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const a = rand(-0.6, 0.6) + (Math.random() < 0.5 ? 0 : Math.PI);
      c.lineWidth = rand(0.02, 0.05) * L;
      c.beginPath();
      c.moveTo(Math.cos(a) * L * 0.3, Math.sin(a) * L * 0.3);
      c.lineTo(Math.cos(a) * L * rand(0.7, 1.2), Math.sin(a) * L * rand(0.7, 1.2));
      c.stroke();
    }

    // Flattened, darkened body.
    c.save();
    c.scale(1.12, 1.4);
    drawBody(c, L, W, this.type.colors);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(25,10,0,0.35)";
    c.fillRect(-L, -L, L * 2, L * 2);
    c.restore();
    c.globalCompositeOperation = "source-over";

    // Cracks in the shell.
    c.strokeStyle = "rgba(10,4,0,0.8)";
    c.lineWidth = Math.max(0.6, L * 0.015);
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      let x = rand(-0.2, 0.2) * L;
      let y = rand(-0.2, 0.2) * W;
      c.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        x += rand(-0.15, 0.15) * L;
        y += rand(-0.25, 0.25) * W;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    // Innards oozing over the shell.
    for (let i = 0; i < 4; i++) {
      blob(c, rand(-0.3, 0.2) * L, rand(-0.35, 0.35) * W * 1.4, rand(0.06, 0.13) * L, GOO[i % 3], 0.4);
    }
    return { canvas, size };
  }

  draw(ctx) {
    const alpha = this.age < this.fadeStart ? 1 : Math.max(0, 1 - (this.age - this.fadeStart) / (this.fadeEnd - this.fadeStart));
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.heading);
    const twitchDecay = Math.max(0, 1 - this.age / 2.5);
    for (const leg of this.legs) {
      const twitch = leg.twitch ? Math.sin(this.age * leg.freq) * 0.35 * twitchDecay : 0;
      ctx.save();
      ctx.translate(leg.dx, leg.dy);
      drawLeg(ctx, this.L, this.W * 1.4, leg.i, leg.side, leg.splay + twitch, 0, this.type.colors.legs);
      ctx.restore();
    }
    // The sprite was pre-rendered already rotated, so draw it unrotated.
    ctx.rotate(-this.heading);
    const { canvas, size } = this.sprite;
    ctx.drawImage(canvas, -size / 2, -size / 2, size, size);
    ctx.rotate(this.heading);
    drawAntennae(ctx, this.L, this.W, this.age < 1.5 ? this.age : 1.5, this.seed, this.type.colors.dark, 25);
    ctx.restore();
  }
}

/** A brief dusty ring where a strike missed. */
export class MissMark {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.age = 0;
    this.duration = 0.45;
  }

  get done() {
    return this.age >= this.duration;
  }

  update(dt) {
    this.age += dt;
  }

  draw(ctx) {
    const t = this.age / this.duration;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.6;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3 * (1 - t) + 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (0.6 + t * 0.8), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/** Floating "+20 x2" style text. */
export class FloatingText {
  constructor(x, y, text, color = "#fff") {
    Object.assign(this, { x, y, text, color, age: 0, duration: 0.9 });
  }

  get done() {
    return this.age >= this.duration;
  }

  update(dt) {
    this.age += dt;
    this.y -= 50 * dt;
  }

  draw(ctx) {
    const t = this.age / this.duration;
    ctx.save();
    ctx.globalAlpha = 1 - t * t;
    ctx.font = `bold ${22 + 6 * (1 - t)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}
