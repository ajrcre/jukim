// Cartoon splash-screen scenes (SVG, animated with requestAnimationFrame).
// Each scene: { id, name, create(svg) -> { destroy() } }.

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

/** Defs shared by all scenes (gradients). */
function defs(svg) {
  const d = el("defs", {}, svg);
  const body = el("linearGradient", { id: "cr-body", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
  el("stop", { offset: 0, "stop-color": "#c06a30" }, body);
  el("stop", { offset: 1, "stop-color": "#5e2a0e" }, body);
  const floor = el("linearGradient", { id: "cr-floor", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
  el("stop", { offset: 0, "stop-color": "#d8cbb2" }, floor);
  el("stop", { offset: 1, "stop-color": "#b9a888" }, floor);
}

/**
 * A side-view cartoon cockroach facing +x, origin at the body centre,
 * feet at y≈+52. Call update(t, opts) every frame.
 */
function cartoonRoach(parent) {
  const g = el("g", {}, parent);
  const inner = el("g", {}, g);
  el("ellipse", { cx: 0, cy: 54, rx: 62, ry: 8, fill: "rgba(0,0,0,.22)" }, inner);
  const farLegs = [0, 1, 2].map(() => el("path", { fill: "none", stroke: "#3a1a08", "stroke-width": 6, "stroke-linecap": "round", "stroke-linejoin": "round" }, inner));
  const antennae = [0, 1].map(() => el("path", { fill: "none", stroke: "#3a1a08", "stroke-width": 4, "stroke-linecap": "round" }, inner));
  el("ellipse", { cx: -10, cy: 0, rx: 58, ry: 30, fill: "url(#cr-body)", stroke: "#2a1206", "stroke-width": 4 }, inner);
  el("path", { d: "M-64 -2 Q-12 -22 44 -6", fill: "none", stroke: "#2a1206", "stroke-width": 3 }, inner);
  el("path", { d: "M-55 14 Q-50 24 -40 26 M-35 18 Q-30 28 -18 29 M-12 20 Q-6 29 6 29", fill: "none", stroke: "#3a1a08", "stroke-width": 2.5, opacity: 0.6 }, inner);
  el("ellipse", { cx: -18, cy: -15, rx: 26, ry: 7, fill: "rgba(255,255,255,.35)" }, inner);
  el("circle", { cx: 56, cy: 4, r: 25, fill: "#7a3a16", stroke: "#2a1206", "stroke-width": 4 }, inner);
  const eyes = [
    [60, -12, 11, 14],
    [77, -9, 10, 13],
  ].map(([cx, cy, rx, ry]) => {
    el("ellipse", { cx, cy, rx, ry, fill: "#fff", stroke: "#2a1206", "stroke-width": 3 }, inner);
    return { cx, cy, pupil: el("circle", { cx, cy, r: 5, fill: "#111" }, inner) };
  });
  const mouth = el("ellipse", { cx: 76, cy: 16, rx: 7, ry: 8, fill: "#5a0d0d", stroke: "#2a1206", "stroke-width": 2.5 }, inner);
  const nearLegs = [0, 1, 2].map(() => el("path", { fill: "none", stroke: "#4a2210", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" }, inner));
  const drops = [0, 1, 2].map(() => el("path", { d: "M0 -7 Q6 2 0 6 Q-6 2 0 -7Z", fill: "#7fd3ff", stroke: "#2b7fb0", "stroke-width": 1.5 }, inner));
  const extra = el("g", {}, g); // speech bubbles etc.

  const legPath = (hx, a) => {
    const kx = hx + Math.sin(a) * 22;
    const ky = 22 + Math.cos(a) * 18;
    const fx = kx + Math.sin(a + 0.5) * 8;
    return `M${hx} 20 L${kx} ${ky} L${fx} 52`;
  };

  return {
    g,
    inner,
    extra,
    update(t, { run = 1, panic = 1, look = -1, mouthOpen = 1, flail = 0 } = {}) {
      const phase = t * (6 + run * 22);
      [-30, -5, 20].forEach((hx, i) => {
        const sw = (0.25 + 0.55 * clamp(run, 0, 1)) + flail * 0.6;
        nearLegs[i].setAttribute("d", legPath(hx, Math.sin(phase + i * 2.1) * sw));
        farLegs[i].setAttribute("d", legPath(hx - 8, Math.sin(phase + i * 2.1 + Math.PI) * sw));
      });
      const w = Math.sin(t * 9) * 8 * (0.4 + panic);
      antennae[0].setAttribute("d", `M66 -24 Q${40 + w} -95 ${-35 + w} -82`);
      antennae[1].setAttribute("d", `M74 -22 Q${60 - w} -100 ${-5 - w} -98`);
      eyes.forEach((e) => {
        e.pupil.setAttribute("cx", e.cx + look * 4);
        e.pupil.setAttribute("cy", e.cy - 2 + Math.sin(t * 13) * panic);
      });
      mouth.setAttribute("ry", 3 + 7 * mouthOpen);
      drops.forEach((d, i) => {
        const u = (t * 1.6 + i / 3) % 1;
        d.setAttribute("transform", `translate(${50 - u * 70} ${-30 - u * 30 - i * 6}) scale(${0.8 + u * 0.4})`);
        d.setAttribute("opacity", panic * (1 - u));
      });
      // Body bob while running.
      inner.setAttribute("transform", `translate(0 ${-Math.abs(Math.sin(phase)) * 4 * run})`);
    },
  };
}

function flipFlop(parent) {
  const g = el("g", {}, parent);
  el("path", { d: "M-150 -8 Q-160 -30 -120 -34 L110 -30 Q160 -26 150 0 Q140 14 100 12 L-120 10 Q-150 10 -150 -8Z", fill: "#ff6fa3", stroke: "#8a1f4e", "stroke-width": 5 }, g);
  el("path", { d: "M-140 4 L130 6", stroke: "#c43c75", "stroke-width": 6 }, g);
  el("path", { d: "M70 -32 Q20 -95 -40 -34 M70 -32 Q40 -90 -10 -33", fill: "none", stroke: "#2f6fd6", "stroke-width": 12, "stroke-linecap": "round" }, g);
  return g;
}

function sneaker(parent) {
  const g = el("g", {}, parent);
  el("path", { d: "M-150 0 Q-155 -60 -90 -70 L-20 -75 Q20 -130 70 -120 L95 -60 Q150 -45 150 -10 L150 0Z", fill: "#e8e8ea", stroke: "#333", "stroke-width": 5 }, g);
  el("rect", { x: -158, y: -4, width: 316, height: 22, rx: 10, fill: "#333" }, g);
  el("path", { d: "M-10 -80 L40 -72 M-2 -94 L48 -86 M6 -108 L56 -100", stroke: "#d33", "stroke-width": 6, "stroke-linecap": "round" }, g);
  el("path", { d: "M-120 -40 Q-60 -50 0 -30", fill: "none", stroke: "#d33", "stroke-width": 8 }, g);
  return g;
}

function dust(parent) {
  const g = el("g", {}, parent);
  const puffs = [-1, -0.5, 0.5, 1].map((dir) => ({ dir, c: el("circle", { r: 10, fill: "#efe6d4", stroke: "#b9a888", "stroke-width": 2 }, g) }));
  return {
    g,
    update(u) {
      g.setAttribute("opacity", u <= 0 || u >= 1 ? 0 : 1 - u);
      for (const p of puffs) {
        p.c.setAttribute("cx", p.dir * (40 + u * 120));
        p.c.setAttribute("cy", -10 - Math.abs(p.dir) * u * 30);
        p.c.setAttribute("r", 8 + u * 20);
      }
    },
  };
}

function bubble(parent, text) {
  const g = el("g", { opacity: 0 }, parent);
  el("rect", { x: -50, y: -34, width: 100, height: 44, rx: 18, fill: "#fff", stroke: "#2a1206", "stroke-width": 3 }, g);
  const t = el("text", { x: 0, y: -4, "text-anchor": "middle", "font-size": 24, "font-weight": 800, fill: "#2a1206" }, g);
  t.textContent = text;
  return g;
}

function sceneBase(svg, { floorRatio = 0.72, wall = false } = {}) {
  svg.innerHTML = "";
  const w = svg.clientWidth || innerWidth;
  const h = svg.clientHeight || innerHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  defs(svg);
  const floorY = h * floorRatio;
  el("rect", { width: w, height: h, fill: wall ? "#efe1c4" : "#3a2414" }, svg);
  if (wall) {
    for (let x = 0; x < w; x += 46) el("rect", { x, y: 0, width: 2, height: floorY - 40, fill: "rgba(150,110,60,.15)" }, svg);
    el("rect", { x: 0, y: floorY - 40, width: w, height: 40, fill: "#a8743f", stroke: "#6b4520", "stroke-width": 3 }, svg);
  }
  el("rect", { x: 0, y: floorY, width: w, height: h - floorY, fill: "url(#cr-floor)" }, svg);
  for (let x = -40; x < w; x += 90) el("line", { x1: x, y1: floorY, x2: x - 60, y2: h, stroke: "rgba(120,100,70,.35)", "stroke-width": 2 }, svg);
  const s = clamp(Math.min(w, h) / 500, 0.6, 1.3);
  return { w, h, floorY, s };
}

function title(svg, w, y, size) {
  const t = el("text", { x: w / 2, y, "text-anchor": "middle", "font-size": size, class: "title" }, svg);
  t.textContent = "מחץ את הג'וק";
  return t;
}

function tapHint(svg, w, h) {
  const t = el("text", { x: w / 2, y: h - 28, "text-anchor": "middle", class: "tap" }, svg);
  t.textContent = "לחצו כדי להתחיל";
}

function loop(fn) {
  let id;
  const start = performance.now();
  const tick = (now) => {
    fn((now - start) / 1000);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

// --- 1. The flip-flop chase ----------------------------------------------------
const slipper = {
  id: "slipper",
  name: "הכפכף",
  create(svg) {
    const { w, h, floorY, s } = sceneBase(svg);
    title(svg, w, h * 0.2, clamp(w * 0.12, 34, 84));
    const world = el("g", {}, svg);
    const roach = cartoonRoach(world);
    const ff = flipFlop(world);
    const puff = dust(world);
    tapHint(svg, w, h);
    const P = 3.6;
    let frozenX = 0;
    const stop = loop((t) => {
      const u = (t % P) / P;
      const rx = -150 * s + u * (w + 300 * s);
      const cycle = (t * 3 / P) % 1; // three slams per crossing
      let hop = 0;
      if (cycle >= 0.62 && cycle < 0.7) hop = Math.sin(seg(cycle, 0.62, 0.7) * Math.PI) * 40 * s;
      roach.g.setAttribute("transform", `translate(${rx} ${floorY - 52 * s - hop}) scale(${s})`);
      roach.update(t, { run: 1, panic: 1, look: -1, mouthOpen: 0.6 + 0.4 * Math.sin(t * 20) });

      let fy;
      let rot;
      if (cycle < 0.55) {
        frozenX = rx - 190 * s;
        fy = floorY - 260 * s + Math.sin(t * 5) * 10;
        rot = -28;
      } else if (cycle < 0.62) {
        const k = easeIn(seg(cycle, 0.55, 0.62));
        fy = floorY - 260 * s + k * (260 * s - 18 * s);
        rot = -28 + 28 * k;
      } else if (cycle < 0.82) {
        fy = floorY - 18 * s;
        rot = 0;
      } else {
        const k = easeOut(seg(cycle, 0.82, 1));
        fy = floorY - 18 * s - k * 242 * s;
        rot = -28 * k;
        frozenX += (rx - 190 * s - frozenX) * 0.15;
      }
      const shake = cycle >= 0.62 && cycle < 0.68 ? Math.sin(t * 90) * 6 : 0;
      world.setAttribute("transform", `translate(${shake} 0)`);
      ff.setAttribute("transform", `translate(${frozenX} ${fy}) rotate(${rot}) scale(${s})`);
      puff.g.setAttribute("transform", `translate(${frozenX} ${floorY}) scale(${s})`);
      puff.update(cycle >= 0.62 ? seg(cycle, 0.62, 0.8) : 0);
    });
    return { destroy: stop };
  },
};

// --- 2. The escape into the mouse hole ------------------------------------------
const hole = {
  id: "hole",
  name: "החור בקיר",
  create(svg) {
    const { w, h, floorY, s } = sceneBase(svg, { floorRatio: 0.7, wall: true });
    title(svg, w, h * 0.2, clamp(w * 0.12, 34, 84));
    const holeX = w * 0.82;
    el("path", { d: `M${holeX - 55 * s} ${floorY} L${holeX - 55 * s} ${floorY - 45 * s} Q${holeX} ${floorY - 110 * s} ${holeX + 55 * s} ${floorY - 45 * s} L${holeX + 55 * s} ${floorY}Z`, fill: "#1a0d05", stroke: "#6b4520", "stroke-width": 5 }, svg);
    const shadow = el("ellipse", { cy: floorY + 4, rx: 10, ry: 4, fill: "rgba(0,0,0,.35)" }, svg);
    const world = el("g", {}, svg);
    const roach = cartoonRoach(world);
    const alarm = el("text", { "font-size": 64, "font-weight": 900, fill: "#e8262c", stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "text-anchor": "middle" }, world);
    alarm.textContent = "!";
    const notes = el("text", { "font-size": 30, fill: "#5a2a10", "text-anchor": "middle" }, world);
    notes.textContent = "♪ ♫";
    const shoe = sneaker(world);
    const puff = dust(world);
    const antennae = el("path", { fill: "none", stroke: "#3a1a08", "stroke-width": 5, "stroke-linecap": "round" }, svg);
    const bye = bubble(svg, "ביי!");
    tapHint(svg, w, h);
    const P = 5.4;
    const startX = w * 0.12;
    const stopX = w * 0.5;
    const stop = loop((t) => {
      const u = t % P;
      let rx;
      let run = 0.3;
      let panic = 0;
      let visible = 1;
      let scale = s;
      if (u < 2.2) {
        rx = startX + (stopX - startX) * (u / 2.2);
      } else if (u < 2.8) {
        rx = stopX;
        run = 0;
        panic = 1;
      } else if (u < 3.25) {
        const k = easeIn(seg(u, 2.8, 3.25));
        rx = stopX + (holeX - stopX) * k;
        run = 1;
        panic = 1;
        scale = s * (1 - 0.5 * seg(u, 3.1, 3.25));
        visible = 1 - seg(u, 3.12, 3.25);
      } else {
        rx = holeX;
        visible = 0;
      }
      roach.g.setAttribute("transform", `translate(${rx} ${floorY - 52 * scale}) scale(${scale})`);
      roach.g.setAttribute("opacity", visible);
      roach.update(t, { run, panic, look: u > 2.2 && u < 2.8 ? 0 : 1, mouthOpen: panic });
      alarm.setAttribute("opacity", u > 2.25 && u < 2.9 ? 1 : 0);
      alarm.setAttribute("transform", `translate(${stopX + 60 * s} ${floorY - 150 * s})`);
      notes.setAttribute("opacity", u < 2.1 ? 1 : 0);
      notes.setAttribute("transform", `translate(${rx + 70 * s} ${floorY - 130 * s - Math.sin(t * 4) * 8})`);

      // Shoe shadow grows, then the shoe slams on the empty spot.
      const grow = seg(u, 2.2, 3.3);
      shadow.setAttribute("cx", stopX);
      shadow.setAttribute("rx", 30 * s + grow * 140 * s);
      shadow.setAttribute("ry", 6 * s + grow * 14 * s);
      shadow.setAttribute("opacity", u < 2.2 || u > 4.6 ? 0 : 1);
      let sy;
      if (u < 3.2) sy = -400;
      else if (u < 3.4) sy = -400 + easeIn(seg(u, 3.2, 3.4)) * (400 + floorY - 18 * s);
      else if (u < 4.3) sy = floorY - 18 * s;
      else sy = floorY - 18 * s - easeOut(seg(u, 4.3, 4.8)) * (floorY + 300);
      shoe.setAttribute("transform", `translate(${stopX} ${sy}) scale(${s})`);
      puff.g.setAttribute("transform", `translate(${stopX} ${floorY}) scale(${s})`);
      puff.update(u >= 3.4 ? seg(u, 3.4, 3.8) : 0);
      const shake = u >= 3.4 && u < 3.5 ? Math.sin(t * 90) * 7 : 0;
      world.setAttribute("transform", `translate(${shake} 0)`);

      // Antennae waving bye from the hole.
      const show = u > 3.6 && u < 5.2;
      const wv = Math.sin(t * 8) * 18 * s;
      antennae.setAttribute("opacity", show ? 1 : 0);
      antennae.setAttribute("d", `M${holeX - 10 * s} ${floorY - 40 * s} Q${holeX - 40 * s + wv} ${floorY - 110 * s} ${holeX - 80 * s + wv} ${floorY - 120 * s} M${holeX + 10 * s} ${floorY - 40 * s} Q${holeX + 20 * s - wv} ${floorY - 120 * s} ${holeX - 20 * s - wv} ${floorY - 140 * s}`);
      bye.setAttribute("opacity", u > 3.9 && u < 5.1 ? 1 : 0);
      bye.setAttribute("transform", `translate(${holeX - 70 * s} ${floorY - 170 * s}) scale(${s})`);
    });
    return { destroy: stop };
  },
};

// --- 3. Dodging the falling title ----------------------------------------------
const titleDrop = {
  id: "title",
  name: "הכותרת",
  create(svg) {
    const { w, h, floorY, s } = sceneBase(svg, { floorRatio: 0.66 });
    let size = clamp(w * 0.15, 40, 110);
    const words = ["מחץ", "את", "הג'וק"].map((txt) => {
      const t = el("text", { "font-size": size, class: "title", "text-anchor": "middle" }, svg);
      t.textContent = txt;
      return t;
    });
    // Lay out right-to-left with measured widths, shrinking to fit narrow screens.
    const measure = () => words.map((t) => t.getComputedTextLength() || size * txtLen(t));
    let widths = measure();
    let total = widths.reduce((a, b) => a + b, 0) + size * 0.6;
    if (total > w * 0.84) {
      size *= (w * 0.84) / total;
      words.forEach((t) => t.setAttribute("font-size", size));
      widths = measure();
      total = widths.reduce((a, b) => a + b, 0) + size * 0.6;
    }
    const gap = size * 0.3;
    let cursor = w / 2 + total / 2;
    const centers = widths.map((wd) => {
      const c = cursor - wd / 2;
      cursor -= wd + gap;
      return c;
    });
    const leftEdge = centers[2] - widths[2] / 2;
    const world = el("g", {}, svg);
    const roach = cartoonRoach(world);
    const scream = el("text", { "font-size": 34, "font-weight": 900, fill: "#fff", "text-anchor": "middle" }, world);
    scream.textContent = "אאאא!";
    tapHint(svg, w, h);
    const P = 6.8;
    const spots = [...centers, leftEdge - 120 * s];
    const landY = floorY;
    const stop = loop((t) => {
      const u = t % P;
      // Words fall at 0.9, 1.9, 2.9.
      words.forEach((word, i) => {
        const tf = 0.9 + i;
        let y;
        if (u > 6.3) y = landY;
        else if (u < tf - 0.35) y = -size;
        else if (u < tf) y = -size + easeIn(seg(u, tf - 0.35, tf)) * (landY + size);
        else y = landY - Math.sin(seg(u, tf, tf + 0.25) * Math.PI) * 18;
        word.setAttribute("x", centers[i]);
        word.setAttribute("y", y);
        const sq = u >= tf && u < tf + 0.12 ? 0.8 : 1;
        word.setAttribute("transform", `translate(${centers[i]} ${landY}) scale(1 ${sq}) translate(${-centers[i]} ${-landY})`);
        word.setAttribute("opacity", u > 6.3 ? 1 - seg(u, 6.3, 6.8) : 1);
      });
      let x;
      let y = floorY;
      let rot = 0;
      let run = 1;
      let flail = 0;
      let look = -1;
      if (u < 0.6) {
        x = w + 120 * s + (spots[0] - w - 120 * s) * easeOut(seg(u, 0, 0.6));
      } else if (u < 3.25) {
        const i = Math.min(2, Math.floor(u - 0.6 + 0.07));
        const k = seg(u, 0.75 + i, 1.15 + i);
        x = spots[i] + (spots[i + 1] - spots[i]) * k;
        y = floorY - Math.sin(k * Math.PI) * 120 * s;
        run = k > 0 && k < 1 ? 1 : 0.4;
        look = 0;
      } else if (u < 3.8) {
        // Jump up onto the last word.
        const k = seg(u, 3.25, 3.8);
        x = spots[3] + (leftEdge + 30 * s - spots[3]) * k;
        y = floorY - (size * 0.75) * k - Math.sin(k * Math.PI) * 80 * s;
      } else if (u < 4.6) {
        x = leftEdge + 30 * s;
        y = floorY - size * 0.75;
        rot = Math.sin(u * 14) * 18 * seg(u, 3.8, 4.6);
        run = 0.3;
        look = 1;
      } else if (u < 5.3) {
        x = leftEdge + 10 * s;
        y = floorY - size * 0.75 + 40 * s;
        rot = 75;
        flail = 1;
        run = 1;
      } else {
        const k = seg(u, 5.3, 6.1);
        x = leftEdge;
        y = floorY - size * 0.75 + 40 * s + easeIn(k) * (h + 200);
        rot = 75 + k * 200;
        flail = 1;
      }
      // This roach travels right-to-left, so mirror it.
      roach.g.setAttribute("transform", `translate(${x} ${y - 52 * s}) rotate(${-rot}) scale(${-s} ${s})`);
      roach.update(t, { run, panic: 1, look, mouthOpen: u > 4.6 ? 1 : 0.5, flail });
      scream.setAttribute("opacity", u > 5.2 && u < 6.1 ? 1 : 0);
      scream.setAttribute("transform", `translate(${leftEdge - 70 * s} ${floorY - size})`);
    });
    return { destroy: stop };
  },
};

function txtLen(t) {
  return t.textContent.length * 0.6;
}

export const SPLASHES = [slipper, hole, titleDrop];
