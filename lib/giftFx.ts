// Подарок на весь экран: эффекты частиц, звук (синтез, без файлов), вибрация.

export type GiftFxLevel = "off" | "mini" | "full";
export type GiftFxEvent = {
  name: string;
  art?: string | null;
  category?: string | null; // light | premium | vip | chat
  usd?: number | null;
  fx?: string | null; // выбор из CRM: off | mini | full
  qty?: number;
  to?: string | null; // кому подарили
  avatar?: string | null; // фото получателя
  emoji?: string | null; // запасной значок, если рисунка нет
};

export const levelOf = (e: GiftFxEvent): GiftFxLevel => {
  if (e.fx === "off" || e.fx === "mini" || e.fx === "full") return e.fx;
  if (e.category === "premium" || e.category === "vip") return "full";
  if (e.category === "chat") return Number(e.usd) >= 30 ? "full" : "mini";
  return "mini";
};

export const fireGiftFx = (e: GiftFxEvent) => {
  if (typeof window === "undefined") return;
  if (levelOf(e) === "off") return;
  window.dispatchEvent(new CustomEvent("vt-gift-fx", { detail: e }));
};

export const THEME: Record<string, string> = {
  Феникс: "embers", Дракон: "embers", "Огненное сердце": "embers", "Сказочный единорог": "magic",
  "Праздничный фейерверк": "fireworks", Дворец: "fireworks", "Золотой дождь": "coins", Комета: "cosmic",
  "Космическая ракета": "cosmic", Вселенная: "cosmic", Созвездие: "cosmic", "Северное сияние": "aurora",
  "Хрустальный замок": "snow", "Ледяная роза": "snow", Алмаз: "gems", "Императорская корона": "gold",
  "Золотой лев": "gold", Корабль: "gold", "Крылья ангела": "feathers", Лебедь: "feathers", "Магический шар": "magic",
  Кольцо: "gems", Бриллиант: "gems", Кристалл: "gems", "Букет роз": "petals", "Золотая роза": "petals",
  "Сердце с ключом": "hearts", "Бутылка шампанского": "bubbles", Торт: "confetti",
  Роза: "petals", Сердце: "hearts", "Воздушный поцелуй": "hearts", Тюльпаны: "petals", Цветок: "petals",
  Радуга: "confetti", Шарик: "confetti", Капкейк: "confetti", Пончик: "confetti", Конфета: "confetti",
};
export const themeOf = (name: string, category?: string | null) =>
  THEME[name] ?? (category === "vip" ? "gold" : category === "premium" ? "sparkle" : "hearts");

export const ACCENT: Record<string, string> = {
  embers: "#ff7a2f", coins: "#ffd54a", snow: "#7fd0ff", gems: "#7fd0ff", aurora: "#46ffb0", cosmic: "#a070ff",
  hearts: "#ff5fa8", petals: "#ff5a7a", magic: "#c090ff", feathers: "#fff6c0", fireworks: "#ff5e8a",
};

/* ---------------- звук ---------------- */
const SOUND_KEY = "vt_gfx_sound";
let soundGlobal = true; // выключатель из CRM
export const setGlobalSound = (v: boolean) => { soundGlobal = v; };
export const soundOn = () => {
  if (!soundGlobal) return false;
  try { return localStorage.getItem(SOUND_KEY) !== "0"; } catch { return true; }
};
export const setSoundOn = (v: boolean) => { try { localStorage.setItem(SOUND_KEY, v ? "1" : "0"); } catch {} };

