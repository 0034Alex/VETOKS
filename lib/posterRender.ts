// Афиша участницы: картинка 1080×1350 (формат 4:5 для Instagram и TikTok).
// Рисуем в браузере на canvas. Три рамки — по возрастным категориям: TEEN, MISS, LADY.
// Весь текст по-украински.

export type PosterCat = "teen" | "main" | "adult";

export type PosterOpts = {
  cat: PosterCat;
  photo: HTMLImageElement; // вырезанная девушка (PNG с прозрачностью) или обычное фото
  cutout: boolean; // true — фон вырезан; false — кладём фото в рамку-арку
  first: string;
  last: string;
  age: number | null;
  height: number | null;
  city: string;
  country: string;
  fonts: { script: string; sans: string }; // имена шрифтов (Great Vibes и Jost)
};

const W = 1080;
const H = 1350;
const U = W / 100;

type Theme = {
  word: string;
  tag: string[];
  part: string;
  acc: string;
  logo: string;
  ink: string;
  line: string;
  glass: string;
  radius: number;
  rim: string;
  frame: string;
  shade: string;
  textShadow: string;
};

const THEMES: Record<PosterCat, Theme> = {
  main: {
    word: "MISS",
    tag: ["MISS", "2026"],
    part: "Учасниця MISS VETOKS 2026",
    acc: "#E0BB6A",
    logo: "#F4E3B6",
    ink: "#F7F1E6",
    line: "rgba(224,187,106,0.5)",
    glass: "rgba(10,7,4,0.55)",
    radius: 2 * U,
    rim: "rgba(255,205,120,0.55)",
    frame: "rgba(224,187,106,0.85)",
    shade: "#060403",
    textShadow: "rgba(0,0,0,0.7)",
  },
  adult: {
    word: "LADY",
    tag: ["LADY", "2026"],
    part: "Учасниця LADY VETOKS 2026",
    acc: "#8E1F45",
    logo: "#2A2024",
    ink: "#2A2024",
    line: "rgba(142,31,69,0.45)",
    glass: "rgba(255,255,255,0.5)",
    radius: 1.4 * U,
    rim: "rgba(255,255,255,0.8)",
    frame: "rgba(176,132,60,0.85)",
    shade: "#F1E4D0",
    textShadow: "rgba(255,255,255,0.7)",
  },
  teen: {
    word: "TEEN",
    tag: ["MISS TEEN", "2026"],
    part: "Учасниця MISS TEEN VETOKS 2026",
    acc: "#FFD1EC",
    logo: "#4C1D95",
    ink: "#FFFFFF",
    line: "rgba(255,255,255,0.7)",
    glass: "rgba(255,255,255,0.22)",
    radius: 6 * U,
    rim: "rgba(255,255,255,0.9)",
    frame: "rgba(255,255,255,0.95)",
    shade: "rgba(112,36,178,0.94)",
    textShadow: "rgba(76,29,149,0.55)",
  },
};

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number, align: "left" | "center" | "right" = "left") {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = align === "left" ? x : align === "center" ? x - total / 2 : x - total;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + sp;
  });
  return total;
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, sp: number) {
  const chars = Array.from(text);
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * Math.max(0, chars.length - 1);
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string, alpha: number) {
  const p = [[50, 0], [60, 40], [100, 50], [60, 60], [50, 100], [40, 60], [0, 50], [40, 40]];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  p.forEach(([px, py], i) => {
    const x = cx - s / 2 + (px / 100) * s;
    const y = cy - s / 2 + (py / 100) * s;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function bokeh(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function crown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, lw: number) {
  const k = w / 60;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(6, 34);
  ctx.lineTo(4, 10);
  ctx.lineTo(18, 22);
  ctx.lineTo(30, 5);
  ctx.lineTo(42, 22);
  ctx.lineTo(56, 10);
  ctx.lineTo(54, 34);
  ctx.closePath();
  ctx.stroke();
  [[4, 8], [30, 3.5], [56, 8]].forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

const ICONS = {
  age: "M7 6h18a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z M4 13h24 M10 3v6 M22 3v6",
  height: "M16 3a3 3 0 1 0 0.001 0 M11 12h10l-1 8h-8z M13 20v9 M19 20v9",
  pin: "M16 29s9-9 9-16a9 9 0 0 0-18 0c0 7 9 16 9 16z M16 9.8a3.2 3.2 0 1 0 0.001 0",
};

function icon(ctx: CanvasRenderingContext2D, d: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(d));
  ctx.restore();
}

function yearsWord(n: number) {
  const m = n % 10;
  const c = n % 100;
  return c > 10 && c < 15 ? "років" : m === 1 ? "рік" : m > 1 && m < 5 ? "роки" : "років";
}

function drawBackground(ctx: CanvasRenderingContext2D, cat: PosterCat) {
  if (cat === "main") {
    ctx.save();
    ctx.translate(0.66 * W, 0.34 * H);
    ctx.scale(1, 75 / 85);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 85 * U);
    g.addColorStop(0, "#4a3012");
    g.addColorStop(0.55, "#17100a");
    g.addColorStop(1, "#060403");
    ctx.fillStyle = g;
    ctx.fillRect(-W, -H, W * 2, H * 2);
    ctx.restore();
    ctx.fillStyle = "#060403";
    // лучи света
    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const o = off.getContext("2d")!;
    const cx = 0.66 * W;
    const cy = 0.32 * H;
    for (let a = 192; a < 192 + 360; a += 9) {
      o.beginPath();
      o.moveTo(cx, cy);
      o.arc(cx, cy, 160 * U, (a * Math.PI) / 180, ((a + 3) * Math.PI) / 180);
      o.closePath();
      o.fillStyle = "rgba(255,208,120,0.14)";
      o.fill();
    }
    o.globalCompositeOperation = "destination-in";
    const m = o.createRadialGradient(cx, cy, 0, cx, cy, 70 * U);
    m.addColorStop(0, "#000");
    m.addColorStop(0.8, "rgba(0,0,0,0)");
    o.fillStyle = m;
    o.fillRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0);
    // свечение за девушкой
    const hx = W + 12 * U - 50 * U;
    const hy = 50 * U;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 50 * U);
    hg.addColorStop(0, "rgba(255,200,110,0.45)");
    hg.addColorStop(0.62, "rgba(255,200,110,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);
  } else if (cat === "adult") {
    const g = ctx.createLinearGradient(0.3 * W, 0, 0.7 * W, H);
    g.addColorStop(0, "#FCF7EC");
    g.addColorStop(0.55, "#EFE3CE");
    g.addColorStop(1, "#E3D2B5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // шёлковые ленты
    ctx.save();
    ctx.scale(U, U);
    const g1 = ctx.createLinearGradient(0, 0, 100, 0);
    g1.addColorStop(0, "#8E1F45");
    g1.addColorStop(0.6, "#C7506F");
    g1.addColorStop(1, "#E9B2A3");
    const g2 = ctx.createLinearGradient(0, 0, 100, 0);
    g2.addColorStop(0, "#C9A253");
    g2.addColorStop(1, "#F6E3B0");
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = g1;
    ctx.fill(new Path2D("M-5 102 C 28 74, 58 108, 105 58 L105 72 C 62 120, 30 90, -5 118 Z"));
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g2;
    ctx.fill(new Path2D("M-5 70 C 25 40, 62 70, 105 22 L105 30 C 64 80, 28 52, -5 80 Z"));
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "#C9A253";
    ctx.lineWidth = 0.35;
    ctx.stroke(new Path2D("M-5 40 C 30 18, 60 40, 105 -4"));
    ctx.restore();
    // мягкий свет за девушкой
    const hx = W + 10 * U - 47.5 * U;
    const hy = 6 * U + 47.5 * U;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 47.5 * U);
    hg.addColorStop(0, "rgba(255,255,255,0.95)");
    hg.addColorStop(0.66, "rgba(255,255,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0.35 * W, 0, 0.65 * W, H);
    g.addColorStop(0, "#FFE0F0");
    g.addColorStop(0.55, "#EEDDFF");
    g.addColorStop(1, "#FFD3EA");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const hx = W + 12 * U - 50 * U;
    const hy = 50 * U;
    const hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 50 * U);
    hg.addColorStop(0, "#fff");
    hg.addColorStop(0.38, "rgba(255,255,255,0.75)");
    hg.addColorStop(0.68, "rgba(255,190,225,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H);
    // кольцо
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 6 * U;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 0.6 * U;
    ctx.beginPath();
    ctx.arc(W - 3 * U - 42 * U, 12 * U + 42 * U, 42 * U, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawDecor(ctx: CanvasRenderingContext2D, cat: PosterCat) {
  if (cat === "main") {
    const r = rnd(7);
    for (let i = 0; i < 16; i++) {
      const s = 1.6 + r() * 5;
      const x = r() * 100;
      const y = r() * 70;
      bokeh(ctx, (x + s / 2) * U, (y + s / 2) * U, (s / 2) * U * 1.6, "rgba(255,215,130,0.55)", 0.25 + r() * 0.5);
    }
    for (let j = 0; j < 9; j++) {
      const q = 2 + r() * 4;
      sparkle(ctx, (8 + r() * 84 + q / 2) * U, (14 + r() * 60 + q / 2) * U, q * U, "#FFE3A0", 0.5 + r() * 0.5);
    }
  } else if (cat === "adult") {
    const r = rnd(21);
    for (let j = 0; j < 7; j++) {
      const q = 2 + r() * 3.5;
      sparkle(ctx, (8 + r() * 84 + q / 2) * U, (14 + r() * 60 + q / 2) * U, q * U, "#D9B25F", 0.5 + r() * 0.5);
    }
  } else {
    const r = rnd(5);
    for (let i = 0; i < 14; i++) {
      const s = 2 + r() * 6;
      const x = r() * 100;
      const y = r() * 75;
      bokeh(ctx, (x + s / 2) * U, (y + s / 2) * U, (s / 2) * U * 1.6, "rgba(255,255,255,0.95)", 0.4 + r() * 0.5);
    }
    for (let j = 0; j < 12; j++) {
      const q = 2.4 + r() * 5;
      sparkle(ctx, (6 + r() * 88 + q / 2) * U, (12 + r() * 62 + q / 2) * U, q * U, "#ffffff", 0.6 + r() * 0.4);
    }
  }
}

function drawGiant(ctx: CanvasRenderingContext2D, cat: PosterCat, t: Theme, sans: string) {
  ctx.save();
  ctx.font = `600 100px ${sans}`;
  const w100 = ctx.measureText(t.word).width;
  const fs = (100 * W * 0.9) / w100;
  ctx.font = `600 ${fs}px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  const base = 24 * U + 0.78 * fs;
  const x = W / 2;
  const top = base - 0.72 * fs;
  const g = ctx.createLinearGradient(0, top, 0, base);
  if (cat === "main") {
    g.addColorStop(0, "#FFF0BE");
    g.addColorStop(0.4, "#E0B04A");
    g.addColorStop(0.75, "#8F6314");
    g.addColorStop(1, "#4a3009");
    ctx.shadowColor = "rgba(224,170,70,0.35)";
    ctx.shadowBlur = 2 * U;
    ctx.fillStyle = g;
    ctx.fillText(t.word, x, base);
  } else if (cat === "adult") {
    g.addColorStop(0, "#B84766");
    g.addColorStop(0.55, "#8E1F45");
    g.addColorStop(1, "#5C1030");
    ctx.shadowColor = "rgba(142,31,69,0.25)";
    ctx.shadowBlur = 2 * U;
    ctx.fillStyle = g;
    ctx.fillText(t.word, x, base);
  } else {
    ctx.shadowColor = "rgba(200,60,170,0.45)";
    ctx.shadowBlur = 4 * U;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(t.word, x, base);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(236,72,153,0.4)";
    ctx.lineWidth = 0.4 * U;
    ctx.strokeText(t.word, x, base);
  }
  ctx.restore();
}

function drawPerson(ctx: CanvasRenderingContext2D, o: PosterOpts, t: Theme) {
  const img = o.photo;
  if (o.cutout) {
    const ch = 116 * U;
    const cw = ch * (img.naturalWidth / img.naturalHeight);
    const x = W + 8 * U - cw;
    const y = H + 7 * U - ch;
    const off = document.createElement("canvas");
    off.width = Math.round(cw);
    off.height = Math.round(ch);
    const c = off.getContext("2d")!;
    c.drawImage(img, 0, 0, off.width, off.height);
    c.globalCompositeOperation = "destination-in";
    const m = c.createLinearGradient(0, 0, 0, off.height);
    m.addColorStop(0, "#000");
    m.addColorStop(0.6, "#000");
    m.addColorStop(0.9, "rgba(0,0,0,0)");
    c.fillStyle = m;
    c.fillRect(0, 0, off.width, off.height);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 3.4 * U;
    ctx.shadowOffsetY = 2.4 * U;
    ctx.drawImage(off, x, y);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = t.rim;
    ctx.shadowBlur = 1.4 * U;
    ctx.drawImage(off, x, y);
    ctx.restore();
  } else {
    // фото без вырезки: кладём в арку
    const w = 66 * U;
    const h = 92 * U;
    const x = W - 9 * U - w;
    const y = H - 24 * U - h;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.clip();
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * k;
    const ih = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * 0.12, iw, ih);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = t.acc;
    ctx.lineWidth = 0.6 * U;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w / 2);
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.restore();
  }
}

export async function renderPoster(o: PosterOpts): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const t = THEMES[o.cat];
  const { sans, script } = o.fonts;

  drawBackground(ctx, o.cat);
  drawDecor(ctx, o.cat);
  drawGiant(ctx, o.cat, t, sans);
  drawPerson(ctx, o, t);

  // затемнение / подложка снизу
  const sh = ctx.createLinearGradient(0, H - 52 * U, 0, H);
  sh.addColorStop(0, rgbaZero(t.shade));
  sh.addColorStop(0.7, t.shade);
  sh.addColorStop(1, t.shade);
  ctx.fillStyle = sh;
  ctx.fillRect(0, H - 52 * U, W, 52 * U);

  // рамка
  ctx.save();
  ctx.strokeStyle = t.frame;
  if (o.cat === "teen") {
    ctx.lineWidth = 0.9 * U;
    roundRect(ctx, 3.2 * U, 3.2 * U, W - 6.4 * U, H - 6.4 * U, 6 * U);
  } else {
    ctx.lineWidth = 0.3 * U * 1.6;
    ctx.beginPath();
    ctx.rect(3.2 * U, 3.2 * U, W - 6.4 * U, H - 6.4 * U);
  }
  ctx.stroke();
  if (o.cat === "main") {
    ctx.strokeStyle = "rgba(224,187,106,0.25)";
    ctx.lineWidth = 1.5 * U * 0.5;
    ctx.strokeRect(4.7 * U, 4.7 * U, W - 9.4 * U, H - 9.4 * U);
  }
  ctx.restore();

  // логотип
  crown(ctx, 7 * U + 0.6 * U, 7 * U, 9.5 * U, o.cat === "teen" ? "#8B3FD9" : t.acc, 2.2);
  ctx.fillStyle = t.logo;
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 ${6 * U}px ${sans}`;
  spaced(ctx, "VETOKS", 7 * U, 7 * U + 6.3 * U + 0.6 * U + 5 * U, 1.2 * U);
  ctx.globalAlpha = 0.85;
  ctx.font = `400 ${2.1 * U}px ${sans}`;
  spaced(ctx, "БІЛЬШЕ, НІЖ КОНКУРС", 7 * U, 7 * U + 6.3 * U + 0.6 * U + 5 * U + 3.4 * U, 0.38 * U);
  ctx.globalAlpha = 1;

  // категория справа сверху
  ctx.fillStyle = t.logo;
  ctx.font = `500 ${4.6 * U}px ${sans}`;
  spaced(ctx, t.tag[0], W - 7 * U, 8 * U + 4.1 * U, 0.64 * U, "right");
  spaced(ctx, t.tag[1], W - 7 * U, 8 * U + 4.1 * U + 5.5 * U, 0.64 * U, "right");

  // имя
  const first = (o.first || "").trim();
  const last = (o.last || "").trim().toUpperCase();
  const bottom = H - 27 * U;
  ctx.save();
  ctx.shadowColor = t.textShadow;
  ctx.shadowBlur = 1.8 * U;
  ctx.fillStyle = t.ink;
  ctx.font = `400 ${2.9 * U}px ${sans}`;
  spaced(ctx, t.part.toUpperCase(), 7 * U, bottom - 0.7 * U, 0.58 * U);
  if (last) {
    let lfs = 9.5 * U;
    ctx.font = `500 ${lfs}px ${sans}`;
    const maxW = 70 * U;
    const lw = spacedWidth(ctx, last, 0.04 * lfs);
    if (lw > maxW) lfs = lfs * (maxW / lw);
    ctx.font = `500 ${lfs}px ${sans}`;
    spaced(ctx, last, 7 * U, bottom - 3.6 * U - 2.4 * U - 2.2 * U, 0.04 * lfs);
  }
  ctx.restore();
  if (first) {
    let ffs = (o.cat === "teen" ? 20 : 19) * U;
    ctx.font = `400 ${ffs}px ${script}`;
    const maxW = 66 * U;
    const fw = ctx.measureText(first).width;
    if (fw > maxW) ffs = ffs * (maxW / fw);
    ctx.font = `400 ${ffs}px ${script}`;
    const baseY = bottom - 3.6 * U - 2.4 * U - 2.2 * U - 9.5 * U * 0.72 - 1.2 * U;
    ctx.save();
    const g = ctx.createLinearGradient(0, baseY - ffs * 0.7, 0, baseY + ffs * 0.2);
    if (o.cat === "main") {
      g.addColorStop(0, "#FFF0BE");
      g.addColorStop(1, "#D6A547");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
    } else if (o.cat === "adult") {
      g.addColorStop(0, "#B04062");
      g.addColorStop(1, "#7C1A3D");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(255,255,255,0.6)";
    } else {
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(76,29,149,0.6)";
    }
    ctx.shadowBlur = 1.5 * U;
    ctx.shadowOffsetY = 0.5 * U;
    ctx.textAlign = "left";
    ctx.fillText(first, 7 * U, baseY);
    ctx.restore();
  }

  // плашка с данными
  const ih = 14 * U;
  const iy = H - 9.5 * U - ih;
  const ix = 6.4 * U;
  const iw = W - 12.8 * U;
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, t.radius);
  ctx.fillStyle = t.glass;
  ctx.fill();
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 0.25 * U * 1.5;
  ctx.stroke();
  ctx.restore();

  const cells: { ic: string; big: string; small: string }[] = [];
  if (o.age) cells.push({ ic: ICONS.age, big: String(o.age), small: yearsWord(o.age).toUpperCase() });
  if (o.height) cells.push({ ic: ICONS.height, big: String(o.height), small: "СМ" });
  if (o.city) cells.push({ ic: ICONS.pin, big: o.city, small: (o.country || "").toUpperCase() });
  let cx = ix + 4 * U;
  const cy = iy + ih / 2;
  cells.forEach((c, i) => {
    icon(ctx, c.ic, cx, cy - 3 * U, 6 * U, t.acc);
    const tx = cx + 8 * U;
    ctx.fillStyle = t.ink;
    ctx.font = `500 ${5.2 * U}px ${sans}`;
    ctx.textAlign = "left";
    ctx.fillText(c.big, tx, cy + 0.6 * U);
    ctx.globalAlpha = 0.85;
    ctx.font = `400 ${2.4 * U}px ${sans}`;
    spaced(ctx, c.small, tx, cy + 3.7 * U, 0.34 * U);
    ctx.globalAlpha = 1;
    ctx.font = `500 ${5.2 * U}px ${sans}`;
    const w1 = ctx.measureText(c.big).width;
    ctx.font = `400 ${2.4 * U}px ${sans}`;
    const w2 = spacedWidth(ctx, c.small, 0.34 * U);
    const cellW = 8 * U + Math.max(w1, w2);
    cx += cellW + 3.6 * U;
    if (i < cells.length - 1) {
      ctx.strokeStyle = t.line;
      ctx.lineWidth = 0.25 * U * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, iy + ih * 0.22);
      ctx.lineTo(cx, iy + ih * 0.78);
      ctx.stroke();
      cx += 3.6 * U;
    }
  });

  // адрес голосования
  ctx.fillStyle = o.cat === "teen" ? "#fff" : t.acc;
  ctx.font = `500 ${2.5 * U}px ${sans}`;
  spaced(ctx, "ГОЛОСУЙ НА VETOKS.COM", W / 2, H - 5.2 * U - 0.6 * U, 0.75 * U, "center");

  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("canvas"))), "image/jpeg", 0.93));
}

function rgbaZero(color: string) {
  if (color.startsWith("rgba")) return color.replace(/,\s*[\d.]+\)$/, ",0)");
  return rgba(color, 0);
}
