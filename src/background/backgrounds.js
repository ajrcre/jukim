// Strategy pattern: each background knows how to paint itself onto the
// background canvas. Camera/image backgrounds are handled by BackgroundManager.

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function speckle(ctx, w, h, rnd, count, colors, size = [0.5, 1.6]) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const s = size[0] + rnd() * (size[1] - size[0]);
    ctx.fillRect(rnd() * w, rnd() * h, s, s);
  }
}

function sheen(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const tiles = {
  id: "tiles",
  label: "אריחים",
  draw(ctx, w, h) {
    const rnd = seeded(7);
    const size = Math.max(90, Math.min(w, h) / 4.5);
    const grout = Math.max(3, size * 0.035);
    ctx.fillStyle = "#a59f93";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const v = Math.floor(rnd() * 14) - 7;
        ctx.fillStyle = `rgb(${226 + v},${218 + v},${200 + v})`;
        ctx.fillRect(x + grout / 2, y + grout / 2, size - grout, size - grout);
        const g = ctx.createRadialGradient(x + size * 0.3, y + size * 0.3, 0, x + size / 2, y + size / 2, size * 0.8);
        g.addColorStop(0, "rgba(255,255,255,0.18)");
        g.addColorStop(1, "rgba(120,100,70,0.08)");
        ctx.fillStyle = g;
        ctx.fillRect(x + grout / 2, y + grout / 2, size - grout, size - grout);
      }
    }
    speckle(ctx, w, h, rnd, (w * h) / 90, ["rgba(120,105,85,0.25)", "rgba(255,255,255,0.3)", "rgba(80,70,60,0.15)"]);
    sheen(ctx, w, h);
  },
};

const wood = {
  id: "wood",
  label: "פרקט",
  draw(ctx, w, h) {
    const rnd = seeded(11);
    const plankH = Math.max(34, Math.min(w, h) / 12);
    for (let y = 0, row = 0; y < h; y += plankH, row++) {
      let x = -rnd() * 300;
      while (x < w) {
        const len = 180 + rnd() * 260;
        const tone = 0.85 + rnd() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(160 * tone)},${Math.round(108 * tone)},${Math.round(62 * tone)})`;
        ctx.fillRect(x, y, len, plankH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, len, plankH);
        ctx.clip();
        for (let k = 0; k < 7; k++) {
          ctx.strokeStyle = `rgba(70,40,15,${0.08 + rnd() * 0.12})`;
          ctx.lineWidth = 0.6 + rnd() * 1.2;
          const yy = y + rnd() * plankH;
          const amp = 1 + rnd() * 3;
          const ph = rnd() * 10;
          ctx.beginPath();
          for (let xx = x; xx <= x + len; xx += 8) ctx.lineTo(xx, yy + Math.sin(xx / 40 + ph) * amp);
          ctx.stroke();
        }
        if (rnd() < 0.25) {
          ctx.fillStyle = "rgba(60,30,10,0.35)";
          ctx.beginPath();
          ctx.ellipse(x + rnd() * len, y + plankH / 2, 6 + rnd() * 6, 3 + rnd() * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = "rgba(40,20,5,0.6)";
        ctx.fillRect(x, y, 1.5, plankH);
        x += len;
      }
      ctx.fillStyle = "rgba(40,20,5,0.55)";
      ctx.fillRect(0, y, w, 1.5);
    }
    sheen(ctx, w, h);
  },
};

const terrazzo = {
  id: "terrazzo",
  label: "טראצו",
  draw(ctx, w, h) {
    const rnd = seeded(23);
    ctx.fillStyle = "#c9c4bb";
    ctx.fillRect(0, 0, w, h);
    const chips = ["#8a8378", "#e9e4da", "#6b6157", "#b59c7a", "#a3a8a6", "#5a5550"];
    const n = (w * h) / 260;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = chips[Math.floor(rnd() * chips.length)];
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 1 + rnd() * 5;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      for (let k = 1; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const rr = r * (0.6 + rnd() * 0.6);
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    }
    const size = Math.max(140, Math.min(w, h) / 3.5);
    ctx.strokeStyle = "rgba(90,85,78,0.35)";
    ctx.lineWidth = 1.5;
    for (let x = size; x < w; x += size) ctx.strokeRect(x, -1, 0, h + 2);
    for (let y = size; y < h; y += size) ctx.strokeRect(-1, y, w + 2, 0);
    sheen(ctx, w, h);
  },
};

const checker = {
  id: "checker",
  label: "מטבח שחמט",
  draw(ctx, w, h) {
    const rnd = seeded(5);
    const size = Math.max(70, Math.min(w, h) / 6);
    for (let y = 0, r = 0; y < h; y += size, r++) {
      for (let x = 0, c = 0; x < w; x += size, c++) {
        const v = Math.floor(rnd() * 10);
        ctx.fillStyle = (r + c) % 2 ? `rgb(${38 + v},${38 + v},${40 + v})` : `rgb(${232 - v},${230 - v},${224 - v})`;
        ctx.fillRect(x, y, size, size);
      }
    }
    speckle(ctx, w, h, rnd, (w * h) / 150, ["rgba(128,128,128,0.2)", "rgba(255,255,255,0.15)"]);
    sheen(ctx, w, h);
  },
};

const concrete = {
  id: "concrete",
  label: "בטון",
  draw(ctx, w, h) {
    const rnd = seeded(31);
    ctx.fillStyle = "#8d8b86";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * w;
      const y = rnd() * h;
      const r = 40 + rnd() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.5;
      g.addColorStop(0, dark ? "rgba(60,58,54,0.18)" : "rgba(200,198,190,0.15)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    speckle(ctx, w, h, rnd, (w * h) / 40, ["rgba(50,50,50,0.25)", "rgba(220,220,215,0.25)"], [0.5, 1.3]);
  },
};

export const BACKGROUNDS = [tiles, wood, terrazzo, checker, concrete];
export const DEFAULT_BACKGROUND = tiles.id;

/** Wraps a user-uploaded image, painted with object-fit: cover semantics. */
export function imageBackground(image) {
  return {
    id: "image",
    label: "תמונה שלי",
    draw(ctx, w, h) {
      const scale = Math.max(w / image.width, h / image.height);
      const iw = image.width * scale;
      const ih = image.height * scale;
      ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    },
  };
}
