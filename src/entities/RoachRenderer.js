import { TAU, smoothNoise } from "../core/math.js";

const DEG = Math.PI / 180;

// Leg geometry in body-length units. Angles are measured from "forward",
// mirrored for each side. Hind legs are the longest, like a real roach.
export const LEGS = [
  { name: "front", ax: 0.16, femur: 0.2, tibia: 0.26, aFemur: 62, aTibia: 22, swing: 20 },
  { name: "mid", ax: 0.05, femur: 0.24, tibia: 0.32, aFemur: 100, aTibia: 128, swing: 22 },
  { name: "hind", ax: -0.04, femur: 0.3, tibia: 0.46, aFemur: 132, aTibia: 160, swing: 16 },
];

// Tripod gait: front+hind on one side move with the middle leg of the other side.
const tripodGroup = (legIndex, side) => ((legIndex === 1) !== (side > 0) ? 0 : 1);

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Draws one leg in body-local coordinates (+x forward). */
export function drawLeg(ctx, L, W, legIndex, side, swingRad, lift, color) {
  const leg = LEGS[legIndex];
  const ax = leg.ax * L;
  const ay = side * W * 0.28;
  const af = side * (leg.aFemur * DEG) - side * swingRad;
  const at = side * (leg.aTibia * DEG) - side * swingRad * 1.25;
  const fl = leg.femur * L;
  const tl = leg.tibia * L * (1 - 0.15 * lift);

  const kx = ax + Math.cos(af) * fl;
  const ky = ay + Math.sin(af) * fl;
  const fx = kx + Math.cos(at) * tl;
  const fy = ky + Math.sin(at) * tl;
  const tarsA = at + side * 12 * DEG;
  const tx = fx + Math.cos(tarsA) * L * 0.09;
  const ty = fy + Math.sin(tarsA) * L * 0.09;

  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // femur
  ctx.lineWidth = Math.max(1.2, L * 0.05);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(kx, ky);
  ctx.stroke();
  // tibia
  ctx.lineWidth = Math.max(0.9, L * 0.032);
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  // tarsus
  ctx.lineWidth = Math.max(0.6, L * 0.018);
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // spines on the tibia
  ctx.lineWidth = Math.max(0.5, L * 0.01);
  ctx.beginPath();
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const sx = kx + (fx - kx) * t;
    const sy = ky + (fy - ky) * t;
    const sa = at - side * 35 * DEG;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(sa) * L * 0.045, sy + Math.sin(sa) * L * 0.045);
  }
  ctx.stroke();
  // femur highlight
  ctx.strokeStyle = "rgba(255,230,190,0.18)";
  ctx.lineWidth = Math.max(0.5, L * 0.015);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(kx, ky);
  ctx.stroke();
}

export function drawAntennae(ctx, L, W, t, seed, color, droop = 0) {
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  const segs = 10;
  for (const side of [-1, 1]) {
    let x = L * 0.4;
    let y = side * W * 0.1;
    let a = side * (14 + droop) * DEG + smoothNoise(t * 2.2, seed + side * 3) * 0.35;
    const segLen = (L * 1.15) / segs;
    for (let i = 0; i < segs; i++) {
      // Bend outward gradually and wiggle more toward the tip.
      a += side * (4 + droop * 0.3) * DEG + smoothNoise(t * 3 + i * 0.4, seed + side) * 0.06 * (i / segs);
      const nx = x + Math.cos(a) * segLen;
      const ny = y + Math.sin(a) * segLen;
      ctx.lineWidth = Math.max(0.5, L * (0.024 - (i / segs) * 0.016));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
    }
  }
}