let AC: AudioContext | null = null;
const ac = (): AudioContext | null => {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    if (!AC) AC = new C();
    if (AC && AC.state === "suspended") AC.resume().catch(() => {});
    return AC;
  } catch { return null; }
};
function tone(f: number, t0: number, dur: number, vol: number, type: OscillatorType = "sine", f2?: number) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
}
function noise(t0: number, dur: number, vol: number, f1: number, f2: number) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf;
  const fl = c.createBiquadFilter(); fl.type = "lowpass";
  fl.frequency.setValueAtTime(f1, c.currentTime + t0); fl.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur);
  const g = c.createGain(); g.gain.value = vol;
  s.connect(fl); fl.connect(g); g.connect(c.destination); s.start(c.currentTime + t0);
}
export function playSound(theme: string, level: GiftFxLevel) {
  if (!soundOn()) return;
  const k = level === "full" ? 1 : 0.45;
  try {
    if (theme === "fireworks") { noise(0, 0.5, 0.25 * k, 400, 3000); [0.5, 0.95, 1.4].forEach((t) => { noise(t, 0.5, 0.5 * k, 2200, 120); tone(140, t, 0.4, 0.3 * k, "sine", 40); }); }
    else if (theme === "coins") { for (let i = 0; i < 9; i++) { const t = 0.15 + i * 0.22 + Math.random() * 0.08; tone(1500 + Math.random() * 700, t, 0.18, 0.12 * k, "triangle"); tone(2300, t + 0.03, 0.14, 0.06 * k, "sine"); } }
    else if (theme === "embers") { noise(0, 0.9, 0.35 * k, 300, 1800); tone(90, 0.1, 0.8, 0.35 * k, "sawtooth", 50); tone(520, 0.4, 0.5, 0.1 * k, "triangle"); }
    else if (theme === "cosmic" || theme === "aurora") { tone(220, 0, 1.2, 0.12 * k, "sine", 880); tone(330, 0.1, 1.2, 0.08 * k, "sine", 1320); noise(0, 1.1, 0.12 * k, 200, 4000); }
    else if (theme === "snow" || theme === "gems") { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, i * 0.09, 0.9, 0.1 * k, "sine")); }
    else if (theme === "hearts" || theme === "petals") { tone(523, 0, 0.5, 0.13 * k, "sine"); tone(659, 0.12, 0.5, 0.13 * k, "sine"); tone(784, 0.24, 0.7, 0.13 * k, "sine"); }
    else if (theme === "bubbles") { for (let i = 0; i < 6; i++) tone(500 + Math.random() * 600, i * 0.12, 0.12, 0.1 * k, "sine", 1200); }
    else { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.1, 0.8, 0.11 * k, "triangle")); }
  } catch {}
}
export const vibrate = (level: GiftFxLevel) => {
  try { navigator.vibrate?.(level === "full" ? [40, 40, 80, 40, 160] : [30]); } catch {}
};

