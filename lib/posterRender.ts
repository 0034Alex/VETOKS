// Афіша учасниці: картинка 1080×1350 (формат 4:5 для Instagram и TikTok).
// Рисуем в браузере на canvas. Три разные раскладки по категориям:
//   MISS  — фото слева, чёрно-золотая панель с дугой справа;
//   LADY  — фото на весь постер, данные на стеклянной панели справа;
//   TEEN  — фото справа с белым контуром, данные слева в «стеклянных плитках».
// Фото всегда вписывается целиком и никогда не заходит под текст. Весь текст по-украински.

export type PosterCat = "teen" | "main" | "adult";

export type PosterOpts = {
  cat: PosterCat;
  photo: CanvasImageSource & { width: number; height: number }; // уже обрезанное под кадр фото (см. FRAME)
  first: string;
  last: string;
  age: number | null;
  height: number | null;
  city: string;
  country: string;
  interests: string; // «Танці, подорожі» — до трёх через запятую
  about: string; // коротко о себе
  fonts: { serif: string; sans: string };
};

const W = 1080;
const H = 1350;
const U = W / 100; // 1 «cqw» макета

// Размер кадра для фото в единицах U (1 U = 10.8 px на афіше). Страница обрезает фото под эти пропорции.
export const FRAME: Record<PosterCat, { w: number; h: number }> = {
  main: { w: 55, h: 125 },
  adult: { w: 55, h: 125 },
  teen: { w: 49, h: 103 },
};
export const POSTER_UNIT = U;

type Ctx = CanvasRenderingContext2D;

// ---------- мелкие помощники ----------
function yearsWord(n: number) {
  const m = n % 10;
  const c = n % 100;
  return c > 10 && c < 15 ? "років" : m === 1 ? "рік" : m > 1 && m < 5 ? "роки" : "років";
}

function spacedWidth(ctx: Ctx, text: string, sp: number) {
  const chars = Array.from(text);
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * Math.max(0, chars.length - 1);
}

function spaced(ctx: Ctx, text: string, x: number, y: number, sp: number, align: "left" | "center" | "right" = "left") {
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

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, tl: number, tr: number, br: number, bl: number) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function sparkle(ctx: Ctx, cx: number, cy: number, s: number, color: string, alpha: number) {
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

function glow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function crown(ctx: Ctx, x: number, y: number, w: number, color: string, lw: number) {
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
  ctx.restore();
}

const ICONS = {
  age: "M7 6h18a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z M4 13h24 M10 3v6 M22 3v6",
  height: "M16 3a3 3 0 1 0 0.001 0 M11 12h10l-1 8h-8z M13 20v9 M19 20v9",
  pin: "M16 29s9-9 9-16a9 9 0 0 0-18 0c0 7 9 16 9 16z M16 9.8a3.2 3.2 0 1 0 0.001 0",
  star: "M16 3.5l4.2 8.6 9.3 1.3-6.8 6.5 1.7 9.4L16 24.6 7.6 29.3l1.7-9.4L2.5 13.4l9.3-1.3z",
  heart: "M16 27s-11-7-11-15a6.3 6.3 0 0 1 11-4.1A6.3 6.3 0 0 1 27 12c0 8-11 15-11 15z",
};

function icon(ctx: Ctx, d: string, x: number, y: number, size: number, color: string, lw = 1.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(d));
  ctx.restore();
}

// Размытие без ctx.filter (его нет в части Safari): уменьшаем и растягиваем обратно.
function blurInto(ctx: Ctx, src: CanvasImageSource, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, k = 14) {
  const a = document.createElement("canvas");
  a.width = Math.max(2, Math.round(dw / k));
  a.height = Math.max(2, Math.round(dh / k));
  const c = a.getContext("2d")!;
  c.imageSmoothingQuality = "high";
  c.drawImage(src, 0, 0, sw, sh, 0, 0, a.width, a.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(a, 0, 0, a.width, a.height, dx, dy, dw, dh);
  ctx.restore();
}

// Размытая копия фото на весь постер (фон под панелью).
function blurredBase(ctx: Ctx, o: PosterOpts, dark: string) {
  const iw = o.photo.width;
  const ih = o.photo.height;
  const k = Math.max(W / iw, H / ih);
  blurInto(ctx, o.photo, iw, ih, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k, 22);
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);
}

// Перенос текста по ширине (не больше maxLines строк, лишнее — «…»).
function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const t = cur ? cur + " " + words[i] : words[i];
    if (ctx.measureText(t).width <= maxW || !cur) {
      cur = t;
    } else {
      lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "…";
  }
  return lines;
}

