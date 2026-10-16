export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Cheap smooth 1D noise built from summed sines (deterministic per seed). */
export function smoothNoise(t, seed = 0) {
  return (
    Math.sin(t * 1.3 + seed) * 0.5 +
    Math.sin(t * 2.7 + seed * 1.7) * 0.3 +
    Math.sin(t * 5.1 + seed * 2.3) * 0.2
  );
}