/* ---------------- частицы ---------------- */
type P = { x: number; y: number; vx: number; vy: number; g: number; life: number; age: number; s: number; rot: number; vr: number; type: string; col: string; drag: number };
const COL = {
  gold: ["#ffe27a", "#ffd54a", "#ffb02e", "#fff6c0"], pink: ["#ff5fa8", "#ff8ac0", "#ffd0e8", "#ff3d7f"],
  rainbow: ["#ff4a5a", "#ff9a2f", "#ffd93a", "#46c877", "#3a9bff", "#a070ff"], ice: ["#bfe9ff", "#7fd0ff", "#ffffff", "#a0c8ff"],
  fire: ["#ffe27a", "#ff9a2f", "#ff4a1f", "#ffd54a"], cosmic: ["#ffffff", "#bfa8ff", "#7fd0ff", "#ffd0f0"],
  green: ["#46ffb0", "#7fd0ff", "#d070ff", "#ffffff"], white: ["#ffffff", "#f3efe2", "#d8d4ec"],
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class FxEngine {
  private ctx: CanvasRenderingContext2D;
  private W = 0; private H = 0;
  private parts: P[] = [];
  private raf = 0; private t0 = 0; private last = 0; private theme = "sparkle"; private k = 1; private dur = 4400;
  constructor(private cv: HTMLCanvasElement) { this.ctx = cv.getContext("2d")!; this.resize(); }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = this.W * dpr; this.cv.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  stop() { cancelAnimationFrame(this.raf); this.parts = []; this.ctx.clearRect(0, 0, this.W, this.H); }
  private add(o: Partial<P>) { this.parts.push({ x: this.W / 2, y: this.H * 0.44, vx: 0, vy: 0, g: 0, life: 1, age: 0, s: 6, rot: 0, vr: 0, type: "c", col: "#fff", drag: 0.99, ...o }); }
  private burst(n: number, o: { sp?: number[]; type?: string; cols?: string[]; g?: number; s?: number[]; life?: number[]; x?: number; y?: number; drag?: number; vr?: number } = {}) {
    const { sp = [3, 12], type = "c", cols = COL.gold, g = 0.12, s = [3, 8], life = [1.2, 2.4], x = this.W / 2, y = this.H * 0.44, drag = 0.985, vr = 0.2 } = o;
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(sp[0], sp[1]); this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g, s: rnd(s[0], s[1]), life: rnd(life[0], life[1]), type, col: pick(cols), rot: rnd(0, 6.28), vr: rnd(-vr, vr), drag }); }
  }
  private rain(n: number, o: { type?: string; cols?: string[]; g?: number; s?: number[]; vy?: number[]; life?: number[]; drift?: number; top?: boolean; vr?: number } = {}) {
    const { type = "c", cols = COL.gold, g = 0.06, s = [3, 8], vy = [2, 5], life = [2.5, 4], drift = 1, top = true, vr = 0.1 } = o;
    for (let i = 0; i < n; i++) this.add({ x: rnd(0, this.W), y: top ? rnd(-40, -5) : rnd(this.H, this.H + 30), vx: rnd(-drift, drift), vy: top ? rnd(vy[0], vy[1]) : -rnd(vy[0], vy[1]), g: top ? g : -g * 0.2, s: rnd(s[0], s[1]), life: rnd(life[0], life[1]), type, col: pick(cols), rot: rnd(0, 6.28), vr: rnd(-vr, vr), drag: 1 });
  }
  private shell() {
    const x = rnd(this.W * 0.15, this.W * 0.85), y = rnd(this.H * 0.12, this.H * 0.5), cols = pick([COL.gold, COL.pink, COL.rainbow, COL.ice]);
    this.burst(Math.round(46 * this.k), { x, y, sp: [2, 7.5], type: "star", cols, g: 0.05, s: [3, 6], life: [1, 1.8], drag: 0.972 });
    this.burst(14, { x, y, sp: [0.5, 3], cols: ["#ffffff"], g: 0.03, s: [2, 4], life: [0.6, 1.1] });
  }
  private emit(t: number) {
    const k = this.k, W = this.W, H = this.H, lim = this.dur * 0.72;
    if (t > lim) return;
    switch (this.theme) {
      case "fireworks": if (Math.random() < 0.09 * k) this.shell(); break;
      case "coins": this.rain(Math.ceil(2 * k), { type: "coin", cols: COL.gold, s: [7, 12], g: 0.14, vy: [3, 7], drift: 2, vr: 0.25 }); break;
      case "hearts": this.rain(1, { type: "heart", cols: COL.pink, s: [9, 18], top: false, vy: [2, 5], drift: 1.4, g: 0.01, life: [2.5, 4] }); break;
      case "petals": this.rain(Math.ceil(2 * k), { type: "petal", cols: ["#ff3d5a", "#ff8aa0", "#c0123c", "#ffd0e8"], s: [6, 11], g: 0.03, vy: [1.2, 3], drift: 2, vr: 0.12 }); break;
      case "embers": this.rain(Math.ceil(3 * k), { cols: COL.fire, s: [2, 5], top: false, vy: [2, 6], drift: 1.5, g: 0.03, life: [1.2, 2.4] }); break;
      case "snow": this.rain(Math.ceil(2 * k), { type: "star", cols: COL.ice, s: [3, 7], g: 0.015, vy: [0.8, 2.4], drift: 1.2, life: [3, 5], vr: 0.06 }); break;
      case "gems": if (Math.random() < 0.5) this.burst(3, { x: rnd(W * 0.2, W * 0.8), y: rnd(H * 0.15, H * 0.7), type: "star", cols: COL.ice.concat(["#ffd0f0"]), sp: [0.4, 1.6], g: 0, s: [5, 12], life: [0.5, 1] }); break;
      case "gold": this.rain(Math.ceil(3 * k), { type: "conf", cols: COL.gold, s: [5, 10], g: 0.07, vy: [2, 5], drift: 2.5, vr: 0.3 }); if (Math.random() < 0.3) this.burst(2, { x: rnd(W * 0.2, W * 0.8), y: rnd(H * 0.2, H * 0.7), type: "star", cols: ["#fff6c0", "#ffffff"], sp: [0.2, 1], g: 0, s: [6, 12], life: [0.5, 0.9] }); break;
      case "confetti": this.rain(Math.ceil(4 * k), { type: "conf", cols: COL.rainbow.concat(COL.pink), s: [5, 10], g: 0.08, vy: [2, 6], drift: 3, vr: 0.3 }); break;
      case "bubbles": this.rain(Math.ceil(2 * k), { type: "bub", cols: ["#fff6c0", "#ffe27a"], s: [4, 11], top: false, vy: [1.5, 4], g: 0.01, drift: 1.2 }); break;
      case "magic": this.rain(Math.ceil(2 * k), { type: "star", cols: COL.rainbow.concat(COL.pink), s: [4, 9], g: 0.03, vy: [1, 3], drift: 2, life: [2, 3.5] }); if (Math.random() < 0.4) this.burst(2, { x: rnd(W * 0.1, W * 0.9), y: rnd(H * 0.1, H * 0.8), type: "star", cols: ["#ffffff"], sp: [0.2, 1], g: 0, s: [6, 11], life: [0.5, 0.9] }); break;
      case "cosmic": for (let i = 0; i < Math.ceil(3 * k); i++) this.add({ x: rnd(W * 0.2, W * 1.2), y: rnd(-60, H * 0.4), vx: -rnd(8, 16), vy: rnd(8, 16), s: rnd(1.5, 3), life: rnd(0.5, 0.9), type: "streak", col: pick(COL.cosmic), drag: 1 }); if (Math.random() < 0.5) this.burst(1, { x: rnd(0, W), y: rnd(0, H), type: "star", cols: COL.cosmic, sp: [0, 0.3], g: 0, s: [3, 8], life: [0.6, 1.2] }); break;
      case "aurora": this.rain(Math.ceil(2 * k), { type: "star", cols: COL.green, s: [3, 7], g: 0.02, vy: [0.8, 2.2], drift: 1.5, life: [3, 5] }); break;
      case "feathers": this.rain(Math.ceil(2 * k), { type: "feather", cols: COL.white, s: [9, 16], g: 0.012, vy: [0.8, 2], drift: 1.8, life: [4, 6], vr: 0.04 }); break;
      default: if (Math.random() < 0.6) this.burst(3, { x: rnd(W * 0.1, W * 0.9), y: rnd(H * 0.1, H * 0.8), type: "star", cols: COL.gold.concat(["#ffffff"]), sp: [0.3, 1.5], g: 0, s: [5, 12], life: [0.5, 1.1] });
    }
  }
  private draw(p: P) {
    const ctx = this.ctx, a = Math.max(0, Math.min(1, (1 - p.age / p.life) * (p.age < 0.15 ? p.age / 0.15 : 1)));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.col; ctx.strokeStyle = p.col; const s = p.s;
    switch (p.type) {
      case "c": ctx.shadowColor = p.col; ctx.shadowBlur = s * 2; ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.283); ctx.fill(); break;
      case "conf": ctx.scale(1, Math.cos(p.age * 9 + p.rot)); ctx.fillRect(-s / 2, -s, s, s * 2); break;
      case "star": ctx.shadowColor = p.col; ctx.shadowBlur = s * 1.5; ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s, an = (i * Math.PI) / 4; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); break;
      case "heart": ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.4, -s, 0, -s * 0.3); ctx.bezierCurveTo(s * 0.4, -s, s, -s * 0.5, 0, s * 0.95); ctx.closePath(); ctx.fill(); break;
      case "coin": { ctx.scale(Math.abs(Math.cos(p.age * 6 + p.rot)), 1); ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.283); ctx.fill(); ctx.strokeStyle = "#b8861c"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "#b8861c"; ctx.fillRect(-1, -s * 0.5, 2, s); break; }
      case "petal": ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.55, 0, 0, 6.283); ctx.fill(); break;
      case "feather": ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.28, 0, 0, 6.283); ctx.fill(); break;
      case "bub": ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, s, 0, 6.283); ctx.stroke(); ctx.globalAlpha = a * 0.25; ctx.fill(); break;
      case "streak": ctx.rotate(Math.atan2(p.vy, p.vx) - p.rot); ctx.lineWidth = p.s; ctx.lineCap = "round"; ctx.shadowColor = p.col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 3, -p.vy * 3); ctx.stroke(); break;
    }
    ctx.restore();
  }
  private frame = (now: number) => {
    const t = now - this.t0, dt = Math.min(0.033, (now - (this.last || now)) / 1000); this.last = now;
    this.ctx.clearRect(0, 0, this.W, this.H);
    this.emit(t);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.age += dt;
      if (p.age >= p.life || p.y > this.H + 60 || p.y < -80) { this.parts.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; this.draw(p);
    }
    if (t < this.dur) this.raf = requestAnimationFrame(this.frame); else this.ctx.clearRect(0, 0, this.W, this.H);
  };
  play(theme: string, level: GiftFxLevel, extend = false) {
    cancelAnimationFrame(this.raf); this.resize();
    if (!extend) this.parts = [];
    this.theme = theme; this.k = level === "full" ? 1 : 0.45; this.dur = level === "full" ? 4400 : 2600;
    const cols = theme === "embers" ? COL.fire : theme === "snow" ? COL.ice : theme === "cosmic" ? COL.cosmic : theme === "aurora" ? COL.green : theme === "magic" ? COL.rainbow : COL.gold;
    const heart = theme === "hearts" || theme === "petals";
    setTimeout(() => {
      this.burst(Math.round(90 * this.k), { sp: [3, 13], type: heart ? "heart" : "star", cols: heart ? COL.pink : cols, g: 0.12, s: [4, 10], life: [1, 2.2] });
      if (theme === "fireworks") { this.shell(); setTimeout(() => this.shell(), 300); setTimeout(() => this.shell(), 650); }
    }, 380);
    this.t0 = performance.now(); this.last = 0; this.raf = requestAnimationFrame(this.frame);
  }
}
