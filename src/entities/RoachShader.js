// Software "shader" that renders a cockroach body as a lit 3D surface:
// a height field of smoothly-united ellipsoids -> normals -> Lambert +
// Blinn-Phong chitin gloss + Fresnel rim + ambient occlusion, over a
// procedurally textured albedo. Pure functions; no DOM, so it is testable.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Deterministic value noise + fBm for chitin texture.
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

export function fbm(x, y, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x, y, seed + i) * amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Body parts in body units: u along the body (+ forward, -0.5..0.5),
// v across it (-0.5..0.5 at the widest point). c = dome height, p = flatness.
const PARTS = [
  { id: "abdomen", u: -0.1, v: 0, a: 0.4, b: 0.5, c: 0.2, p: 1 },
  { id: "wings", u: -0.07, v: 0, a: 0.44, b: 0.47, c: 0.29, p: 0.7 },
  { id: "head", u: 0.37, v: 0, a: 0.075, b: 0.2, c: 0.2, p: 1 },
  { id: "pronotum", u: 0.245, v: 0, a: 0.14, b: 0.5, c: 0.3, p: 0.35 },
];

/** Height (body units) and dominant part at a body-space point. */
export function bodyHeight(u, v) {
  const k = 60;
  let sum = 0;
  let best = 0;
  let id = null;
  for (const part of PARTS) {
    const du = (u - part.u) / part.a;
    const dv = (v - part.v) / part.b;
    const r2 = du * du + dv * dv;
    if (r2 >= 1) continue;
    let h = part.c * Math.pow(1 - r2, part.p * 0.5);
    if (part.id === "wings") {
      // Overlap seam down the middle of the wings, and a slight tip taper.
      h -= 0.035 * Math.exp(-(((v + 0.01) / 0.025) ** 2)) * smoothstep(0.12, -0.1, u);
    }
    if (part.id === "abdomen") h -= 0.02 * (0.5 + 0.5 * Math.cos(u * 55));
    sum += Math.exp(k * h);
    if (h > best) {
      best = h;
      id = part.id;
    }
  }
  if (!id) return { h: 0, id: null };
  return { h: Math.log(sum) / k, id };
}

/** Parses a species colour set once for the per-pixel shader. */
export function palette(colors) {
  return { ...colors, rgb: { base: hexToRgb(colors.base), dark: hexToRgb(colors.dark), light: hexToRgb(colors.light) } };
}

/** Surface colour (0..255 rgb) before lighting. `colors` comes from palette(). */
export function albedo(u, v, id, colors, seed = 1) {
  const { base, dark, light } = colors.rgb;
  const n = fbm(u * 18, v * 18, seed);
  let t; // 0 = dark .. 1 = light
  switch (id) {
    case "wings": {
      t = 0.38 + 0.18 * smoothstep(-0.5, 0.1, u) - 0.18 * smoothstep(-0.25, -0.5, u);
      // Fine longitudinal veins.
      const vein = Math.abs(Math.sin(v * 72 + u * 9 + n * 4));
      t -= 0.05 * smoothstep(0.9, 1, vein);
      // Thin translucent amber rim.
      const rim = smoothstep(0.4, 0.47, Math.abs(v)) * smoothstep(0.15, -0.3, u);
      t += 0.16 * rim;
      break;
    }
    case "pronotum": {
      const pu = (u - 0.245) / 0.14;
      const pv = v / 0.5;
      const r = Math.hypot(pu, pv);
      if (colors.rim) {
        // Pale margin around a dark two-lobed ("butterfly") centre.
        const lobes = Math.hypot(pu * 1.2, (Math.abs(pv) - 0.28) * 1.6);
        t = r > 0.74 ? 0.9 - 0.15 * n : lobes < 0.62 ? 0.05 : 0.32;
      } else {
        t = 0.55;
        if (colors.stripes) t -= 0.5 * smoothstep(0.07, 0.03, Math.abs(Math.abs(pv) - 0.3));
      }
      break;
    }
    case "head":
      t = 0.12;
      break;
    default: // abdomen edges peeking out
      t = 0.1 + 0.15 * (0.5 + 0.5 * Math.cos(u * 55));
  }
  t = clamp(t + (n - 0.5) * 0.25, 0, 1);
  const [a, b, k] = t < 0.5 ? [dark, base, t * 2] : [base, light, (t - 0.5) * 2];
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
}

/**
 * Renders the body into an RGBA buffer.
 * lightAngle: direction *towards* the light in body-local radians (0 = ahead).
 */
export function shadeBody({ width, height, L, W, colors, lightAngle, seed = 1, shiny = false }) {
  const n = width * height;
  const pal = palette(colors);
  const hbuf = new Float32Array(n);
  const ids = new Array(n);
  const cx = width / 2;
  const cy = height / 2;
  // Pass 1: height field.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5 - cx) / L;
      const v = (y + 0.5 - cy) / W;
      const { h, id } = bodyHeight(u, v);
      hbuf[y * width + x] = h;
      ids[y * width + x] = id;
    }
  }
  // Blurred height for ambient occlusion.
  const blur = boxBlur(hbuf, width, height, Math.max(2, Math.round(W * 0.08)));

  const elev = 0.95; // ~55°
  const lx = Math.cos(lightAngle) * Math.cos(elev);
  const ly = Math.sin(lightAngle) * Math.cos(elev);
  const lz = Math.sin(elev);
  let hx = lx;
  let hy = ly;
  let hz = lz + 1;
  const hl = Math.hypot(hx, hy, hz);
  hx /= hl;
  hy /= hl;
  hz /= hl;
  const shininess = shiny ? 50 : 90;
  const specK = shiny ? 1.1 : 0.85;
  const bump = W * 0.75; // height units -> pixels

  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const h = hbuf[i];
      if (h <= 0) continue;
      const hL = hbuf[i - 1] ?? 0;
      const hR = hbuf[i + 1] ?? 0;
      const hU = hbuf[i - width] ?? 0;
      const hD = hbuf[i + width] ?? 0;
      let nx = -((hR - hL) * bump) / 2;
      let ny = -((hD - hU) * bump) / 2;
      let nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;

      const u = (x + 0.5 - cx) / L;
      const v = (y + 0.5 - cy) / W;
      const [ar, ag, ab] = albedo(u, v, ids[i], pal, seed);
      const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz);
      const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
      // Gloss is broken up slightly by the chitin texture.
      // Tight highlight + broad sheen, broken up slightly by the chitin texture.
      const tex = 0.75 + 0.5 * fbm(u * 30, v * 30, seed + 7);
      const spec = (specK * Math.pow(ndh, shininess) + 0.1 * Math.pow(ndh, 8)) * tex;
      const fresnel = Math.pow(1 - nz, 3) * 0.25;
      const ao = clamp(1 - (blur[i] - h) * 6, 0.5, 1) * clamp(0.8 + h * 1.2, 0, 1);
      const lit = (0.24 + 0.78 * diffuse) * ao;
      const grain = 0.94 + 0.12 * hash(x, y, seed);
      const o = i * 4;
      out[o] = (ar * lit + 255 * spec + 120 * fresnel) * grain;
      out[o + 1] = (ag * lit + 240 * spec + 110 * fresnel) * grain;
      out[o + 2] = (ab * lit + 215 * spec + 100 * fresnel) * grain;
      out[o + 3] = 255 * clamp(h / 0.03, 0, 1);
    }
  }
  return out;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / span;
      acc += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / span;
      acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}
