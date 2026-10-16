import { Roach } from "./Roach.js";
import { rand } from "../core/math.js";

// Species catalogue. Colours feed RoachRenderer; behaviour numbers feed Roach.
export const ROACH_TYPES = {
  german: {
    name: "german",
    points: 10,
    length: 34,
    widthRatio: 0.42,
    speed: [150, 210],
    fleeBoost: 1.9,
    fleeRadius: 110,
    freezeChance: 0.35,
    colors: { base: "#a0743f", dark: "#4a2c12", light: "#d2a466", legs: "#6b4520", stripes: true },
  },
  american: {
    name: "american",
    points: 15,
    length: 52,
    widthRatio: 0.4,
    speed: [110, 160],
    fleeBoost: 2.0,
    fleeRadius: 130,
    freezeChance: 0.45,
    colors: { base: "#7a3414", dark: "#2c0f04", light: "#b8692f", legs: "#5a2a10", rim: "#d9a35a" },
  },
  golden: {
    name: "golden",
    points: 50,
    length: 40,
    widthRatio: 0.42,
    speed: [230, 280],
    fleeBoost: 1.6,
    fleeRadius: 160,
    freezeChance: 0.2,
    colors: { base: "#c9971c", dark: "#5e4005", light: "#ffe27a", legs: "#7a5a12", rim: "#fff1b8", shiny: true },
  },
};

/** Factory pattern: picks a species by weight and spawns it at a screen edge heading inward. */
export class RoachFactory {
  pickType(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [name, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return ROACH_TYPES[name];
    }
    return ROACH_TYPES.german;
  }

  spawn(width, height, { weights, speedMul }) {
    const type = this.pickType(weights);
    // Bigger screens get slightly bigger (and proportionally faster) roaches.
    const sizeMul = Math.max(0.85, Math.min(1.5, Math.min(width, height) / 600));
    const off = type.length * sizeMul * 1.2;
    const edge = Math.floor(Math.random() * 4);
    let x;
    let y;
    switch (edge) {
      case 0: x = rand(0, width); y = -off; break;
      case 1: x = width + off; y = rand(0, height); break;
      case 2: x = rand(0, width); y = height + off; break;
      default: x = -off; y = rand(0, height);
    }
    // Aim roughly at a random point in the central area.
    const tx = rand(width * 0.2, width * 0.8);
    const ty = rand(height * 0.2, height * 0.8);
    const heading = Math.atan2(ty - y, tx - x);
    return new Roach({ type, x, y, heading, speedMul: speedMul * Math.sqrt(sizeMul), sizeMul, entry: { x: tx, y: ty } });
  }

  /** A roach squeezing out of a mouth: sized to the mouth, crawling down and out. */
  spawnFromMouth(mouth, { weights, speedMul }) {
    const type = this.pickType(weights);
    const sizeMul = Math.max(0.6, Math.min(1.8, mouth.width / 55));
    const heading = Math.PI / 2 + rand(-1.2, 1.2);
    return new Roach({ type, x: mouth.x, y: mouth.y, heading, speedMul, sizeMul, emerging: true });
  }
}