function fitFont(ctx: Ctx, text: string, weight: number, start: number, maxW: number, family: string, sp = 0, min = 2) {
  let s = start;
  for (let i = 0; i < 120; i++) {
    ctx.font = `${weight} ${s * U}px ${family}`;
    if (spacedWidth(ctx, text, sp * s * U) <= maxW || s <= min) break;
    s -= 0.15;
  }
  return s;
}

function cleanInterests(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

type Pal = {
  ink: string;
  label: string;
  first: string;
  last: string;
  brand: string;
  icon: string;
  rule: string;
  tag: string;
  foot: string;
};

// Правая панель MISS / LADY: логотип, категория, имя, строки с данными и подвал.
function drawPanelText(ctx: Ctx, o: PosterOpts, pal: Pal, tag: string, x0: number, x1: number, y0: number, yEnd: number, footIndent: number) {
  const { serif, sans } = o.fonts;
  const wd = x1 - x0;
  const cx = (x0 + x1) / 2;
  ctx.textBaseline = "alphabetic";
  let y = y0;

  crown(ctx, cx - 3.7 * U, y, 7.4 * U, pal.icon, 1.7);
  y += 4.2 * U + 0.9 * U;

  ctx.fillStyle = pal.brand;
  ctx.font = `500 ${5.2 * U}px ${serif}`;
  spaced(ctx, "VETOKS", cx + 0.9 * U, y + 4.2 * U, 0.34 * 5.2 * U, "center");
  y += 4.2 * U + 1 * U;
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.75;
  ctx.font = `400 ${1.45 * U}px ${sans}`;
  spaced(ctx, "БІЛЬШЕ, НІЖ КОНКУРС", cx + 0.3 * U, y + 1.5 * U, 0.3 * 1.45 * U, "center");
  ctx.globalAlpha = 1;
  y += 1.5 * U + 4 * U;

  const ts = fitFont(ctx, tag, 500, 2.5, wd, serif, 0.14);
  ctx.fillStyle = pal.tag;
  ctx.font = `500 ${ts * U}px ${serif}`;
  spaced(ctx, tag, cx, y + ts * U * 0.8, 0.14 * ts * U, "center");
  y += ts * U + 4 * U;

  const first = (o.first || "").trim();
  const last = (o.last || "").trim().toUpperCase();
  const fs = fitFont(ctx, first, 600, 8.6, wd, serif, 0);
  ctx.fillStyle = pal.first;
  ctx.font = `600 ${fs * U}px ${serif}`;
  ctx.textAlign = "left";
  ctx.fillText(first, x0, y + fs * U * 0.82);
  y += fs * U * 1.04;
  const ls = fitFont(ctx, last, 700, 6.2, wd, serif, 0.02);
  ctx.fillStyle = pal.last;
  ctx.font = `700 ${ls * U}px ${serif}`;
  spaced(ctx, last, x0, y + ls * U * 0.82, 0.02 * ls * U);
  y += ls * U * 1.04 + 3.4 * U;

  ctx.strokeStyle = pal.rule;
  ctx.lineWidth = 0.1 * U;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  y += 2.8 * U;

  const tx = x0 + 5.8 * U;
  const tw = x1 - tx;
  const rows: { ic: string; label: string; lines: string[]; small?: boolean }[] = [];
  if (o.age) rows.push({ ic: ICONS.age, label: "Вік", lines: [`${o.age} ${yearsWord(o.age)}`] });
  if (o.height) rows.push({ ic: ICONS.height, label: "Зріст", lines: [`${o.height} см`] });
  if (o.city) rows.push({ ic: ICONS.pin, label: "Місто", lines: [[o.city, o.country].filter(Boolean).join(", ")] });
  const ints = cleanInterests(o.interests);
  ctx.font = `500 ${2.5 * U}px ${sans}`;
  if (ints) rows.push({ ic: ICONS.star, label: "Інтереси", lines: wrap(ctx, ints, tw, 2) });
  ctx.font = `400 ${2.2 * U}px ${sans}`;
  const ab = (o.about || "").trim();
  if (ab) rows.push({ ic: ICONS.heart, label: "Про себе", lines: wrap(ctx, ab, tw, 3), small: true });

  rows.forEach((r) => {
    icon(ctx, r.ic, x0, y + 0.3 * U, 3.6 * U, pal.icon, 1.5);
    ctx.fillStyle = pal.label;
    ctx.globalAlpha = 0.9;
    ctx.font = `500 ${1.5 * U}px ${sans}`;
    spaced(ctx, r.label.toUpperCase(), tx, y + 1.4 * U, 0.2 * 1.5 * U);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.ink;
    const fsz = r.small ? 2.2 : 2.5;
    const lh = r.small ? 3 : 3.1;
    ctx.font = `${r.small ? 400 : 500} ${fsz * U}px ${sans}`;
    ctx.textAlign = "left";
    r.lines.forEach((ln, i) => ctx.fillText(ln, tx, y + 1.4 * U + 3.1 * U + i * lh * U - 0.3 * U));
    y += (1.4 + 3.1 + (r.lines.length - 1) * lh + 0.9) * U + 3.4 * U;
  });

  // подвал
  ctx.strokeStyle = pal.rule;
  ctx.beginPath();
  ctx.moveTo(x0 + footIndent, yEnd - 6 * U);
  ctx.lineTo(x1, yEnd - 6 * U);
  ctx.stroke();
  ctx.fillStyle = pal.foot;
  ctx.font = `500 ${1.5 * U}px ${sans}`;
  spaced(ctx, "ГОЛОСУЙ НА VETOKS.COM", x0 + footIndent, yEnd - 2.4 * U, 0.12 * 1.5 * U);
  ctx.textAlign = "right";
  ctx.fillText("→", x1, yEnd - 2.4 * U);
  ctx.textAlign = "left";
}

// ---------- MISS: дуга ----------
function drawMiss(ctx: Ctx, o: PosterOpts) {
  ctx.fillStyle = "#070606";
  ctx.fillRect(0, 0, W, H);
  blurredBase(ctx, o, "rgba(0,0,0,0.45)");
  // фото слева — на всю высоту
  ctx.drawImage(o.photo, 0, 0, o.photo.width, o.photo.height, 0, 0, FRAME.main.w * U, H);
  const fade = ctx.createLinearGradient(0, H - 30 * U, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, H - 30 * U, FRAME.main.w * U, 30 * U);

  // панель
  const px = 55 * U;
  const pwid = 45 * U;
  ctx.save();
  roundRectPath(ctx, px - 0.5 * U, 0, pwid + 0.5 * U, H, 6 * U, 0, 0, 20 * U);
  ctx.shadowColor = "rgba(217,160,70,0.45)";
  ctx.shadowBlur = 4 * U;
  ctx.shadowOffsetX = -2.2 * U;
  ctx.fillStyle = "#EBC46E";
  ctx.fill();
  ctx.restore();
  roundRectPath(ctx, px, 0, pwid, H, 6 * U, 0, 0, 20 * U);
  const pg = ctx.createLinearGradient(0, 0, 0, H);
  pg.addColorStop(0, "#14110d");
  pg.addColorStop(1, "#080706");
  ctx.fillStyle = pg;
  ctx.fill();

  drawPanelText(
    ctx,
    o,
    { ink: "#F3E6C4", label: "#D9B15F", first: "#ECD196", last: "#FFFFFF", brand: "#E7C97C", icon: "#D9B15F", rule: "rgba(217,177,95,0.4)", tag: "#D9B15F", foot: "#D9B15F" },
    "MISS VETOKS 2026",
    px + 5.2 * U,
    W - 3.6 * U,
    5 * U,
    H - 3.6 * U,
    5 * U
  );
}

// ---------- LADY: стекло ----------
function drawLady(ctx: Ctx, o: PosterOpts) {
  ctx.fillStyle = "#EFE3CE";
  ctx.fillRect(0, 0, W, H);
  blurredBase(ctx, o, "rgba(255,248,235,0.18)");
  ctx.drawImage(o.photo, 0, 0, o.photo.width, o.photo.height, 0, 0, FRAME.adult.w * U, H);

  // стеклянная панель
  const px = 53 * U;
  const py = 3 * U;
  const pw = 44 * U;
  const ph = H - 6 * U;
  ctx.save();
  roundRectPath(ctx, px, py, pw, ph, 5 * U, 5 * U, 5 * U, 5 * U);
  ctx.shadowColor = "rgba(40,20,0,0.3)";
  ctx.shadowBlur = 5 * U;
  ctx.shadowOffsetY = 2 * U;
  ctx.fillStyle = "#f5eee2";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, px, py, pw, ph, 5 * U, 5 * U, 5 * U, 5 * U);
  ctx.clip();
  const snap = document.createElement("canvas");
  snap.width = W;
  snap.height = H;
  snap.getContext("2d")!.drawImage(ctx.canvas, 0, 0);
  blurInto(ctx, snap, W, H, 0, 0, W, H, 12);
  ctx.fillStyle = "rgba(253,250,244,0.72)";
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  roundRectPath(ctx, px, py, pw, ph, 5 * U, 5 * U, 5 * U, 5 * U);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 0.2 * U;
  ctx.stroke();

  drawPanelText(
    ctx,
    o,
    { ink: "#4e3626", label: "#a9824a", first: "#8a5a3a", last: "#3f2a1c", brand: "#6b4a30", icon: "#a9824a", rule: "rgba(150,110,60,0.4)", tag: "#a9824a", foot: "#8a5a3a" },
    "LADY VETOKS 2026",
    px + 5.2 * U,
    px + pw - 3.6 * U,
    py + 5 * U,
    py + ph - 3.6 * U,
    0
  );
}