/** Draws the static body (no legs/antennae) centred at the origin, +x forward. */
export function drawBody(ctx, L, W, colors) {
  const { base, dark, light, rim, stripes, shiny } = colors;

  // Cerci at the tail.
  ctx.strokeStyle = dark;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(0.8, L * 0.025);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-L * 0.44, s * W * 0.08);
    ctx.lineTo(-L * 0.56, s * W * 0.2);
    ctx.stroke();
  }

  // Abdomen (visible as a segmented rim around the wings).
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(-L * 0.08, 0, L * 0.4, W * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = Math.max(0.5, L * 0.012);
  for (let i = 0; i < 6; i++) {
    const x = -L * (0.0 + i * 0.065);
    ctx.beginPath();
    ctx.ellipse(x, 0, L * 0.05, W * 0.48, 0, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
  }

  // Head (mostly tucked under the pronotum).
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(L * 0.35, 0, L * 0.075, W * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#120802";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(L * 0.37, s * W * 0.16, L * 0.025, W * 0.07, s * 0.4, 0, TAU);
    ctx.fill();
  }
  // Palps.
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(0.6, L * 0.015);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(L * 0.41, s * W * 0.05);
    ctx.lineTo(L * 0.45, s * W * 0.12);
    ctx.stroke();
  }

  // Wings (tegmina), drawn as two overlapping glossy halves.
  for (const s of [1, -1]) {
    const g = ctx.createLinearGradient(0, 0, 0, s * W * 0.5);
    g.addColorStop(0, light);
    g.addColorStop(0.35, base);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L * 0.16, s * W * 0.02);
    ctx.bezierCurveTo(L * 0.14, s * W * 0.5, -L * 0.2, s * W * 0.56, -L * 0.47, s * W * 0.06);
    ctx.quadraticCurveTo(-L * 0.4, -s * W * 0.04, -L * 0.1, -s * W * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(20,8,0,0.55)";
    ctx.lineWidth = Math.max(0.5, L * 0.012);
    ctx.stroke();
    // Veins.
    ctx.strokeStyle = "rgba(30,12,0,0.18)";
    ctx.lineWidth = Math.max(0.4, L * 0.006);
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(L * 0.1, s * W * 0.06 * i);
      ctx.quadraticCurveTo(-L * 0.15, s * W * (0.08 * i + 0.06), -L * 0.42, s * W * 0.05 * i * 0.6);
      ctx.stroke();
    }
  }

  // Pronotum shield.
  const pg = ctx.createRadialGradient(L * 0.22, -W * 0.12, 1, L * 0.2, 0, W * 0.55);
  pg.addColorStop(0, light);
  pg.addColorStop(0.5, base);
  pg.addColorStop(1, dark);
  ctx.fillStyle = rim || pg;
  ctx.beginPath();
  ctx.ellipse(L * 0.22, 0, L * 0.14, W * 0.48, 0, 0, TAU);
  ctx.fill();
  if (rim) {
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(L * 0.21, 0, L * 0.1, W * 0.34, 0, 0, TAU);
    ctx.fill();
  }
  if (stripes) {
    ctx.fillStyle = "rgba(25,10,0,0.85)";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(L * 0.21, s * W * 0.13, L * 0.11, W * 0.065, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(20,8,0,0.6)";
  ctx.lineWidth = Math.max(0.5, L * 0.012);
  ctx.beginPath();
  ctx.ellipse(L * 0.22, 0, L * 0.14, W * 0.48, 0, 0, TAU);
  ctx.stroke();

  // Specular gloss.
  ctx.fillStyle = shiny ? "rgba(255,255,230,0.55)" : "rgba(255,240,220,0.28)";
  ctx.beginPath();
  ctx.ellipse(-L * 0.08, -W * 0.18, L * 0.22, W * 0.06, -0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(L * 0.24, -W * 0.2, L * 0.05, W * 0.07, 0, 0, TAU);
  ctx.fill();
}

/** Renders live roaches: cached body sprite + per-frame legs, antennae and shadow. */
export class RoachRenderer {
  constructor() {
    this.cache = new Map();
    this.dpr = 1;
  }

  setPixelRatio(dpr) {
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.cache.clear();
    }
  }

  bodySprite(type, L, W) {
    const key = `${type.name}:${Math.round(L)}`;
    let sprite = this.cache.get(key);
    if (!sprite) {
      const pad = L * 0.2;
      const w = L + pad * 2;
      const h = W + pad * 2;
      const canvas = makeCanvas(Math.ceil(w * this.dpr), Math.ceil(h * this.dpr));
      const c = canvas.getContext("2d");
      c.scale(this.dpr, this.dpr);
      c.translate(w / 2, h / 2);
      drawBody(c, L, W, type.colors);
      sprite = { canvas, w, h };
      this.cache.set(key, sprite);
    }
    return sprite;
  }

  drawShadow(ctx, x, y, heading, L, W) {
    ctx.save();
    ctx.translate(x + L * 0.08, y + L * 0.12);
    ctx.rotate(heading);
    ctx.scale(L * 0.62, W * 0.95);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0,0,0,0.38)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx, roach, time) {
    const { length: L, width: W, type } = roach;
    this.drawShadow(ctx, roach.x, roach.y, roach.heading, L, W);

    ctx.save();
    ctx.translate(roach.x, roach.y);
    ctx.rotate(roach.heading);

    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const phase = roach.gait + tripodGroup(i, side) * Math.PI;
        const swing = Math.sin(phase) * LEGS[i].swing * DEG;
        const lift = Math.max(0, Math.cos(phase));
        drawLeg(ctx, L, W, i, side, swing, lift, type.colors.legs);
      }
    }
    drawAntennae(ctx, L, W, time, roach.seed, type.colors.dark);

    const sprite = this.bodySprite(type, L, W);
    ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h / 2, sprite.w, sprite.h);
    ctx.restore();
  }
}

export { makeCanvas, tripodGroup };
