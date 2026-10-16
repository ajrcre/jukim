import { TAU, smoothNoise } from "../core/math.js";
import { shadeBody } from "./RoachShader.js";

const DEG = Math.PI / 180;
const BUCKETS = 16;
// Direction towards the light in screen space (upper-left), shared by every roach.
const WORLD_LIGHT = Math.atan2(-0.8, -0.6);

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

/** A shaded tube segment: dark outline, body colour, then a thin specular line. */
function tube(ctx, x1, y1, x2, y2, width, color) {
  ctx.lineWidth = width * 1.25;
  ctx.strokeStyle = "rgba(20,8,0,0.35)";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  if (width > 1.5) {
    ctx.lineWidth = width * 0.25;
    ctx.strokeStyle = "rgba(255,225,180,0.2)";
    ctx.stroke();
  }
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
  const tx = fx + Math.cos(tarsA) * L * 0.1;
  const ty = fy + Math.sin(tarsA) * L * 0.1;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Spines first so the tibia sits on top of their bases.
  ctx.strokeStyle = "rgba(40,18,4,0.75)";
  ctx.lineWidth = Math.max(0.4, L * 0.008);
  ctx.beginPath();
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const sx = kx + (fx - kx) * t;
    const sy = ky + (fy - ky) * t;
    const sa = at + (i % 2 ? -1 : 1) * side * 40 * DEG;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(sa) * L * 0.05, sy + Math.sin(sa) * L * 0.05);
  }
  ctx.stroke();
  tube(ctx, ax, ay, kx, ky, Math.max(1.2, L * 0.05), color);
  tube(ctx, kx, ky, fx, fy, Math.max(0.9, L * 0.03), color);
  // Segmented tarsus.
  const mx = (fx + tx) / 2;
  const my = (fy + ty) / 2;
  tube(ctx, fx, fy, mx, my, Math.max(0.6, L * 0.018), color);
  tube(ctx, mx, my, tx, ty, Math.max(0.5, L * 0.014), color);
}

export function drawAntennae(ctx, L, W, t, seed, color, droop = 0) {
  ctx.lineCap = "round";
  const segs = 12;
  for (const side of [-1, 1]) {
    let x = L * 0.42;
    let y = side * W * 0.1;
    let a = side * (14 + droop) * DEG + smoothNoise(t * 2.2, seed + side * 3) * 0.35;
    const segLen = (L * 1.15) / segs;
    for (let i = 0; i < segs; i++) {
      // Bend outward gradually and wiggle more toward the tip.
      a += side * (4 + droop * 0.3) * DEG + smoothNoise(t * 3 + i * 0.4, seed + side) * 0.06 * (i / segs);
      const nx = x + Math.cos(a) * segLen;
      const ny = y + Math.sin(a) * segLen;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, L * (0.024 - (i / segs) * 0.016));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      if (i < 5) {
        ctx.strokeStyle = "rgba(255,220,170,0.3)";
        ctx.lineWidth *= 0.35;
        ctx.stroke();
      }
      x = nx;
      y = ny;
    }
  }
}

function drawCerci(ctx, L, W, color) {
  for (const s of [-1, 1]) tube(ctx, -L * 0.44, s * W * 0.08, -L * 0.57, s * W * 0.22, Math.max(0.8, L * 0.025), color);
}

/** Renders roaches: shader-lit body sprites (cached per light bucket) + per-frame legs, antennae and shadow. */
export class RoachRenderer {
  constructor() {
    this.cache = new Map();
    this.dpr = 1;
    this.budget = Infinity;
  }

  setPixelRatio(dpr) {
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.cache.clear();
    }
  }

  static bucketOf(heading) {
    const b = Math.round(heading / (TAU / BUCKETS)) % BUCKETS;
    return (b + BUCKETS) % BUCKETS;
  }

  /** Call once per frame: limits how many new sprites get shaded in one frame. */
  beginFrame() {
    this.budget = 2;
  }

  /** Lit body sprite for a roach of this species and size facing `heading`. */
  bodySprite(type, L, W, heading = 0) {
    // Geometric size steps (~10%) keep the cache small; the sprite is scaled to fit.
    const Lq = Math.max(8, Math.round(Math.pow(1.1, Math.round(Math.log(L) / Math.log(1.1)))));
    const Wq = Lq * type.widthRatio;
    const bucket = RoachRenderer.bucketOf(heading);
    const key = `${type.name}:${Lq}:${bucket}`;
    let sprite = this.cache.get(key);
    if (!sprite && this.budget <= 0) {
      // Over budget this frame: borrow a neighbouring light bucket if one exists.
      for (let d = 1; d <= 8 && !sprite; d++) {
        sprite =
          this.cache.get(`${type.name}:${Lq}:${(bucket + d) % BUCKETS}`) ??
          this.cache.get(`${type.name}:${Lq}:${(bucket - d + BUCKETS) % BUCKETS}`);
      }
    }
    if (!sprite) {
      this.budget--;
      const dpr = this.dpr;
      const w = Math.ceil(Lq * 1.2 * dpr);
      const h = Math.ceil(Wq * 1.25 * dpr);
      const lightAngle = WORLD_LIGHT - bucket * (TAU / BUCKETS);
      const pixels = shadeBody({
        width: w,
        height: h,
        L: Lq * dpr,
        W: Wq * dpr,
        colors: type.colors,
        lightAngle,
        seed: 3,
        shiny: !!type.colors.shiny,
      });
      const canvas = makeCanvas(w, h);
      canvas.getContext("2d").putImageData(new ImageData(pixels, w, h), 0, 0);
      sprite = { canvas, w: w / dpr, h: h / dpr, scale: L / Lq };
      this.cache.set(key, sprite);
    }
    return sprite;
  }

  /** Soft ambient shadow plus a tighter contact shadow, in body-local space. */
  drawShadow(ctx, L, W) {
    for (const [sx, sy, a] of [
      [0.68, 1.15, 0.28],
      [0.5, 0.62, 0.35],
    ]) {
      ctx.save();
      ctx.scale(L * sx, W * sy);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  draw(ctx, roach, time) {
    const { length: L, width: W, type } = roach;
    const rs = roach.renderScale ?? 1;

    ctx.save();
    ctx.translate(roach.x, roach.y);
    ctx.scale(rs, rs);
    this.drawShadowRotated(ctx, roach.heading, L, W);
    ctx.rotate(roach.heading);

    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        const phase = roach.gait + tripodGroup(i, side) * Math.PI;
        const swing = Math.sin(phase) * LEGS[i].swing * DEG;
        const lift = Math.max(0, Math.cos(phase));
        drawLeg(ctx, L, W, i, side, swing, lift, type.colors.legs);
      }
    }
    drawCerci(ctx, L, W, type.colors.legs);
    drawAntennae(ctx, L, W, time, roach.seed, type.colors.dark);

    const sprite = this.bodySprite(type, L, W, roach.heading);
    const sw = sprite.w * sprite.scale;
    const sh = sprite.h * sprite.scale;
    ctx.drawImage(sprite.canvas, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }

  /** Shadow offset away from the fixed world light, then aligned with the body. */
  drawShadowRotated(ctx, heading, L, W) {
    const ox = -Math.cos(WORLD_LIGHT) * L * 0.07;
    const oy = -Math.sin(WORLD_LIGHT) * L * 0.07;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(heading);
    this.drawShadow(ctx, L, W);
    ctx.restore();
  }
}

export { makeCanvas, tripodGroup };