// ---------- TEEN: наклейка ----------
function drawTeen(ctx: Ctx, o: PosterOpts) {
  const { sans } = o.fonts;
  const g = ctx.createLinearGradient(0, 0, W * 0.34, H);
  g.addColorStop(0, "#6a35d8");
  g.addColorStop(0.55, "#b53fc4");
  g.addColorStop(1, "#ff7ab8");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.78, H * 0.22, W * 0.45, H * 0.3, "rgba(255,150,230,0.75)");
  glow(ctx, W * 0.2, H * 0.85, W * 0.4, H * 0.3, "rgba(120,200,255,0.45)");

  // большая надпись TEEN
  ctx.save();
  ctx.translate(46 * U, H - 2 * U);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `700 ${44 * U}px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = 0.45 * U;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.strokeText("TEEN", 0, -5 * U);
  ctx.restore();

  sparkle(ctx, 43.2 * U, 11.2 * U, 4.4 * U, "#fff", 0.9);
  sparkle(ctx, 91.5 * U, 31.5 * U, 3 * U, "#fff", 0.9);
  sparkle(ctx, 57.3 * U, 4.3 * U, 2.6 * U, "#fff", 0.9);

  // фото в скруглённой рамке с белым контуром
  {
    const fx = 47 * U;
    const fy = 13 * U;
    const fw = FRAME.teen.w * U;
    const fh = FRAME.teen.h * U;
    ctx.save();
    roundRectPath(ctx, fx, fy, fw, fh, 5 * U, 5 * U, 5 * U, 5 * U);
    ctx.shadowColor = "rgba(60,10,90,0.5)";
    ctx.shadowBlur = 3 * U;
    ctx.shadowOffsetY = 1.8 * U;
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRectPath(ctx, fx + 0.7 * U, fy + 0.7 * U, fw - 1.4 * U, fh - 1.4 * U, 4.4 * U, 4.4 * U, 4.4 * U, 4.4 * U);
    ctx.clip();
    ctx.drawImage(o.photo, 0, 0, o.photo.width, o.photo.height, fx + 0.7 * U, fy + 0.7 * U, fw - 1.4 * U, fh - 1.4 * U);
    ctx.restore();
    sparkle(ctx, 96 * U, 11 * U, 5 * U, "#fff", 0.95);
    sparkle(ctx, 45 * U, 118 * U, 4 * U, "#fff", 0.95);
  }

  // левая колонка
  const x0 = 4.5 * U;
  const wd = 39 * U;
  const x1 = x0 + wd;
  let y = 4.5 * U;
  ctx.textBaseline = "alphabetic";
  crown(ctx, x0, y, 5.4 * U, "#fff", 1.7);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${3.6 * U}px ${sans}`;
  spaced(ctx, "VETOKS", x0 + 7.4 * U, y + 3.5 * U, 0.3 * 3.6 * U);
  y += 3.6 * U + 2.6 * U;

  // плашка категории
  ctx.font = `700 ${1.9 * U}px ${sans}`;
  const tag = "MISS TEEN 2026";
  const tw = spacedWidth(ctx, tag, 0.14 * 1.9 * U);
  const ph = 1.9 * U * 1.2 + 2.2 * U;
  ctx.fillStyle = "#fff";
  roundRectPath(ctx, x0, y, tw + 5.2 * U, ph, ph / 2, ph / 2, ph / 2, ph / 2);
  ctx.fill();
  ctx.fillStyle = "#8a2bd1";
  spaced(ctx, tag, x0 + 2.6 * U, y + ph / 2 + 0.7 * U, 0.14 * 1.9 * U);
  y += ph + 2.6 * U;

  const first = (o.first || "").trim();
  const last = (o.last || "").trim().toUpperCase();
  const fs = fitFont(ctx, first, 700, 9, wd, sans, 0);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${fs * U}px ${sans}`;
  ctx.textAlign = "left";
  ctx.fillText(first, x0, y + fs * U * 0.8);
  y += fs * U * 1.02;
  const ls = fitFont(ctx, last, 500, 5.2, wd, sans, 0.08);
  ctx.fillStyle = "#ffd6f3";
  ctx.font = `500 ${ls * U}px ${sans}`;
  spaced(ctx, last, x0, y + ls * U * 0.8, 0.08 * ls * U);
  y += ls * U * 1.02 + 2.6 * U;

  const tile = (x: number, yy: number, w: number, h: number) => {
    roundRectPath(ctx, x, yy, w, h, 3 * U, 3 * U, 3 * U, 3 * U);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.1 * U + 0.5;
    ctx.stroke();
  };
  const cell = (ic: string, label: string, lines: string[], x: number, yy: number, w: number, small = false) => {
    const lh = small ? 2.9 : 3.1;
    const h = (1.8 * 2 + 1.35 + 0.9 + 2.6 + (lines.length - 1) * lh) * U;
    tile(x, yy, w, h);
    icon(ctx, ic, x + 2.2 * U, yy + h / 2 - 1.7 * U, 3.4 * U, "#fff", 1.5);
    const tx = x + 2.2 * U + 3.4 * U + 1.6 * U;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.8;
    ctx.font = `500 ${1.35 * U}px ${sans}`;
    spaced(ctx, label.toUpperCase(), tx, yy + 1.8 * U + 1.2 * U, 0.18 * 1.35 * U);
    ctx.globalAlpha = 1;
    ctx.font = `${small ? 400 : 600} ${(small ? 2.1 : 2.5) * U}px ${sans}`;
    lines.forEach((ln, i) => ctx.fillText(ln, tx, yy + 1.8 * U + 1.2 * U + 0.9 * U + 2.3 * U + i * lh * U));
    return h;
  };

  const half = (wd - 1.8 * U) / 2;
  const hA = cell(ICONS.age, "Вік", [o.age ? String(o.age) : "—"], x0, y, half);
  cell(ICONS.height, "Зріст", [o.height ? `${o.height} см` : "—"], x0 + half + 1.8 * U, y, half);
  y += hA + 1.8 * U;
  const innerW = wd - (2.2 + 3.4 + 1.6 + 2.2) * U;
  ctx.font = `600 ${2.5 * U}px ${sans}`;
  if (o.city) {
    const lines = wrap(ctx, [o.city, o.country].filter(Boolean).join(", "), innerW, 2);
    y += cell(ICONS.pin, "Місто", lines, x0, y, wd) + 1.8 * U;
  }
  const ints = cleanInterests(o.interests);
  if (ints) {
    ctx.font = `600 ${2.5 * U}px ${sans}`;
    y += cell(ICONS.star, "Інтереси", wrap(ctx, ints, innerW, 2), x0, y, wd) + 1.8 * U;
  }
  const ab = (o.about || "").trim();
  if (ab) {
    ctx.font = `400 ${2.1 * U}px ${sans}`;
    y += cell(ICONS.heart, "Про себе", wrap(ctx, ab, innerW, 3), x0, y, wd, true) + 1.8 * U;
  }

  // кнопка внизу
  const ch = 2 * 2 * U + 1.7 * U * 1.2;
  const cy = H - 4 * U - ch;
  roundRectPath(ctx, x0, cy, wd, ch, ch / 2, ch / 2, ch / 2, ch / 2);
  const cg = ctx.createLinearGradient(x0, 0, x1, 0);
  cg.addColorStop(0, "#ff7ac8");
  cg.addColorStop(1, "#9b6bff");
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${1.7 * U}px ${sans}`;
  spaced(ctx, "ГОЛОСУЙ НА VETOKS.COM", x0 + wd / 2, cy + ch / 2 + 0.6 * U, 0.14 * 1.7 * U, "center");
}

export async function renderPoster(o: PosterOpts): Promise<Blob> {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  if (o.cat === "main") drawMiss(ctx, o);
  else if (o.cat === "adult") drawLady(ctx, o);
  else drawTeen(ctx, o);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("canvas"))), "image/jpeg", 0.93));
}
