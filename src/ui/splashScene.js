// Cartoon splash scene: a panicking roach flees a giant flip-flop across a
// kitchen floor. Pure SVG + requestAnimationFrame; no external images.

const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const elastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.cos(t * Math.PI * 4.5) * Math.exp(-t * 6));

function gradient(defs, id, type, stops, attrs = {}) {
  const g = el(type === "radial" ? "radialGradient" : "linearGradient", { id, ...attrs }, defs);
  for (const [offset, color, opacity = 1] of stops) el("stop", { offset, "stop-color": color, "stop-opacity": opacity }, g);
  return g;
}

function buildDefs(svg) {
  const d = el("defs", {}, svg);
  // Set
  gradient(d, "sp-wall", "linear", [[0, "#fff4dc"], [1, "#f1d9ad"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-tile-gloss", "linear", [[0, "#ffffff", 0.55], [0.5, "#ffffff", 0], [1, "#c9a876", 0.25]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-wood", "linear", [[0, "#c98a4b"], [0.25, "#a8692f"], [1, "#6e3f17"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-floor-shade", "linear", [[0, "#3b2410", 0.35], [0.35, "#3b2410", 0], [1, "#1a0e05", 0.25]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-floor-shine", "radial", [[0, "#ffffff", 0.45], [1, "#ffffff", 0]]);
  gradient(d, "sp-light", "radial", [[0, "#fff1c9", 0.55], [0.6, "#ffd28a", 0.12], [1, "#ffd28a", 0]], { cx: 0.5, cy: 0, r: 0.9 });
  gradient(d, "sp-vignette", "radial", [[0.55, "#000", 0], [1, "#120700", 0.65]], { cx: 0.5, cy: 0.45, r: 0.75 });
  gradient(d, "sp-steel", "linear", [[0, "#8d969e"], [0.18, "#e9eef2"], [0.45, "#c3cbd2"], [0.8, "#f4f7f9"], [1, "#7d868e"]], { x1: 0, y1: 0, x2: 1, y2: 0 });
  gradient(d, "sp-shadow", "radial", [[0, "#000", 0.45], [1, "#000", 0]]);
  // Roach
  gradient(d, "sp-body", "radial", [[0, "#f0a35c"], [0.45, "#b85a1f"], [1, "#4a1a06"]], { cx: 0.42, cy: 0.28, r: 0.8 });
  gradient(d, "sp-wing", "linear", [[0, "#e7924b"], [0.5, "#a24d18"], [1, "#5b230a"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-pronotum", "radial", [[0, "#ffd08a"], [0.55, "#b8641f"], [1, "#5a2408"]], { cx: 0.4, cy: 0.3, r: 0.8 });
  gradient(d, "sp-head", "radial", [[0, "#d98447"], [0.6, "#8f3f12"], [1, "#4a1a06"]], { cx: 0.35, cy: 0.3, r: 0.8 });
  gradient(d, "sp-eye", "radial", [[0, "#ffffff"], [0.75, "#f4f4fa"], [1, "#c9cbe0"]], { cx: 0.4, cy: 0.35, r: 0.7 });
  gradient(d, "sp-drop", "radial", [[0, "#ffffff"], [0.35, "#bfeaff"], [1, "#3fa6e0"]], { cx: 0.35, cy: 0.3, r: 0.8 });
  gradient(d, "sp-gloss", "linear", [[0, "#ffffff", 0.75], [1, "#ffffff", 0]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  // Flip-flop
  gradient(d, "sp-sole", "linear", [[0, "#4fb0ff"], [0.5, "#1f78d1"], [1, "#0f4a8a"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-footbed", "linear", [[0, "#ffe3ef"], [1, "#ff9cc4"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-strap", "linear", [[0, "#ff7ab6"], [0.5, "#e2207a"], [1, "#9c0f50"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  // Effects + logo
  gradient(d, "sp-boom", "radial", [[0, "#fffbe0"], [0.45, "#ffd23f"], [1, "#ff7a1a"]]);
  gradient(d, "sp-dust", "radial", [[0, "#fffaf0"], [0.7, "#e9dcc4"], [1, "#c9b796"]], { cx: 0.4, cy: 0.35 });
  gradient(d, "sp-logo", "linear", [[0, "#fff6b8"], [0.45, "#ffc247"], [1, "#f06a1c"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-logo-gloss", "linear", [[0, "#ffffff", 0.7], [0.5, "#ffffff", 0], [1, "#ffffff", 0]], { x1: 0, y1: 0, x2: 0, y2: 1 });
  gradient(d, "sp-pill", "linear", [[0, "#ffd36b"], [1, "#f0701e"]], { x1: 0, y1: 0, x2: 0, y2: 1 });
}

// --- Set ------------------------------------------------------------------------
function buildSet(svg, w, h, floorTop) {
  const set = el("g", {}, svg);
  el("rect", { width: w, height: floorTop, fill: "url(#sp-wall)" }, set);

  // Glossy subway tiles on the wall.
  const tileH = clamp(h * 0.045, 22, 40);
  const tileW = tileH * 2;
  const wallTiles = el("g", {}, set);
  for (let y = 0, row = 0; y < floorTop - tileH * 0.5; y += tileH, row++) {
    for (let x = row % 2 ? -tileW / 2 : 0; x < w; x += tileW) {
      el("rect", { x: x + 1.5, y: y + 1.5, width: tileW - 3, height: tileH - 3, rx: 4, fill: "#fff8ea", stroke: "#e2cba2", "stroke-width": 1.5 }, wallTiles);
      el("rect", { x: x + 4, y: y + 3, width: tileW - 8, height: (tileH - 6) * 0.45, rx: 3, fill: "url(#sp-tile-gloss)" }, wallTiles);
    }
  }

  // Wooden baseboard.
  const bbH = clamp(h * 0.035, 16, 30);
  el("rect", { x: 0, y: floorTop - bbH, width: w, height: bbH, fill: "url(#sp-wood)" }, set);
  for (let i = 0; i < 5; i++) {
    const y = floorTop - bbH + bbH * (0.25 + i * 0.15);
    el("path", { d: `M0 ${y} Q${w * 0.3} ${y - 2} ${w * 0.6} ${y + 1.5} T${w} ${y}`, fill: "none", stroke: "#5a2f10", "stroke-opacity": 0.25, "stroke-width": 1 }, set);
  }
  el("rect", { x: 0, y: floorTop - bbH, width: w, height: 3, fill: "#f2c088" }, set);

  // Perspective floor tiles converging to a vanishing point.
  const floor = el("g", {}, set);
  const vp = { x: w / 2, y: floorTop - (h - floorTop) * 1.4 };
  const rows = 9;
  const ys = Array.from({ length: rows + 1 }, (_, k) => floorTop + (h - floorTop) * (k / rows) ** 1.55);
  const bottomTile = clamp(w / 5, 70, 160);
  const cols = Math.ceil(w / bottomTile) * 3 + 6;
  const xAt = (i, y) => {
    const xb = w / 2 + (i - cols / 2) * bottomTile;
    return vp.x + (xb - vp.x) * ((y - vp.y) / (h - vp.y));
  };
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const y0 = ys[r];
      const y1 = ys[r + 1];
      const pts = [[xAt(i, y0), y0], [xAt(i + 1, y0), y0], [xAt(i + 1, y1), y1], [xAt(i, y1), y1]];
      if (pts[1][0] < -50 || pts[0][0] > w + 50) continue;
      const light = (i + r) % 2 === 0;
      el("polygon", { points: pts.map((p) => p.join(",")).join(" "), fill: light ? "#efe2c8" : "#dccaa6", stroke: "#b49d76", "stroke-width": 1.5 }, floor);
    }
  }
  el("rect", { x: 0, y: floorTop, width: w, height: h - floorTop, fill: "url(#sp-floor-shade)" }, set);
  el("ellipse", { cx: w / 2, cy: floorTop + (h - floorTop) * 0.35, rx: w * 0.45, ry: (h - floorTop) * 0.22, fill: "url(#sp-floor-shine)" }, set);

  // Props (parallax layer): fridge on the left, cabinet on the right, crumbs.
  const props = el("g", {}, set);
  const fw = clamp(w * 0.2, 70, 180);
  el("rect", { x: -fw * 0.35, y: -20, width: fw, height: floorTop + h * 0.03, rx: 16, fill: "url(#sp-steel)", stroke: "#6f777e", "stroke-width": 2 }, props);
  el("rect", { x: fw * 0.45, y: floorTop * 0.25, width: 8, height: floorTop * 0.35, rx: 4, fill: "#5d656c" }, props);
  el("rect", { x: -fw * 0.3, y: floorTop + h * 0.02, width: fw * 0.2, height: 10, rx: 3, fill: "#333" }, props);
  el("rect", { x: fw * 0.3, y: floorTop + h * 0.02, width: fw * 0.2, height: 10, rx: 3, fill: "#333" }, props);
  const cw = clamp(w * 0.24, 80, 220);
  el("rect", { x: w - cw * 0.7, y: floorTop - h * 0.28, width: cw, height: h * 0.28 + h * 0.02, rx: 8, fill: "#c98a4b", stroke: "#6e3f17", "stroke-width": 3 }, props);
  el("rect", { x: w - cw * 0.62, y: floorTop - h * 0.25, width: cw * 0.8, height: h * 0.22, rx: 6, fill: "none", stroke: "#8a5222", "stroke-width": 3 }, props);
  el("rect", { x: w - cw * 0.6, y: floorTop - h * 0.17, width: 6, height: h * 0.06, rx: 3, fill: "#e8e2d6", stroke: "#8a8070" }, props);
  for (let i = 0; i < 9; i++) {
    const x = (i * 137) % w;
    const y = floorTop + (h - floorTop) * (0.15 + ((i * 53) % 70) / 100);
    el("ellipse", { cx: x, cy: y, rx: 3 + (i % 3), ry: 2, fill: "#b07a3a", stroke: "#6e4518", "stroke-width": 0.8 }, props);
  }

  // Warm overhead light.
  el("rect", { width: w, height: h, fill: "url(#sp-light)" }, svg);
  return { props };
}

// --- Cartoon roach ------------------------------------------------------------------
function buildRoach(parent) {
  const root = el("g", {}, parent);
  const shadow = el("ellipse", { cx: 0, cy: 60, rx: 74, ry: 10, fill: "url(#sp-shadow)" }, root);
  const body = el("g", {}, root); // squash & stretch pivot at the feet
  const inner = el("g", { transform: "translate(0 -60)" }, body);
  const OUT = "#2a1003";

  const legStroke = (color, wdt) => ({ fill: "none", stroke: color, "stroke-width": wdt, "stroke-linecap": "round", "stroke-linejoin": "round" });
  const blurRing = el("ellipse", { cx: -10, cy: 50, rx: 52, ry: 14, fill: "none", stroke: "#4a1e08", "stroke-width": 6, "stroke-opacity": 0, "stroke-dasharray": "10 8" }, inner);
  const farLegs = [0, 1, 2].map(() => el("path", legStroke("#3a1606", 6), inner));
  const farAntenna = el("path", { ...legStroke("#3a1606", 4) }, inner);

  // Abdomen + segments.
  el("ellipse", { cx: -14, cy: 8, rx: 64, ry: 31, fill: "url(#sp-body)", stroke: OUT, "stroke-width": 4.5 }, inner);
  el("path", { d: "M-66 18 Q-58 34 -40 37 M-42 22 Q-34 37 -16 39 M-18 24 Q-10 38 8 38 M6 24 Q12 35 26 33", ...legStroke("#3d1505", 2.5), "stroke-opacity": 0.55 }, inner);
  // Wings with seam, gloss and rim light.
  el("path", { d: "M44 -10 C14 -44 -62 -40 -84 0 C-74 14 -24 10 44 2 Z", fill: "url(#sp-wing)", stroke: OUT, "stroke-width": 4.5, "stroke-linejoin": "round" }, inner);
  el("path", { d: "M40 -4 C0 -10 -46 -8 -80 -1", ...legStroke(OUT, 2.5), "stroke-opacity": 0.7 }, inner);
  el("path", { d: "M30 -24 C0 -38 -40 -34 -62 -18 C-40 -26 -4 -28 30 -18 Z", fill: "url(#sp-gloss)" }, inner);
  el("path", { d: "M-82 2 C-70 12 -30 9 30 4", ...legStroke("#ffb06a", 2.5), "stroke-opacity": 0.6 }, inner);
  // Pronotum shield.
  el("ellipse", { cx: 46, cy: -4, rx: 23, ry: 26, transform: "rotate(-14 46 -4)", fill: "url(#sp-pronotum)", stroke: OUT, "stroke-width": 4.5 }, inner);
  el("ellipse", { cx: 46, cy: -4, rx: 16, ry: 19, transform: "rotate(-14 46 -4)", fill: "none", stroke: "#ffd69a", "stroke-width": 2.5, "stroke-opacity": 0.75 }, inner);
  el("ellipse", { cx: 40, cy: -16, rx: 8, ry: 4, transform: "rotate(-30 40 -16)", fill: "#fff", "fill-opacity": 0.6 }, inner);

  // Head and face.
  const head = el("g", {}, inner);
  el("circle", { cx: 66, cy: 10, r: 24, fill: "url(#sp-head)", stroke: OUT, "stroke-width": 4.5 }, head);
  el("ellipse", { cx: 78, cy: 22, rx: 7, ry: 4, fill: "#ff6b6b", "fill-opacity": 0.35 }, head);
  const eyes = [
    { cx: 68, cy: -7, rx: 12, ry: 15 },
    { cx: 85, cy: -4, rx: 11, ry: 14 },
  ].map((e) => {
    const g = el("g", {}, head);
    el("ellipse", { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry, fill: "url(#sp-eye)", stroke: OUT, "stroke-width": 3.5 }, g);
    const pupil = el("g", {}, g);
    el("circle", { cx: 0, cy: 0, r: 6.5, fill: "#14080a" }, pupil);
    el("circle", { cx: -2, cy: -2.5, r: 2.2, fill: "#fff" }, pupil);
    el("circle", { cx: 2, cy: 2.5, r: 1, fill: "#fff", "fill-opacity": 0.8 }, pupil);
    return { ...e, g, pupil };
  });
  const brows = el("path", { ...legStroke(OUT, 4.5) }, head);
  const mouth = el("g", {}, head);
  const mouthShape = el("path", { fill: "#5a0b14", stroke: OUT, "stroke-width": 3 }, mouth);
  const tongue = el("ellipse", { fill: "#ff6f8e" }, mouth);
  const teeth = el("rect", { fill: "#fff", rx: 1.5 }, mouth);

  const nearAntenna = el("path", { ...legStroke("#3a1606", 4.5) }, inner);
  const antennaBeads = [0, 1, 2, 3].map(() => el("circle", { r: 2.4, fill: "#3a1606" }, inner));
  const nearLegs = [0, 1, 2].map(() => el("path", legStroke(OUT, 9), inner));
  const nearLegFill = nearLegs.map(() => el("path", legStroke("#7a3410", 5), inner));
  const knees = [0, 1, 2].map(() => el("circle", { r: 4.5, fill: "#8f3f12", stroke: OUT, "stroke-width": 2.5 }, inner));

  const drops = [0, 1, 2].map(() => {
    const g = el("g", {}, inner);
    el("path", { d: "M0 -9 Q8 2 0 8 Q-8 2 0 -9Z", fill: "url(#sp-drop)", stroke: "#1f6ea0", "stroke-width": 1.5 }, g);
    return g;
  });

  const legPath = (hx, a, len = 1) => {
    const kx = hx + Math.sin(a) * 20 * len;
    const ky = 30 + Math.cos(a) * 16;
    const fx = kx + Math.sin(a + 0.7) * 12;
    return { d: `M${hx} 28 L${kx} ${ky} L${fx} 58 l${8} 0`, kx, ky };
  };

  return {
    root,
    shadow,
    update(t, { run = 1, panic = 1, look = -1, scream = 1, squash = 0, pop = 0 }) {
      const phase = t * (8 + run * 26);
      [-34, -8, 18].forEach((hx, i) => {
        const sw = 0.3 + 0.7 * run;
        const near = legPath(hx, Math.sin(phase + i * 2.1) * sw);
        const far = legPath(hx - 9, Math.sin(phase + i * 2.1 + Math.PI) * sw);
        nearLegs[i].setAttribute("d", near.d);
        nearLegFill[i].setAttribute("d", near.d);
        knees[i].setAttribute("cx", near.kx);
        knees[i].setAttribute("cy", near.ky);
        farLegs[i].setAttribute("d", far.d);
      });
      blurRing.setAttribute("stroke-opacity", clamp(run - 0.6, 0, 0.4) * 0.6);
      blurRing.setAttribute("stroke-dashoffset", -phase * 6);

      // Segmented, whipping antennae.
      const wv = Math.sin(t * 10) * 10 * (0.5 + panic);
      const ax = (k) => `M74 -18 Q${50 + wv * k} -100 ${-30 + wv * k} -92`;
      farAntenna.setAttribute("d", `M82 -16 Q${70 - wv} -108 ${0 - wv} -110`);
      nearAntenna.setAttribute("d", ax(1));
      antennaBeads.forEach((b, i) => {
        const u = (i + 1) / 5;
        // Point on the quadratic curve.
        const p0 = [74, -18];
        const p1 = [50 + wv, -100];
        const p2 = [-30 + wv, -92];
        const x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0];
        const y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1];
        b.setAttribute("cx", x);
        b.setAttribute("cy", y);
      });

      // Eyes: pupils glance back in panic; pop out on impact.
      eyes.forEach((e) => {
        const s = 1 + pop * 0.45;
        e.g.setAttribute("transform", `translate(${e.cx} ${e.cy}) scale(${s}) translate(${-e.cx} ${-e.cy})`);
        e.pupil.setAttribute("transform", `translate(${e.cx + look * 4.5} ${e.cy - 1 + Math.sin(t * 17) * panic})`);
      });
      const lift = 4 + panic * 4;
      brows.setAttribute("d", `M56 ${-22 - lift} Q66 ${-30 - lift} 76 ${-24 - lift * 0.4} M78 ${-20 - lift * 0.4} Q88 ${-28 - lift} 96 ${-20 - lift}`);
      const mh = 4 + 10 * scream;
      mouthShape.setAttribute("d", `M74 18 Q86 14 95 17 Q93 ${18 + mh} 84 ${19 + mh} Q76 ${18 + mh} 74 18 Z`);
      tongue.setAttribute("cx", 85);
      tongue.setAttribute("cy", 17 + mh * 0.8);
      tongue.setAttribute("rx", 6);
      tongue.setAttribute("ry", Math.max(1, mh * 0.3));
      teeth.setAttribute("x", 78);
      teeth.setAttribute("y", 17);
      teeth.setAttribute("width", 13);
      teeth.setAttribute("height", Math.min(4, mh * 0.35));

      drops.forEach((d, i) => {
        const u = (t * 1.7 + i / 3) % 1;
        d.setAttribute("transform", `translate(${54 - u * 80} ${-40 - u * 34 - i * 8}) scale(${0.7 + u * 0.5}) rotate(${-30 - u * 40})`);
        d.setAttribute("opacity", panic * (1 - u));
      });

      // Squash & stretch around the feet plus a running bob.
      const bob = Math.abs(Math.sin(phase)) * 5 * run;
      const sx = 1 + 0.06 * run - squash * 0.18;
      const sy = 1 - 0.05 * run + squash * 0.22;
      body.setAttribute("transform", `translate(0 ${-bob}) scale(${sx} ${sy})`);
    },
  };
}

// --- Flip-flop ----------------------------------------------------------------------
function buildFlipFlop(parent) {
  const g = el("g", {}, parent);
  const make = (opacity) => {
    const f = el("g", { opacity }, g);
    // Side of the sole with tread.
    el("path", { d: "M-160 -6 Q-172 -26 -138 -32 L120 -30 Q170 -26 164 -2 Q160 22 116 22 L-130 20 Q-164 20 -160 -6 Z", fill: "url(#sp-sole)", stroke: "#0a2f5a", "stroke-width": 5, "stroke-linejoin": "round" }, f);
    for (let x = -140; x < 140; x += 16) el("line", { x1: x, y1: 8, x2: x + 4, y2: 20, stroke: "#0a2f5a", "stroke-width": 3, "stroke-opacity": 0.45 }, f);
    // Footbed with a foot imprint.
    el("path", { d: "M-150 -24 Q-160 -40 -126 -44 L118 -42 Q160 -38 154 -22 L120 -26 L-128 -26 Z", fill: "url(#sp-footbed)", stroke: "#b5427a", "stroke-width": 3 }, f);
    el("ellipse", { cx: 70, cy: -34, rx: 46, ry: 4, fill: "#e06aa0", "fill-opacity": 0.35 }, f);
    el("ellipse", { cx: -70, cy: -34, rx: 40, ry: 4, fill: "#e06aa0", "fill-opacity": 0.35 }, f);
    // Y-strap with gloss.
    const strap = "M84 -40 Q34 -118 -36 -40 M84 -40 Q60 -112 6 -40";
    el("path", { d: strap, fill: "none", stroke: "#6b0835", "stroke-width": 20, "stroke-linecap": "round" }, f);
    el("path", { d: strap, fill: "none", stroke: "url(#sp-strap)", "stroke-width": 14, "stroke-linecap": "round" }, f);
    el("path", { d: "M74 -56 Q40 -106 -10 -60", fill: "none", stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 4, "stroke-linecap": "round" }, f);
    el("circle", { cx: 84, cy: -40, r: 9, fill: "#ffd2e6", stroke: "#6b0835", "stroke-width": 3 }, f);
    return f;
  };
  const ghosts = [make(0), make(0)];
  const main = make(1);
  return { g, main, ghosts };
}

// --- Effects ------------------------------------------------------------------------
function buildImpact(parent) {
  const g = el("g", { opacity: 0 }, parent);
  const cracks = el("path", { fill: "none", stroke: "#4a3418", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
  cracks.setAttribute("d", "M-20 4 L-60 10 L-82 2 L-120 12 M10 4 L48 12 L66 6 L104 16 M-6 6 L-14 26 L-4 40");
  const puffs = Array.from({ length: 7 }, (_, i) => ({ dir: (i / 6) * 2 - 1, c: el("circle", { fill: "url(#sp-dust)", stroke: "#b8a480", "stroke-width": 2 }, g) }));
  const boom = el("g", {}, g);
  const spikes = 14;
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 ? 46 : 84 + (i % 4) * 8;
    pts.push(`${Math.cos(a) * r},${Math.sin(a) * r * 0.75}`);
  }
  el("polygon", { points: pts.join(" "), fill: "url(#sp-boom)", stroke: "#8a2a05", "stroke-width": 5, "stroke-linejoin": "round" }, boom);
  const word = el("text", { "text-anchor": "middle", y: 14, "font-size": 40, "font-weight": 900, fill: "#fff", stroke: "#8a2a05", "stroke-width": 8, "paint-order": "stroke" }, boom);
  word.textContent = "טראח!";
  return {
    g,
    update(u) {
      g.setAttribute("opacity", u <= 0 || u >= 1 ? 0 : 1);
      if (u <= 0 || u >= 1) return;
      cracks.setAttribute("opacity", 1 - u);
      for (const p of puffs) {
        // Puffs burst out from under both ends of the sole.
        const side = p.dir < 0 ? -1 : 1;
        p.c.setAttribute("cx", side * (150 + Math.abs(p.dir) * easeOut(u) * 120));
        p.c.setAttribute("cy", 6 - (1 - Math.abs(p.dir)) * easeOut(u) * 50 - easeOut(u) * 14);
        p.c.setAttribute("r", 8 + easeOut(u) * (14 + Math.abs(p.dir) * 12));
        p.c.setAttribute("opacity", 1 - u);
      }
      const k = u < 0.15 ? elastic(u / 0.15) * 1.15 : u < 0.55 ? 1 : 1 - seg(u, 0.55, 0.75);
      boom.setAttribute("transform", `translate(0 -185) rotate(${-8 + u * 10}) scale(${Math.max(0.001, k)})`);
    },
  };
}

function buildTrail(parent) {
  const puffs = Array.from({ length: 10 }, () => el("circle", { r: 0, fill: "url(#sp-dust)", opacity: 0 }, parent));
  let next = 0;
  const live = puffs.map(() => ({ age: 9, x: 0, y: 0 }));
  return {
    emit(x, y) {
      Object.assign(live[next], { age: 0, x, y });
      next = (next + 1) % puffs.length;
    },
    update(dt) {
      live.forEach((p, i) => {
        p.age += dt;
        const u = clamp(p.age / 0.6, 0, 1);
        puffs[i].setAttribute("cx", p.x - u * 20);
        puffs[i].setAttribute("cy", p.y - u * 14);
        puffs[i].setAttribute("r", 4 + u * 12);
        puffs[i].setAttribute("opacity", (1 - u) * 0.8);
      });
    },
  };
}

function buildLogo(svg, w, h) {
  const size = Math.min(w * 0.125, h * 0.095, 100);
  const g = el("g", {}, svg);
  el("ellipse", { cx: 0, cy: size * 0.42, rx: size * 3, ry: size * 0.18, fill: "#000", "fill-opacity": 0.18 }, g);
  const text = (attrs) => {
    const t = el("text", { "text-anchor": "middle", "font-size": size, "font-weight": 900, ...attrs }, g);
    t.textContent = "מחץ את הג'וק";
    return t;
  };
  for (let i = 6; i >= 1; i--) text({ y: i * size * 0.022, fill: "#7a2e0c", stroke: "#3a1405", "stroke-width": size * 0.16, "stroke-linejoin": "round" });
  text({ fill: "url(#sp-logo)", stroke: "#3a1405", "stroke-width": size * 0.12, "stroke-linejoin": "round", "paint-order": "stroke" });
  text({ fill: "url(#sp-logo-gloss)" });
  return { g, size };
}

function buildTapPill(svg, w, h) {
  const g = el("g", {}, svg);
  const pw = clamp(w * 0.62, 220, 320);
  const ph = 52;
  el("rect", { x: -pw / 2, y: -ph / 2 + 5, width: pw, height: ph, rx: ph / 2, fill: "#7a2e0c" }, g);
  el("rect", { x: -pw / 2, y: -ph / 2, width: pw, height: ph, rx: ph / 2, fill: "url(#sp-pill)", stroke: "#3a1405", "stroke-width": 3 }, g);
  el("rect", { x: -pw / 2 + 12, y: -ph / 2 + 5, width: pw - 24, height: ph * 0.35, rx: ph * 0.18, fill: "#fff", "fill-opacity": 0.35 }, g);
  const t = el("text", { "text-anchor": "middle", y: 8, "font-size": 22, "font-weight": 800, fill: "#3a1405" }, g);
  t.textContent = "לחצו כדי להתחיל ▶";
  g.setAttribute("transform", `translate(${w / 2} ${h - 56})`);
  return g;
}

/** Builds the scene into `svg` and starts animating. Returns { destroy }. */
export function createSplashScene(svg) {
  svg.innerHTML = "";
  const w = svg.clientWidth || innerWidth;
  const h = svg.clientHeight || innerHeight;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  buildDefs(svg);

  const floorTop = h * (w > h ? 0.52 : 0.56);
  const laneY = floorTop + (h - floorTop) * 0.42;
  const s = clamp(Math.min(w, h) / 520, 0.6, 1.25);

  const world = el("g", {}, svg);
  const { props } = buildSet(world, w, h, floorTop);
  const ffShadow = el("ellipse", { fill: "url(#sp-shadow)" }, world);
  const trailLayer = el("g", {}, world);
  const trail = buildTrail(trailLayer);
  const speedLines = el("g", {}, world);
  const lines = [0, 1, 2].map((i) => el("line", { stroke: "#fff", "stroke-width": 4 - i, "stroke-linecap": "round", "stroke-opacity": 0.7 }, speedLines));
  const roach = buildRoach(world);
  const ff = buildFlipFlop(world);
  const impact = buildImpact(world);
  el("rect", { width: w, height: h, fill: "url(#sp-vignette)", "pointer-events": "none" }, svg);
  const logo = buildLogo(svg, w, h);
  const logoY = floorTop * (w > h ? 0.3 : 0.42);
  const logoBottom = logoY + logo.size * 0.5;
  const pill = buildTapPill(svg, w, h);

  const P = 4.2; // seconds per crossing; three slams per crossing
  let frozenX = 0;
  let last = 0;
  let trailTimer = 0;
  let id;
  const start = performance.now();

  const frame = (now) => {
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, t - last);
    last = t;

    const u = (t % P) / P;
    const rx = -170 * s + u * (w + 340 * s);
    const cycle = ((t * 3) / P) % 1;

    // Roach hop + squash at each impact.
    let hop = 0;
    let squash = 0;
    let pop = 0;
    if (cycle >= 0.6 && cycle < 0.72) {
      const k = seg(cycle, 0.6, 0.72);
      hop = Math.sin(k * Math.PI) * 70 * s;
      squash = k < 0.15 ? 1 - k / 0.15 : -Math.sin(k * Math.PI) * 0.6;
      pop = Math.sin(k * Math.PI);
    } else if (cycle >= 0.72 && cycle < 0.78) {
      squash = Math.sin(seg(cycle, 0.72, 0.78) * Math.PI) * 0.8;
    }
    roach.root.setAttribute("transform", `translate(${rx} ${laneY - hop}) scale(${s})`);
    roach.shadow.setAttribute("transform", `translate(0 ${hop / s}) scale(${1 - hop / (220 * s)})`);
    roach.update(t, { run: 1, panic: 1, look: -1, scream: 0.6 + 0.4 * Math.sin(t * 22), squash, pop });

    // Dust trail + speed lines behind the roach.
    trailTimer -= dt;
    if (trailTimer <= 0 && hop < 4) {
      trail.emit(rx - 60 * s, laneY - 2);
      trailTimer = 0.07;
    }
    trail.update(dt);
    lines.forEach((ln, i) => {
      const y = laneY - (30 + i * 22) * s - hop;
      const len = (60 + i * 25) * s;
      const x0 = rx - (100 + i * 12) * s;
      ln.setAttribute("x1", x0);
      ln.setAttribute("x2", x0 - len);
      ln.setAttribute("y1", y);
      ln.setAttribute("y2", y);
    });

    // Flip-flop: hover, drop (with motion ghosts), impact, lift.
    let fy;
    let rot;
    // Hover high, but stay clear of the logo on short (landscape) screens.
    const high = Math.max(laneY - 330 * s, logoBottom + 90 * s);
    const ground = laneY - 22 * s;
    if (cycle < 0.52) {
      frozenX = rx - 200 * s;
      fy = high + Math.sin(t * 5) * 12 * s;
      rot = -24 + Math.sin(t * 3) * 3;
    } else if (cycle < 0.6) {
      const k = easeIn(seg(cycle, 0.52, 0.6));
      fy = lerp(high, ground, k);
      rot = -24 * (1 - k);
    } else if (cycle < 0.8) {
      fy = ground;
      rot = 0;
    } else {
      const k = easeOut(seg(cycle, 0.8, 1));
      fy = lerp(ground, high, k);
      rot = -24 * k;
      frozenX += (rx - 200 * s - frozenX) * 0.12;
    }
    const falling = cycle >= 0.52 && cycle < 0.6;
    ff.main.setAttribute("transform", `translate(${frozenX} ${fy}) rotate(${rot}) scale(${s})`);
    ff.ghosts.forEach((gh, i) => {
      const back = (i + 1) * 45 * s;
      gh.setAttribute("opacity", falling ? 0.28 / (i + 1) : 0);
      gh.setAttribute("transform", `translate(${frozenX} ${fy - back}) rotate(${rot - (i + 1) * 4}) scale(${s})`);
    });
    const height = clamp((laneY - fy) / (laneY - high), 0, 1);
    ffShadow.setAttribute("cx", frozenX);
    ffShadow.setAttribute("cy", laneY + 8 * s);
    ffShadow.setAttribute("rx", lerp(170, 90, height) * s);
    ffShadow.setAttribute("ry", lerp(20, 12, height) * s);
    ffShadow.setAttribute("opacity", lerp(1, 0.35, height));

    impact.g.setAttribute("transform", `translate(${frozenX} ${laneY + 6 * s}) scale(${s})`);
    impact.update(cycle >= 0.6 ? seg(cycle, 0.6, 0.86) : 0);

    // Screen shake + parallax.
    const shake = cycle >= 0.6 && cycle < 0.67 ? Math.sin(t * 95) * 8 * (1 - seg(cycle, 0.6, 0.67)) : 0;
    world.setAttribute("transform", `translate(${shake} ${shake * 0.4})`);
    props.setAttribute("transform", `translate(${(w / 2 - rx) * 0.02} 0)`);

    // Logo: elastic entrance, wobble on every slam; pill pulses.
    const enter = elastic(clamp(t / 1.1, 0, 1));
    const wobble = cycle >= 0.6 && cycle < 0.85 ? Math.sin(seg(cycle, 0.6, 0.85) * Math.PI * 5) * 4 * (1 - seg(cycle, 0.6, 0.85)) : 0;
    logo.g.setAttribute("transform", `translate(${w / 2} ${logoY}) rotate(${wobble}) scale(${Math.max(0.001, enter)})`);
    const pulse = 1 + Math.sin(t * 4) * 0.04;
    pill.setAttribute("transform", `translate(${w / 2} ${h - 56}) scale(${pulse})`);

    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return { destroy: () => cancelAnimationFrame(id) };
}
