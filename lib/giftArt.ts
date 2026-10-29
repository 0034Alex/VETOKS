// Нарисованные подарки (SVG). Ключ = название подарка в gift_catalog.
// Лёгкие и Премиум — статичные, VIP — анимированные (CSS-классы ga-* в globals.css).

const L = (id: string, a: string, b: string, c?: string) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/>${c ? `<stop offset=".5" stop-color="${c}"/>` : ""}<stop offset="1" stop-color="${b}"/></linearGradient>`;
const R = (id: string, a: string, b: string, o = 1) =>
  `<radialGradient id="${id}" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${a}" stop-opacity="${o}"/><stop offset="1" stop-color="${b}" stop-opacity="${o === 1 ? 1 : 0}"/></radialGradient>`;

const COMMON =
  "<defs>" +
  L("gGd", "#fff0a8", "#8a5a10", "#e0b030") +
  L("gRd", "#ff7a8e", "#c0123c") +
  L("gPk", "#ffb0d0", "#e0306f") +
  L("gBl", "#d6f2ff", "#3a7be0", "#7fd0ff") +
  L("gGr", "#7fe0a0", "#1f8a52") +
  L("gPu", "#d2b0ff", "#6a3fd0") +
  L("gWh", "#ffffff", "#cfc9e6") +
  L("gOr", "#ffe27a", "#ff4a1f", "#ff9a2f") +
  L("gBr", "#e8b070", "#8a5222") +
  "</defs>";

const star = (cx: number, cy: number, Ro: number, ri: number, n = 5) => {
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? ri : Ro;
    p.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return "M" + p.join("L") + "Z";
};
const spark = (x: number, y: number, s: number, fill = "#fff", cls = "", delay = 0) =>
  `<path ${cls ? `class="${cls}" style="animation-delay:${delay}s"` : ""} d="M${x} ${y - s}L${x + s * 0.28} ${y - s * 0.28}L${x + s} ${y}L${x + s * 0.28} ${y + s * 0.28}L${x} ${y + s}L${x - s * 0.28} ${y + s * 0.28}L${x - s} ${y}L${x - s * 0.28} ${y - s * 0.28}Z" fill="${fill}"/>`;
const tw = (x: number, y: number, s: number, fill: string, d = 0) => spark(x, y, s, fill, "ga-tw", d);
const rot = (n: number, f: (i: number, a: number) => string) =>
  Array.from({ length: n }, (_, i) => f(i, (i * 360) / n)).join("");

const A: Record<string, string> = {};

/* ======================= ЛЁГКИЕ (20) ======================= */
A["Роза"] =
  `<defs>${R("ro1", "#ff8a9a", "#b5103a")}</defs>` +
  `<path d="M50 52C47 70 53 82 50 95" stroke="#2e9b5a" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M50 80C38 77 31 69 29 62C41 62 48 68 50 74Z" fill="#35b36a"/><path d="M51 72C62 70 69 64 71 57C60 58 53 63 51 68Z" fill="#2e9b5a"/>` +
  `<path d="M50 12C29 12 22 34 31 47C38 57 62 57 69 47C78 34 71 12 50 12Z" fill="url(#ro1)"/>` +
  `<path d="M50 19C39 21 37 34 45 39C52 43 61 39 61 30C61 24 56 19 50 19Z" fill="#dc1f4c"/>` +
  `<path d="M45 29C45 24 55 24 55 30C55 35 46 36 45 29Z" fill="#8f0c2e"/>` +
  `<path d="M35 24C37 20 42 17 47 16" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>`;

A["Сердце"] =
  `<path d="M50 88C16 64 8 42 17 27C26 13 45 17 50 31C55 17 74 13 83 27C92 42 84 64 50 88Z" fill="url(#gPk)"/>` +
  `<ellipse cx="30" cy="31" rx="9" ry="5.5" fill="#fff" fill-opacity=".55" transform="rotate(-35 30 31)"/><circle cx="39" cy="22" r="2.4" fill="#fff" fill-opacity=".8"/>`;

A["Искра"] =
  `<path d="M50 6L59 41L94 50L59 59L50 94L41 59L6 50L41 41Z" fill="url(#gGd)"/><path d="M50 6L59 41L50 50Z" fill="#fff" fill-opacity=".5"/>` +
  spark(82, 14, 10, "#fff0a8") + spark(18, 80, 8, "#ffd37a") + spark(86, 80, 5, "#fff");

A["Бабочка"] =
  `<defs>${L("bf1", "#e0b0ff", "#ff5fa8")}${L("bf2", "#7fd0ff", "#a070ff")}</defs>` +
  [0, 1].map((m) => `<g ${m ? 'transform="translate(100 0) scale(-1 1)"' : ""}><path d="M48 46C30 10 4 14 8 38C10 52 32 56 48 50Z" fill="url(#bf1)"/><path d="M48 52C28 52 16 66 24 80C32 92 46 76 48 60Z" fill="url(#bf2)"/><circle cx="26" cy="32" r="5" fill="#fff" fill-opacity=".7"/><circle cx="30" cy="72" r="3.5" fill="#fff" fill-opacity=".7"/></g>`).join("") +
  `<rect x="46" y="34" width="8" height="42" rx="4" fill="#3a2a55"/><path d="M48 36C44 24 38 20 34 20M52 36C56 24 62 20 66 20" stroke="#3a2a55" stroke-width="2" fill="none" stroke-linecap="round"/>`;

A["Цветок"] =
  rot(5, (_, a) => `<ellipse cx="50" cy="27" rx="13" ry="20" fill="url(#gPk)" transform="rotate(${a} 50 50)"/>`) +
  `<circle cx="50" cy="50" r="12" fill="url(#gGd)"/><circle cx="46" cy="46" r="3" fill="#fff" fill-opacity=".6"/>`;

A["Лента"] =
  `<path d="M50 48C38 26 10 22 12 44C14 62 38 60 50 50Z" fill="url(#gPk)"/><path d="M50 48C62 26 90 22 88 44C86 62 62 60 50 50Z" fill="url(#gPk)"/>` +
  `<path d="M44 54L28 90L42 82L48 94L54 58Z" fill="#d12a68"/><path d="M56 54L72 90L58 82L52 94L46 58Z" fill="#e0306f"/>` +
  `<rect x="42" y="38" width="16" height="18" rx="6" fill="url(#gRd)"/><path d="M20 38C26 34 34 36 40 42" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>`;

A["Плюшевый мишка"] =
  `<defs>${R("mi1", "#e2a86b", "#9a5f2a")}</defs>` +
  `<circle cx="30" cy="27" r="10" fill="url(#mi1)"/><circle cx="70" cy="27" r="10" fill="url(#mi1)"/><circle cx="30" cy="27" r="5" fill="#f2c9a0"/><circle cx="70" cy="27" r="5" fill="#f2c9a0"/>` +
  `<ellipse cx="50" cy="82" rx="21" ry="15" fill="url(#mi1)"/><ellipse cx="50" cy="84" rx="11" ry="9" fill="#f2c9a0"/><circle cx="50" cy="47" r="24" fill="url(#mi1)"/><ellipse cx="50" cy="55" rx="12" ry="9" fill="#f2c9a0"/>` +
  `<circle cx="41" cy="43" r="3" fill="#2b1a0c"/><circle cx="59" cy="43" r="3" fill="#2b1a0c"/><circle cx="42" cy="42" r="1" fill="#fff"/><circle cx="60" cy="42" r="1" fill="#fff"/>` +
  `<ellipse cx="50" cy="52" rx="4" ry="3" fill="#2b1a0c"/><path d="M50 55V58M45 59Q50 63 55 59" stroke="#2b1a0c" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
  `<path d="M58 74C58 70 63 70 63 74C63 78 58 81 58 81C58 81 53 78 53 74C53 70 58 70 58 74Z" fill="#e8365d"/>`;

A["Конфета"] =
  `<g transform="rotate(-25 50 50)"><path d="M28 50L6 34V66Z" fill="url(#gPk)"/><path d="M72 50L94 34V66Z" fill="url(#gPk)"/><ellipse cx="50" cy="50" rx="26" ry="20" fill="url(#gRd)"/>` +
  `<path d="M38 32C33 44 33 56 38 68M50 30V70M62 32C67 44 67 56 62 68" stroke="#fff" stroke-opacity=".5" stroke-width="4" fill="none"/><ellipse cx="42" cy="40" rx="9" ry="4" fill="#fff" fill-opacity=".45"/></g>`;

A["Мороженое"] =
  `<path d="M31 50L50 94L69 50Z" fill="#e8b868"/><path d="M36 56L62 66M40 70L60 78M64 56L38 68M58 52L44 82" stroke="#b9803a" stroke-width="1.6" fill="none"/>` +
  `<circle cx="50" cy="40" r="22" fill="url(#gPk)"/><path d="M28 44C28 56 34 52 38 58C42 52 46 60 50 56C54 60 58 52 62 58C66 52 72 56 72 44Z" fill="url(#gPk)"/>` +
  `<circle cx="50" cy="24" r="15" fill="#f6e0b0"/><ellipse cx="44" cy="19" rx="6" ry="3" fill="#fff" fill-opacity=".55"/><circle cx="50" cy="10" r="5.5" fill="url(#gRd)"/><path d="M52 6C54 1 58 0 60 2" stroke="#2e9b5a" stroke-width="1.6" fill="none"/>`;

A["Кофе"] =
  `<path d="M38 36C32 28 44 24 38 12M52 36C46 28 58 24 52 12" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  `<ellipse cx="46" cy="90" rx="36" ry="6" fill="#cfc9e6"/><path d="M72 52H78C90 52 90 72 76 72H70" stroke="url(#gWh)" stroke-width="6" fill="none" stroke-linecap="round"/>` +
  `<path d="M20 46H72V68C72 80 62 88 46 88C30 88 20 80 20 68Z" fill="url(#gWh)"/><ellipse cx="46" cy="46" rx="26" ry="6" fill="#6a3a1a"/>` +
  `<path d="M46 50C42 46 42 43 44 42C45 42 46 43 46 44C46 43 47 42 48 42C50 43 50 46 46 50Z" fill="#f6e0b0"/><path d="M28 58V74" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>` +
  `<path d="M20 60H72" stroke="#e0306f" stroke-width="5" opacity=".8"/>`;

const tulip = (x: number, y: number, s: number, f: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 8C0 40 2 60 0 90" stroke="#2e9b5a" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
  `<path d="M0 70C-14 66 -18 52 -16 44C-6 48 0 58 0 66Z" fill="#35b36a"/>` +
  `<path d="M-13 -2C-15 -18 -7 -28 0 -34C7 -28 15 -18 13 -2C9 10 -9 10 -13 -2Z" fill="${f}"/><path d="M0 -34C-4 -22 -4 -8 0 8C4 -8 4 -22 0 -34Z" fill="#fff" fill-opacity=".25"/></g>`;
A["Тюльпаны"] = tulip(24, 34, 0.62, "url(#gPk)") + tulip(76, 34, 0.62, "url(#gOr)") + tulip(50, 26, 0.72, "url(#gRd)");

A["Шарик"] =
  `<path d="M70 52C64 70 74 78 68 96" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none"/>` +
  `<ellipse cx="72" cy="34" rx="18" ry="22" fill="url(#gBl)"/><path d="M69 55L75 55L72 60Z" fill="#3a7be0"/><ellipse cx="66" cy="26" rx="4" ry="7" fill="#fff" fill-opacity=".5" transform="rotate(20 66 26)"/>` +
  `<path d="M34 66C28 78 40 84 32 98" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none"/>` +
  `<ellipse cx="34" cy="38" rx="25" ry="29" fill="url(#gRd)"/><path d="M30 66L38 66L34 73Z" fill="#c0123c"/><ellipse cx="25" cy="27" rx="5" ry="9" fill="#fff" fill-opacity=".5" transform="rotate(20 25 27)"/>`;

A["Диадема"] =
  `<path d="M12 80L10 40L30 60L40 28L50 56L60 28L70 60L90 40L88 80Z" fill="url(#gGd)"/><path d="M12 72C34 66 66 66 88 72L88 82C66 76 34 76 12 82Z" fill="#b8861c"/>` +
  `<circle cx="10" cy="38" r="5" fill="#fff"/><circle cx="40" cy="26" r="5" fill="#fff"/><circle cx="60" cy="26" r="5" fill="#fff"/><circle cx="90" cy="38" r="5" fill="#fff"/><circle cx="50" cy="54" r="6" fill="url(#gPk)"/>` +
  `<circle cx="30" cy="76" r="3.5" fill="#7fd0ff"/><circle cx="70" cy="76" r="3.5" fill="#7fd0ff"/><circle cx="50" cy="77" r="3.5" fill="#ff5fa8"/>`;

A["Подсолнух"] =
  rot(14, (_, a) => `<ellipse cx="50" cy="21" rx="7.5" ry="16" fill="url(#gOr)" transform="rotate(${a} 50 50)"/>`) +
  `<circle cx="50" cy="50" r="19" fill="#6a3a1a"/><circle cx="50" cy="50" r="19" fill="url(#gBr)" fill-opacity=".4"/>` +
  rot(8, (_, a) => `<circle cx="50" cy="40" r="2" fill="#2b1a0c" transform="rotate(${a} 50 50)"/>`) + rot(5, (_, a) => `<circle cx="50" cy="46" r="1.8" fill="#2b1a0c" transform="rotate(${a + 20} 50 50)"/>`) +
  `<circle cx="50" cy="50" r="2" fill="#2b1a0c"/>`;

A["Печенье"] =
  `<circle cx="50" cy="52" r="38" fill="url(#gBr)"/><circle cx="50" cy="52" r="38" fill="none" stroke="#8a5222" stroke-width="2"/>` +
  `<ellipse cx="34" cy="38" rx="6" ry="4.5" fill="#3a1f0c"/><ellipse cx="62" cy="34" rx="5" ry="4" fill="#3a1f0c"/><ellipse cx="68" cy="60" rx="6" ry="4.5" fill="#3a1f0c" transform="rotate(30 68 60)"/><ellipse cx="44" cy="64" rx="6" ry="4.5" fill="#3a1f0c" transform="rotate(-20 44 64)"/><ellipse cx="28" cy="58" rx="4" ry="3" fill="#3a1f0c"/><ellipse cx="52" cy="48" rx="4" ry="3" fill="#3a1f0c"/>` +
  `<path d="M22 36C26 28 34 22 44 20" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>`;

A["Радуга"] =
  ["#ff4a5a", "#ff9a2f", "#ffd93a", "#46c877", "#3a9bff", "#8a5cf0"]
    .map((c, i) => `<path d="M${12 + i * 5} 72A${38 - i * 5} ${38 - i * 5} 0 0 1 ${88 - i * 5} 72" stroke="${c}" stroke-width="5.2" fill="none"/>`).join("") +
  `<g fill="#fff"><circle cx="14" cy="76" r="8"/><circle cx="24" cy="72" r="9"/><circle cx="6" cy="78" r="6"/><circle cx="86" cy="76" r="8"/><circle cx="76" cy="72" r="9"/><circle cx="94" cy="78" r="6"/></g>`;

A["Капкейк"] =
  `<path d="M24 54L31 92H69L76 54Z" fill="url(#gPu)"/><path d="M34 56L38 92M46 56V92M58 56L62 92" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>` +
  `<path d="M18 58C10 44 28 40 32 36C28 22 44 20 50 12C56 20 72 22 68 36C72 40 90 44 82 58Z" fill="url(#gPk)"/><path d="M30 46C40 42 60 42 70 46" stroke="#fff" stroke-opacity=".4" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  `<circle cx="50" cy="10" r="6" fill="url(#gRd)"/><circle cx="36" cy="38" r="1.8" fill="#fff0a8"/><circle cx="62" cy="40" r="1.8" fill="#7fd0ff"/><circle cx="50" cy="30" r="1.8" fill="#fff"/>`;

A["Леденец"] = (() => {
  let d = "";
  for (let i = 0; i <= 90; i++) { const t = i / 90, ang = t * Math.PI * 6.4, r = 2 + t * 25; d += (i ? "L" : "M") + (50 + r * Math.cos(ang)).toFixed(1) + " " + (36 + r * Math.sin(ang)).toFixed(1); }
  return `<rect x="47" y="58" width="6" height="40" rx="3" fill="#f3e6c4"/><circle cx="50" cy="36" r="30" fill="#fff"/><path d="${d}" stroke="url(#gRd)" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="50" cy="36" r="30" fill="none" stroke="url(#gPk)" stroke-width="3"/><ellipse cx="34" cy="20" rx="6" ry="3" fill="#fff" fill-opacity=".8" transform="rotate(-35 34 20)"/>`;
})();

A["Колокольчик"] =
  `<path d="M50 10C56 10 58 14 58 18C70 24 74 38 74 54L84 68H16L26 54C26 38 30 24 42 18C42 14 44 10 50 10Z" fill="url(#gGd)"/>` +
  `<path d="M36 30C32 40 32 50 34 60" stroke="#fff" stroke-opacity=".5" stroke-width="3.5" fill="none" stroke-linecap="round"/><rect x="14" y="66" width="72" height="7" rx="3.5" fill="#b8861c"/>` +
  `<circle cx="50" cy="80" r="8" fill="url(#gGd)"/><path d="M50 10C42 4 34 8 38 14M50 10C58 4 66 8 62 14" stroke="#e0306f" stroke-width="3" fill="none" stroke-linecap="round"/>`;

A["Воздушный поцелуй"] =
  `<path d="M8 50C22 32 40 32 50 41C60 32 78 32 92 50C78 56 62 56 50 54C38 56 22 56 8 50Z" fill="url(#gRd)"/>` +
  `<path d="M8 50C26 60 40 57 50 55C60 57 74 60 92 50C82 78 62 84 50 84C38 84 18 78 8 50Z" fill="url(#gPk)"/><path d="M8 50C22 56 38 54 50 54C62 54 78 56 92 50" stroke="#8f0c2e" stroke-width="2" fill="none"/>` +
  `<ellipse cx="34" cy="38" rx="9" ry="3" fill="#fff" fill-opacity=".45" transform="rotate(-12 34 38)"/><ellipse cx="42" cy="68" rx="9" ry="3.5" fill="#fff" fill-opacity=".4"/>` +
  `<path d="M82 14C82 10 87 10 87 14C87 18 82 21 82 21C82 21 77 18 77 14C77 10 82 10 82 14Z" fill="#ff5fa8"/>`;

/* ======================= ПРЕМИУМ (20) ======================= */
A["Кристалл"] =
  `<path d="M26 40L36 30V74L26 82L16 74V50Z" fill="url(#gPu)"/><path d="M26 40L26 82L16 74V50Z" fill="#fff" fill-opacity=".18"/>` +
  `<path d="M74 44L84 36V70L74 80L64 70V54Z" fill="url(#gPu)"/><path d="M74 44L74 80L64 70V54Z" fill="#fff" fill-opacity=".18"/>` +
  `<path d="M50 6L68 22V72L50 92L32 72V22Z" fill="url(#gBl)"/><path d="M50 6L50 92L32 72V22Z" fill="#fff" fill-opacity=".35"/><path d="M32 22L50 38L68 22M50 38V92" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" fill="none"/>` +
  spark(80, 16, 7) + spark(18, 22, 5);

A["Бриллиант"] =
  `<path d="M26 34H74L90 52L50 92L10 52Z" fill="url(#gBl)"/><path d="M10 52H90M26 34L36 52L50 92L64 52L74 34M36 52L50 34L64 52" stroke="#fff" stroke-opacity=".8" stroke-width="1.5" fill="none"/>` +
  `<path d="M26 34L36 52L10 52Z" fill="#fff" fill-opacity=".6"/><path d="M50 34L64 52L36 52Z" fill="#fff" fill-opacity=".35"/>` + spark(84, 20, 9) + spark(14, 24, 5) + spark(90, 78, 4);

A["Туфелька"] =
  `<path d="M12 36C20 32 32 34 36 44C40 56 54 62 72 62C86 62 94 68 92 76C84 82 40 82 32 78C22 74 16 56 12 36Z" fill="url(#gRd)"/>` +
  `<path d="M16 50L24 94H31L35 70Z" fill="#8f0c2e"/><path d="M32 78C50 84 82 82 92 76" stroke="#5a0a20" stroke-width="3" fill="none"/>` +
  `<path d="M16 38C26 36 32 40 36 48" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="70" cy="62" r="5" fill="url(#gGd)"/>` + spark(88, 36, 6);

A["Звезда"] =
  `<path d="${star(50, 54, 44, 19)}" fill="url(#gGd)"/><path d="${star(50, 54, 44, 19)}" fill="none" stroke="#fff3b0" stroke-width="1.5" stroke-opacity=".8"/>` +
  `<path d="M50 54L50 10L58 38Z" fill="#fff" fill-opacity=".4"/><path d="M50 54L8 42L38 40Z" fill="#fff" fill-opacity=".28"/><path d="M50 54L24 90L36 64Z" fill="#000" fill-opacity=".12"/>` + spark(88, 16, 7) + spark(12, 80, 5);

A["Кубок"] =
  `<path d="M26 22C8 22 8 50 30 52M74 22C92 22 92 50 70 52" stroke="url(#gGd)" stroke-width="6" fill="none"/>` +
  `<path d="M24 12H76V40C76 58 64 68 50 68C36 68 24 58 24 40Z" fill="url(#gGd)"/><path d="M34 18C32 32 34 46 40 56" stroke="#fff" stroke-opacity=".5" stroke-width="4" fill="none" stroke-linecap="round"/>` +
  `<path d="${star(50, 38, 12, 5)}" fill="#fff3b0"/><rect x="43" y="66" width="14" height="14" fill="url(#gGd)"/><rect x="28" y="80" width="44" height="12" rx="4" fill="#b8861c"/><rect x="28" y="80" width="44" height="4" rx="2" fill="#fff0a8" fill-opacity=".6"/>`;

A["Золотая корона"] =
  `<path d="M14 76L9 32L32 52L50 18L68 52L91 32L86 76Z" fill="url(#gGd)"/><rect x="14" y="74" width="72" height="12" rx="4" fill="#b8861c"/><rect x="14" y="74" width="72" height="4" rx="2" fill="#fff0a8" fill-opacity=".6"/>` +
  `<circle cx="9" cy="30" r="4.5" fill="#fff0a8"/><circle cx="50" cy="16" r="5" fill="#fff0a8"/><circle cx="91" cy="30" r="4.5" fill="#fff0a8"/><circle cx="50" cy="80" r="4.5" fill="#e0204a"/><circle cx="31" cy="80" r="3.5" fill="#3a8be8"/><circle cx="69" cy="80" r="3.5" fill="#2fc07a"/>` +
  `<path d="M32 52L25 70M68 52L75 70M50 18L50 64" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none"/>`;

A["Бутылка шампанского"] =
  `<rect x="44" y="8" width="12" height="14" rx="3" fill="#f3e6c4"/><rect x="43" y="18" width="14" height="22" fill="url(#gGd)"/>` +
  `<path d="M43 40C43 40 34 46 34 58V88C34 91 36 93 39 93H61C64 93 66 91 66 88V58C66 46 57 40 57 40Z" fill="#0f6a44"/><path d="M43 40C43 40 34 46 34 58V88C34 91 36 93 39 93H61C64 93 66 91 66 88V58C66 46 57 40 57 40Z" fill="url(#gGr)" fill-opacity=".5"/>` +
  `<rect x="36" y="62" width="28" height="20" rx="3" fill="#f6ecd2"/><circle cx="50" cy="72" r="6" fill="none" stroke="#c9a52f" stroke-width="2"/><path d="M47 72L50 69L53 72L50 75Z" fill="#c9a52f"/><path d="M40 50V86" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="28" cy="28" r="2.5" fill="#fff" fill-opacity=".7"/><circle cx="74" cy="20" r="3" fill="#fff" fill-opacity=".7"/><circle cx="70" cy="38" r="2" fill="#fff" fill-opacity=".7"/><circle cx="22" cy="46" r="2" fill="#fff" fill-opacity=".6"/>`;

A["Кольцо"] =
  `<circle cx="50" cy="66" r="22" fill="none" stroke="url(#gGd)" stroke-width="8"/><circle cx="50" cy="66" r="22" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-dasharray="20 120" transform="rotate(-120 50 66)"/>` +
  `<path d="M38 22H62L72 34L50 56L28 34Z" fill="url(#gBl)"/><path d="M28 34H72M38 22L42 34L50 56L58 34L62 22M42 34L50 22L58 34" stroke="#fff" stroke-opacity=".8" stroke-width="1.2" fill="none"/>` +
  `<path d="M38 22L42 34L28 34Z" fill="#fff" fill-opacity=".6"/>` + spark(84, 18, 8) + spark(14, 54, 5);

A["Духи"] =
  `<rect x="26" y="40" width="48" height="50" rx="12" fill="url(#gPk)"/><rect x="26" y="40" width="48" height="50" rx="12" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>` +
  `<rect x="42" y="30" width="16" height="12" fill="#cfc9e6"/><rect x="36" y="12" width="28" height="20" rx="6" fill="url(#gGd)"/><path d="M40 16H48" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>` +
  `<path d="M50 78C42 72 40 66 44 62C47 60 50 62 50 64C50 62 53 60 56 62C60 66 58 72 50 78Z" fill="#fff" fill-opacity=".85"/><path d="M33 50C32 60 32 70 34 80" stroke="#fff" stroke-opacity=".5" stroke-width="3.5" fill="none" stroke-linecap="round"/>` +
  `<g fill="#fff" fill-opacity=".7"><circle cx="82" cy="22" r="2.5"/><circle cx="90" cy="32" r="2"/><circle cx="84" cy="40" r="1.8"/></g>`;

A["Золотая роза"] =
  `<path d="M50 52C47 70 53 82 50 95" stroke="url(#gGd)" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M50 80C38 77 31 69 29 62C41 62 48 68 50 74Z" fill="url(#gGd)"/><path d="M51 72C62 70 69 64 71 57C60 58 53 63 51 68Z" fill="#c9a52f"/>` +
  `<path d="M50 12C29 12 22 34 31 47C38 57 62 57 69 47C78 34 71 12 50 12Z" fill="url(#gGd)"/><path d="M50 19C39 21 37 34 45 39C52 43 61 39 61 30C61 24 56 19 50 19Z" fill="#e0b030"/><path d="M45 29C45 24 55 24 55 30C55 35 46 36 45 29Z" fill="#8a5a10"/>` +
  `<path d="M35 24C37 20 42 17 47 16" stroke="#fff" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>` + spark(82, 20, 8, "#fff0a8") + spark(18, 62, 5, "#fff0a8");

A["Сумочка"] =
  `<path d="M32 46C32 14 68 14 68 46" stroke="url(#gGd)" stroke-width="5" fill="none" stroke-linecap="round"/>` +
  `<path d="M14 44H86L92 88C92 92 90 94 86 94H14C10 94 8 92 8 88Z" fill="url(#gPu)"/><path d="M14 44H86L88 60C70 70 30 70 12 60Z" fill="#fff" fill-opacity=".14"/>` +
  `<circle cx="50" cy="66" r="7" fill="url(#gGd)"/><circle cx="50" cy="66" r="2.5" fill="#8a5a10"/><path d="M18 52L16 84" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>`;

A["Торт"] =
  `<ellipse cx="50" cy="90" rx="42" ry="6" fill="#cfc9e6"/><rect x="14" y="58" width="72" height="30" rx="7" fill="#f6e0b0"/><rect x="14" y="76" width="72" height="12" rx="6" fill="#8a5222" fill-opacity=".5"/>` +
  `<path d="M14 62C14 46 86 46 86 62C86 70 82 64 78 70C74 76 70 66 66 70C62 74 58 64 54 68C50 72 46 64 42 68C38 72 34 64 30 70C26 74 22 66 18 70C16 70 14 66 14 62Z" fill="url(#gPk)"/>` +
  `<rect x="47" y="26" width="6" height="22" rx="2" fill="#fff"/><path d="M50 14C54 20 56 22 54 26C53 28 51 28 50 26C49 28 47 28 46 26C45 22 48 20 50 14Z" fill="url(#gOr)"/>` +
  `<circle cx="28" cy="48" r="5" fill="url(#gRd)"/><circle cx="72" cy="48" r="5" fill="url(#gRd)"/><circle cx="50" cy="54" r="4" fill="url(#gRd)"/>`;

A["Жемчуг"] = (() => {
  let s = `<defs>${R("pe1", "#ffffff", "#bfb8d6")}</defs>`;
  for (let i = 0; i <= 11; i++) {
    const t = i / 11, x = 10 + 80 * t, y = 20 + 52 * (1 - (2 * t - 1) ** 2);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" fill="url(#pe1)"/>`;
  }
  return s + `<path d="M50 84C44 78 44 74 50 72C56 74 56 78 50 84Z" fill="url(#gBl)"/><path d="M50 72V68" stroke="#c9a52f" stroke-width="2"/><path d="M12 16L8 8M88 16L92 8" stroke="url(#gGd)" stroke-width="3" stroke-linecap="round"/>` + spark(80, 90, 5) + spark(20, 90, 4);
})();

A["Скрипка"] =
  `<g transform="rotate(-24 50 54)"><rect x="46" y="4" width="8" height="40" rx="3" fill="#3a1f0c"/><circle cx="50" cy="6" r="5" fill="#5a2f10"/>` +
  `<path d="M50 38C34 38 30 50 36 58C26 62 24 76 33 84C42 94 58 94 67 84C76 76 74 62 64 58C70 50 66 38 50 38Z" fill="url(#gBr)"/><path d="M50 38C34 38 30 50 36 58C26 62 24 76 33 84C42 94 58 94 67 84C76 76 74 62 64 58C70 50 66 38 50 38Z" fill="none" stroke="#5a2f10" stroke-width="2"/>` +
  `<path d="M41 62C38 68 40 74 44 78M59 62C62 68 60 74 56 78" stroke="#3a1f0c" stroke-width="2.4" fill="none" stroke-linecap="round"/><rect x="43" y="76" width="14" height="3" rx="1.5" fill="#3a1f0c"/><path d="M48 8V76M52 8V76" stroke="#f6e0b0" stroke-width=".8"/></g>` +
  `<path d="M86 24L20 90" stroke="#5a2f10" stroke-width="3" stroke-linecap="round"/><path d="M84 28L24 88" stroke="#fff" stroke-opacity=".8" stroke-width="1.2"/>`;

A["Шкатулка"] =
  `<rect x="14" y="52" width="72" height="38" rx="8" fill="url(#gPu)"/><path d="M12 54C12 30 88 30 88 54Z" fill="url(#gGd)"/><path d="M22 48C34 38 66 38 78 48" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/>` +
  `<rect x="43" y="50" width="14" height="16" rx="4" fill="#b8861c"/><circle cx="50" cy="57" r="3.5" fill="url(#gRd)"/><rect x="14" y="52" width="72" height="5" fill="#b8861c"/>` + spark(78, 14, 9, "#bfe9ff") + spark(24, 20, 6, "#fff") + spark(88, 40, 4, "#ffd0e8");

A["Веер"] = (() => {
  let s = "";
  const cx = 50, cy = 88, r = 54;
  for (let i = 0; i < 6; i++) {
    const a1 = (-60 + i * 20) * Math.PI / 180, a2 = (-60 + (i + 1) * 20) * Math.PI / 180;
    const x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1), x2 = cx + r * Math.sin(a2), y2 = cy - r * Math.cos(a2);
    s += `<path d="M${cx} ${cy}L${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}Z" fill="${i % 2 ? "url(#gPk)" : "url(#gPu)"}" stroke="#fff3b0" stroke-width="1.5"/>`;
  }
  return s + `<path d="M${cx + r * Math.sin(-60 * Math.PI / 180)} ${cy - r * Math.cos(-60 * Math.PI / 180)}A${r} ${r} 0 0 1 ${cx + r * Math.sin(60 * Math.PI / 180)} ${cy - r * Math.cos(60 * Math.PI / 180)}" stroke="url(#gGd)" stroke-width="4" fill="none"/><circle cx="50" cy="88" r="6" fill="url(#gGd)"/>`;
})();

A["Вечернее платье"] =
  `<path d="M40 6L44 16H56L60 6L68 30L60 46L86 94H14L40 46L32 30Z" fill="url(#gRd)"/><path d="M32 30L40 46H60L68 30" fill="#fff" fill-opacity=".1"/>` +
  `<path d="M38 48H62L60 56H40Z" fill="url(#gGd)"/><path d="M42 58L30 92M50 58V94M58 58L70 92" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none"/>` +
  `<path d="M46 20C46 16 54 16 54 20" stroke="#fff3b0" stroke-width="2" fill="none"/>` + spark(80, 30, 6, "#fff0a8") + spark(20, 70, 4, "#fff0a8");

A["Золотая маска"] =
  `<path d="M70 22C76 6 92 4 94 14C84 12 82 20 82 28C86 18 98 18 96 26C90 24 86 30 84 36Z" fill="url(#gPu)"/>` +
  `<path d="M6 42C20 30 36 36 50 40C64 36 80 30 94 42C94 58 80 68 66 62C58 59 56 52 50 52C44 52 42 59 34 62C20 68 6 58 6 42Z" fill="url(#gGd)"/>` +
  `<ellipse cx="30" cy="48" rx="11" ry="6" fill="#0d0b16" transform="rotate(14 30 48)"/><ellipse cx="70" cy="48" rx="11" ry="6" fill="#0d0b16" transform="rotate(-14 70 48)"/>` +
  `<path d="M14 40C22 36 30 38 38 40M62 40C70 38 78 36 86 40" stroke="#fff" stroke-opacity=".6" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="50" cy="40" r="4" fill="url(#gRd)"/>`;

A["Сердце с ключом"] =
  `<path d="M44 90C12 66 6 44 14 30C22 17 40 20 44 34C48 20 66 17 74 30C82 44 76 66 44 90Z" fill="url(#gRd)"/><ellipse cx="26" cy="34" rx="8" ry="5" fill="#fff" fill-opacity=".5" transform="rotate(-35 26 34)"/>` +
  `<g transform="rotate(35 70 64)"><circle cx="70" cy="40" r="11" fill="none" stroke="url(#gGd)" stroke-width="6"/><rect x="67" y="50" width="6" height="40" rx="2" fill="url(#gGd)"/><rect x="73" y="72" width="10" height="5" fill="url(#gGd)"/><rect x="73" y="82" width="8" height="5" fill="url(#gGd)"/></g>` +
  `<circle cx="38" cy="56" r="5" fill="#5a0a20"/><path d="M36 58L40 70H36Z" fill="#5a0a20"/>`;

A["Букет роз"] = (() => {
  const P: [number, number, number][] = [[50,20,13],[30,28,12],[70,28,12],[18,44,11],[40,40,12],[60,40,12],[82,44,11],[28,56,11],[50,54,12],[72,56,11]];
  let s = `<defs>${R("bq1", "#ff7a8e", "#a30d33")}</defs>`;
  s += `<path d="M10 52L50 98L90 52Z" fill="url(#gPk)"/><path d="M10 52L50 98L50 52Z" fill="#fff" fill-opacity=".2"/><path d="M20 62L80 62" stroke="url(#gGd)" stroke-width="4"/>`;
  s += `<path d="M8 46C14 40 26 44 24 50M92 46C86 40 74 44 76 50M44 14C44 6 54 6 56 12" stroke="#2e9b5a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  P.forEach(([x, y, r]) => (s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bq1)"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#c0123c"/><path d="M${x - r * 0.3} ${y - r * 0.1}C${x - r * 0.1} ${y - r * 0.4} ${x + r * 0.3} ${y - r * 0.2} ${x + r * 0.2} ${y + r * 0.1}" stroke="#8f0c2e" stroke-width="1.6" fill="none"/>`));
  s += `<path d="M42 56C50 66 50 66 58 56" stroke="url(#gGd)" stroke-width="5" fill="none"/><path d="M50 62L40 72L50 68L60 72Z" fill="url(#gGd)"/>`;
  return s;
})();

/* ======================= VIP, АНИМИРОВАННЫЕ (20) ======================= */
A["Созвездие"] =
  `<defs>${R("cs1", "#7a5cf0", "#7a5cf0", 0.5)}</defs><circle class="ga-gl" cx="50" cy="52" r="46" fill="url(#cs1)"/>` +
  `<path class="ga-gl" d="M12 72L32 48L52 62L68 28L88 44L76 84L52 62" stroke="#c9b8ff" stroke-width="1.8" fill="none" stroke-linejoin="round"/>` +
  tw(12, 72, 6, "#fff0a8", 0) + tw(32, 48, 8, "#fff", 0.3) + tw(52, 62, 9, "#ffd54a", 0.6) + tw(68, 28, 10, "#fff", 0.9) + tw(88, 44, 7, "#7fd0ff", 1.2) + tw(76, 84, 7, "#ff9ad0", 0.4) +
  `<circle class="ga-tw" cx="20" cy="22" r="1.8" fill="#fff"/><circle class="ga-tw" style="animation-delay:.7s" cx="84" cy="14" r="1.8" fill="#fff"/><circle class="ga-tw" style="animation-delay:1s" cx="40" cy="90" r="1.6" fill="#fff"/>`;

A["Алмаз"] =
  `<defs>${R("al2", "#8fe0ff", "#8fe0ff", 0.7)}</defs><circle class="ga-gl" cx="50" cy="52" r="38" fill="url(#al2)"/>` +
  `<g class="ga-pu"><path d="M32 34H68L80 48L50 84L20 48Z" fill="url(#gBl)"/><path d="M20 48H80M32 34L38 48L50 84L62 48L68 34M38 48L50 34L62 48" stroke="#fff" stroke-opacity=".8" stroke-width="1.4" fill="none"/><path d="M32 34L38 48L20 48Z" fill="#fff" fill-opacity=".6"/></g>` +
  `<path class="ga-rain" d="M14 8L18 12L14 18L10 12Z" fill="#9fe6ff"/><path class="ga-rain" style="animation-delay:.6s" d="M84 6L88 10L84 16L80 10Z" fill="#c8f0ff"/><path class="ga-rain" style="animation-delay:1.2s" d="M30 4L33 7L30 12L27 7Z" fill="#7fd0ff"/><path class="ga-rain" style="animation-delay:1.8s" d="M70 2L73 5L70 10L67 5Z" fill="#fff"/>` +
  tw(80, 26, 6, "#fff", 0) + tw(20, 62, 5, "#fff", 0.7);

A["Императорская корона"] =
  `<defs>${R("ic1", "#ffd54a", "#ffd54a", 0.75)}</defs><circle class="ga-gl" cx="50" cy="50" r="46" fill="url(#ic1)"/>` +
  `<g class="ga-fy"><path d="M12 74L6 30L30 50L50 14L70 50L94 30L88 74Z" fill="url(#gGd)"/><rect x="10" y="70" width="80" height="16" rx="5" fill="#fff"/><rect x="10" y="70" width="80" height="16" rx="5" fill="url(#gWh)"/>` +
  [18, 34, 50, 66, 82].map((x) => `<circle cx="${x}" cy="78" r="2.4" fill="#2b1a3a"/>`).join("") +
  `<circle cx="50" cy="10" r="6" fill="url(#gGd)"/><path d="M50 2V18M44 8H56" stroke="#fff0a8" stroke-width="2"/><circle cx="50" cy="52" r="6.5" fill="url(#gRd)"/><circle cx="30" cy="58" r="4.5" fill="#3a8be8"/><circle cx="70" cy="58" r="4.5" fill="#2fc07a"/><circle cx="6" cy="28" r="4.5" fill="#fff0a8"/><circle cx="94" cy="28" r="4.5" fill="#fff0a8"/><path d="M30 50L24 66M70 50L76 66" stroke="#fff" stroke-opacity=".35" stroke-width="2"/></g>` +
  tw(14, 14, 8, "#fff", 0) + tw(88, 12, 7, "#fff0a8", 0.5) + tw(94, 62, 5, "#fff", 1) + tw(8, 62, 5, "#fff0a8", 0.8);

A["Лебедь"] =
  `<defs>${R("lb1", "#7fd0ff", "#7fd0ff", 0.4)}</defs>` +
  `<g class="ga-fy">` +
  `<path d="M72 56C90 48 84 18 66 20" stroke="url(#gWh)" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="64" cy="20" r="7" fill="#fff"/><path d="M58 18L46 23L58 25Z" fill="url(#gOr)"/><circle cx="64" cy="18" r="1.6" fill="#2b1a3a"/>` +
  `<path d="M10 62C10 50 30 48 46 54C58 58 70 56 78 46C84 66 74 82 46 82C26 82 10 76 10 62Z" fill="url(#gWh)"/><path d="M24 62C34 58 48 62 58 70" stroke="#b8b0d8" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M30 68C40 66 50 70 58 76" stroke="#b8b0d8" stroke-width="2" fill="none" stroke-linecap="round"/></g>` +
  `<ellipse class="ga-rip" cx="46" cy="88" rx="34" ry="5" fill="none" stroke="#7fd0ff" stroke-width="2"/><ellipse class="ga-rip" style="animation-delay:.9s" cx="46" cy="88" rx="34" ry="5" fill="none" stroke="#bfe9ff" stroke-width="1.6"/>` +
  tw(86, 70, 6, "#fff", 0) + tw(16, 30, 7, "#fff0a8", 0.6) + tw(90, 30, 4, "#fff", 1.1);

const castle = (w1: string, w2: string, roof: string, fx: string) =>
  `<defs>${L("cw", w1, w2)}${L("cr", roof, "#4a2a9a")}</defs>` + fx +
  `<rect x="8" y="86" width="84" height="7" rx="3.5" fill="#2e2558"/>` +
  `<rect x="34" y="54" width="32" height="34" fill="url(#cw)"/><rect x="42" y="38" width="16" height="18" fill="url(#cw)"/><path d="M38 40L50 12L62 40Z" fill="url(#cr)"/>` +
  `<rect x="12" y="58" width="18" height="30" fill="url(#cw)"/><path d="M10 60L21 36L32 60Z" fill="url(#cr)"/><rect x="70" y="58" width="18" height="30" fill="url(#cw)"/><path d="M68 60L79 36L90 60Z" fill="url(#cr)"/>` +
  `<path d="M50 12V2" stroke="#fff0a8" stroke-width="1.6"/><path class="ga-sw" d="M50 2L62 6L50 10Z" fill="#ff5fa8" style="transform-origin:50px 6px"/>` +
  `<path d="M44 88V74C44 66 56 66 56 74V88Z" fill="url(#gGd)"/>` +
  [[48, 44], [21, 66], [79, 66], [38, 62], [58, 62], [21, 78], [79, 78]].map(([x, y], i) => `<rect class="ga-tw" style="animation-delay:${(i * 0.37).toFixed(2)}s" x="${x - 2.5}" y="${y - 3}" width="5" height="7" rx="2" fill="#ffe27a"/>`).join("");

A["Дворец"] = castle("#fff3fa", "#e5b8da", "#c9a0ff",
  `<g class="ga-ray" style="stroke:#ffd54a;stroke-width:2.4"><path d="M16 22V8M16 22V36M16 22H2M16 22H30M16 22L6 12M16 22L26 32M16 22L26 12M16 22L6 32"/></g>` +
  `<g class="ga-ray" style="stroke:#ff5e8a;stroke-width:2.4;animation-delay:1.1s"><path d="M86 18V6M86 18V30M86 18H74M86 18H98M86 18L78 10M86 18L94 26M86 18L94 10M86 18L78 26"/></g>`);

A["Хрустальный замок"] = castle("#f2fbff", "#8fd0ff", "#7fd0ff",
  `<defs>${R("cc1", "#8fe0ff", "#8fe0ff", 0.55)}</defs><circle class="ga-gl" cx="50" cy="52" r="48" fill="url(#cc1)"/>` +
  tw(14, 20, 8, "#fff", 0) + tw(88, 24, 7, "#bfe9ff", 0.6) + tw(90, 52, 4, "#fff", 1.1) + tw(10, 48, 4, "#bfe9ff", 0.3));

A["Вселенная"] =
  `<defs>${R("un1", "#fff6c0", "#ff9a2f", 1)}${R("un2", "#a070ff", "#a070ff", 0.55)}</defs><circle class="ga-gl" cx="50" cy="50" r="48" fill="url(#un2)"/>` +
  `<g class="ga-sp"><ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke="#8a5cf0" stroke-width="5" stroke-linecap="round" stroke-dasharray="70 120" transform="rotate(30 50 50)"/><ellipse cx="50" cy="50" rx="34" ry="12" fill="none" stroke="#ff7fc0" stroke-width="4" stroke-linecap="round" stroke-dasharray="60 100" transform="rotate(150 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="14" fill="none" stroke="#7fd0ff" stroke-width="3" stroke-linecap="round" stroke-dasharray="50 130" transform="rotate(90 50 50)"/></g>` +
  `<circle class="ga-pu" cx="50" cy="50" r="11" fill="url(#un1)"/>` + tw(14, 20, 6, "#fff", 0) + tw(86, 18, 7, "#fff0a8", 0.5) + tw(88, 82, 5, "#fff", 1) + tw(12, 84, 5, "#bfe9ff", 0.8) + `<circle class="ga-tw" cx="70" cy="88" r="1.6" fill="#fff"/><circle class="ga-tw" style="animation-delay:.6s" cx="28" cy="10" r="1.6" fill="#fff"/>`;

const wing = `<path d="M44 46C26 46 10 36 2 14C14 22 26 22 34 20C30 28 36 36 44 38Z" fill="url(#gRd)"/><path d="M44 44C30 44 18 38 10 26C20 30 30 30 38 28C36 34 40 40 44 42Z" fill="url(#gOr)"/><path d="M44 42C34 42 26 38 20 32C28 34 36 34 40 34C40 38 42 40 44 40Z" fill="#ffe27a"/>`;
A["Феникс"] =
  `<defs>${R("ph1", "#ff9a2f", "#ff4a1f", 0.7)}</defs><circle class="ga-gl" cx="50" cy="52" r="46" fill="url(#ph1)"/>` +
  [0, -26, 26].map((r, i) => `<path class="ga-fl" style="animation-delay:${i * 0.25}s;transform-origin:50% 0%" transform="rotate(${r} 50 60)" d="M50 60C40 74 36 86 44 98C46 90 50 88 50 82C50 88 54 90 56 98C64 86 60 74 50 60Z" fill="url(#gOr)"/>`).join("") +
  `<g class="ga-wf" style="transform-box:view-box;transform-origin:44px 44px">${wing}</g><g transform="translate(100 0) scale(-1 1)"><g class="ga-wf" style="transform-box:view-box;transform-origin:44px 44px">${wing}</g></g>` +
  `<path d="M50 28C60 28 62 44 58 54C56 66 44 66 42 54C38 44 40 28 50 28Z" fill="url(#gOr)"/><circle cx="50" cy="26" r="8" fill="#ffb347"/><path d="M57 27L66 31L57 33Z" fill="#ffe27a"/><circle cx="52" cy="24" r="1.8" fill="#2b1a3a"/>` +
  `<path class="ga-fl" d="M46 20C43 12 50 8 49 2C54 8 57 13 54 20Z" fill="url(#gOr)"/>`;

A["Дракон"] =
  `<defs>${L("dr1", "#7fe0a0", "#0f6a44")}</defs>` +
  `<g class="ga-fl" style="transform-origin:0% 50%"><path d="M62 54C72 46 82 50 96 44C94 54 90 62 98 70C84 68 74 66 62 62Z" fill="url(#gOr)"/><path d="M66 56C74 52 84 54 92 52C90 58 88 62 92 66C82 64 74 62 66 60Z" fill="#ffe27a"/></g>` +
  `<path d="M14 80C8 62 14 44 30 34L34 10L46 26C58 24 70 30 72 42C74 50 70 58 62 58L66 66C54 70 50 82 36 86C26 88 18 86 14 80Z" fill="url(#dr1)"/>` +
  `<path d="M30 34L34 10L46 26Z" fill="#ffd54a"/><path d="M34 38L38 20L44 30Z" fill="#c9a52f"/><path d="M60 42L56 52L66 50Z" fill="#fff" fill-opacity=".9"/><path d="M62 58L58 64L68 60Z" fill="#fff"/>` +
  `<ellipse cx="50" cy="40" rx="6" ry="4" fill="#ffd54a" transform="rotate(20 50 40)"/><ellipse class="ga-tw" cx="51" cy="40" rx="2" ry="3.5" fill="#2b1a3a" transform="rotate(20 51 40)"/>` +
  `<path d="M20 70C28 66 36 70 40 78M24 56C30 54 36 58 38 64" stroke="#0f6a44" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="70" cy="48" r="2" fill="#0f6a44"/>`;

A["Сказочный единорог"] =
  `<defs>${L("un3", "#ffffff", "#d8d4f0")}</defs>` +
  `<g class="ga-sw" style="transform-origin:40px 40px">` +
  `<path d="M40 22C20 22 12 42 20 60C14 66 18 78 28 82C20 70 28 62 34 60C30 52 32 40 44 34Z" fill="#ff5fa8"/><path d="M34 16C14 22 8 46 14 62C8 56 6 44 12 34C16 24 24 18 34 16Z" fill="#a070ff"/><path d="M30 28C18 34 16 50 22 62C26 64 28 66 28 68C22 56 24 40 36 30Z" fill="#46c8ff"/></g>` +
  `<path d="M34 94C32 74 34 58 40 46C42 38 48 32 56 32C64 32 72 38 82 52C88 58 86 66 78 66C72 66 66 62 62 66C58 74 56 94 56 94Z" fill="url(#un3)"/>` +
  `<path d="M52 34L74 4L64 38Z" fill="url(#gGd)"/><path d="M62 28L68 18" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>` +
  `<path d="M48 34L42 22L56 30Z" fill="#fff"/><circle cx="62" cy="48" r="3" fill="#2b1a3a"/><circle cx="63" cy="47" r="1" fill="#fff"/><ellipse cx="80" cy="60" rx="2" ry="1.4" fill="#e0306f"/>` +
  tw(84, 16, 8, "#fff", 0) + tw(18, 20, 6, "#fff0a8", 0.6) + tw(90, 40, 5, "#ffd0e8", 1);

A["Праздничный фейерверк"] =
  `<defs>${R("fw0", "#ffffff", "#ffffff", 0.9)}</defs><circle class="ga-tw" cx="50" cy="50" r="7" fill="url(#fw0)"/>` +
  `<g class="ga-ray" style="stroke:#ffd54a;stroke-width:3"><path d="M50 50V8M50 50V92M50 50H8M50 50H92"/></g>` +
  `<g class="ga-ray" style="stroke:#ff5e8a;stroke-width:3;animation-delay:.15s"><path d="M50 50L20 20M50 50L80 80M50 50L80 20M50 50L20 80"/></g>` +
  `<g class="ga-ray" style="stroke:#6ad7ff;stroke-width:2.5;animation-delay:.3s"><path d="M50 50L30 10M50 50L70 90M50 50L90 30M50 50L10 70M50 50L70 10M50 50L30 90M50 50L90 70M50 50L10 30"/></g>` +
  `<circle class="ga-tw" cx="18" cy="22" r="2.6" fill="#ffd54a"/><circle class="ga-tw" style="animation-delay:.4s" cx="84" cy="26" r="2.6" fill="#ff5e8a"/><circle class="ga-tw" style="animation-delay:.8s" cx="80" cy="82" r="2.6" fill="#6ad7ff"/><circle class="ga-tw" style="animation-delay:1.1s" cx="16" cy="78" r="2.6" fill="#fff"/>`;

A["Золотой дождь"] =
  `<g class="ga-fy"><path d="M20 34C8 34 6 18 20 18C20 6 40 4 46 14C54 6 74 8 74 22C90 20 94 38 80 38H20Z" fill="url(#gWh)"/><path d="M20 34H80" stroke="#cfc9e6" stroke-width="3"/></g>` +
  [[22, 0], [36, 0.5], [50, 1.1], [64, 0.3], [78, 0.9]].map(([x, d]) => `<g class="ga-rain" style="animation-delay:${d}s"><circle cx="${x}" cy="48" r="5" fill="url(#gGd)"/><circle cx="${x}" cy="48" r="2.6" fill="none" stroke="#b8861c" stroke-width="1"/></g><path class="ga-rain" style="animation-delay:${(d + 0.4).toFixed(1)}s" d="M${x + 7} 50l2 5l-2 5l-2-5Z" fill="#fff0a8"/>`).join("") +
  tw(12, 74, 6, "#fff0a8", 0.2) + tw(90, 70, 5, "#fff", 0.9);

A["Комета"] =
  `<defs>${L("cm1", "#7fd0ff", "#7fd0ff")}<linearGradient id="cm2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5cf0" stop-opacity="0"/><stop offset="1" stop-color="#7fd0ff" stop-opacity=".9"/></linearGradient>${R("cm3", "#ffffff", "#7fd0ff", 1)}</defs>` +
  `<g class="ga-cm"><path d="M30 70C44 48 66 26 96 6C84 30 62 54 38 78Z" fill="url(#cm2)"/><path d="M26 74C34 58 50 40 72 22C62 42 46 62 32 80Z" fill="url(#cm2)" opacity=".8"/><path d="M34 82C50 66 70 54 92 44C78 62 58 76 38 88Z" fill="url(#cm2)" opacity=".6"/>` +
  `<circle class="ga-pu" cx="30" cy="76" r="14" fill="url(#cm3)"/><circle cx="26" cy="72" r="4" fill="#fff"/></g>` +
  tw(14, 20, 6, "#fff", 0) + tw(60, 80, 5, "#fff0a8", 0.5) + tw(88, 70, 6, "#fff", 1) + tw(78, 8, 4, "#bfe9ff", 0.8);

A["Огненное сердце"] =
  `<defs>${R("fh3", "#ffb347", "#ff5a1f", 0.9)}</defs><circle class="ga-gl" cx="50" cy="58" r="42" fill="url(#fh3)"/>` +
  `<g class="ga-pu"><path d="M50 90C18 66 10 46 18 32C26 19 44 22 50 35C56 22 74 19 82 32C90 46 82 66 50 90Z" fill="url(#gRd)"/><ellipse cx="31" cy="36" rx="8" ry="5" fill="#fff" fill-opacity=".5" transform="rotate(-35 31 36)"/></g>` +
  `<path class="ga-fl" d="M50 6C60 20 66 26 62 38C60 44 56 46 54 42C54 38 50 36 50 30C46 34 44 40 42 42C38 40 40 32 44 26C48 20 48 14 50 6Z" fill="url(#gOr)"/>` +
  `<path class="ga-fl" style="animation-delay:.3s" d="M30 20C36 28 40 30 37 38C35 41 32 40 31 37C30 32 29 27 30 20Z" fill="#ffb347"/><path class="ga-fl" style="animation-delay:.5s" d="M70 20C64 28 60 30 63 38C65 41 68 40 69 37C70 32 71 27 70 20Z" fill="#ffb347"/>`;

A["Корабль"] =
  `<defs>${L("sh1", "#c98a4a", "#5a2f10")}</defs>` +
  `<g class="ga-bob" style="transform-origin:50px 80px">` +
  `<rect x="48" y="8" width="4" height="66" fill="#5a2f10"/><path class="ga-sw" d="M52 8L70 14L52 20Z" fill="#ff5fa8" style="transform-origin:52px 14px"/>` +
  `<path d="M50 20C80 26 84 50 82 58H50Z" fill="url(#gWh)"/><path d="M50 26C26 30 20 50 20 58H50Z" fill="#fff0cc"/><path d="M50 22V58" stroke="#cfc9e6" stroke-width="1.6"/><path d="M60 34L68 48M34 36L28 48" stroke="#e0b030" stroke-width="1.6"/>` +
  `<path d="M10 62H90C88 74 80 84 66 84H34C20 84 12 74 10 62Z" fill="url(#sh1)"/><path d="M12 68H88" stroke="#e0b030" stroke-width="2.4"/><circle cx="30" cy="74" r="2.4" fill="#ffe27a"/><circle cx="50" cy="75" r="2.4" fill="#ffe27a"/><circle cx="70" cy="74" r="2.4" fill="#ffe27a"/></g>` +
  `<clipPath id="shc"><rect width="100" height="100" rx="8"/></clipPath><g clip-path="url(#shc)"><path class="ga-wv" d="M0 86C10 80 20 92 30 86S50 80 60 86S80 92 90 86S100 82 110 88V100H0Z" fill="#3a7be0" opacity=".9"/><path class="ga-wv" style="animation-delay:.8s" d="M-10 92C0 88 10 98 20 92S40 88 50 92S70 98 80 92S96 90 100 94V100H-10Z" fill="#7fd0ff" opacity=".85"/></g>` + tw(86, 16, 5, "#fff0a8", 0) + tw(12, 22, 4, "#fff", 0.7);

A["Золотой лев"] =
  `<defs>${R("lo1", "#ffd54a", "#ffd54a", 0.7)}</defs><circle class="ga-gl" cx="50" cy="50" r="48" fill="url(#lo1)"/>` +
  `<g class="ga-pu" style="transform-origin:50px 50px">` + rot(16, (_, a) => `<path d="M50 6L58 24L42 24Z" fill="url(#gGd)" transform="rotate(${a} 50 50)"/>`) +
  rot(16, (_, a) => `<path d="M50 14L56 28L44 28Z" fill="#e0b030" transform="rotate(${a + 11} 50 50)"/>`) + `</g>` +
  `<circle cx="50" cy="52" r="26" fill="#f3c06a"/><circle cx="30" cy="34" r="6" fill="#f3c06a"/><circle cx="70" cy="34" r="6" fill="#f3c06a"/><circle cx="30" cy="34" r="3" fill="#b9803a"/><circle cx="70" cy="34" r="3" fill="#b9803a"/>` +
  `<ellipse cx="50" cy="62" rx="14" ry="11" fill="#fbe0a0"/><path d="M44 54H56L50 62Z" fill="#6a3a1a"/><path d="M50 62V68M42 70C46 72 50 68 50 68C50 68 54 72 58 70" stroke="#6a3a1a" stroke-width="2" fill="none" stroke-linecap="round"/>` +
  `<ellipse cx="40" cy="46" rx="3.4" ry="4" fill="#2b1a3a"/><ellipse cx="60" cy="46" rx="3.4" ry="4" fill="#2b1a3a"/><circle class="ga-tw" cx="41" cy="45" r="1.2" fill="#fff"/><circle class="ga-tw" cx="61" cy="45" r="1.2" fill="#fff"/>` + tw(88, 14, 6, "#fff", 0.3) + tw(10, 86, 5, "#fff0a8", 0.9);

const feather = (rotA: number, len: number) => `<path d="M46 52C${46 - len} ${46 - len * 0.2} ${46 - len} ${60 + len * 0.1} ${46 - len * 0.7} ${64}C${46 - len * 0.4} ${60} ${44} ${58} 46 52Z" fill="url(#gWh)" stroke="#d8d4ec" stroke-width="1" transform="rotate(${rotA} 46 52)"/>`;
const angelWing = [-34, -20, -6, 8, 22].map((a, i) => feather(a, 40 - i * 3)).join("");
A["Крылья ангела"] =
  `<defs>${R("an1", "#fff6c0", "#fff6c0", 0.8)}</defs><circle class="ga-gl" cx="50" cy="56" r="44" fill="url(#an1)"/>` +
  `<g class="ga-wf" style="transform-box:view-box;transform-origin:46px 56px">${angelWing}</g><g transform="translate(100 0) scale(-1 1)"><g class="ga-wf" style="transform-box:view-box;transform-origin:46px 56px">${angelWing}</g></g>` +
  `<path d="M50 68C38 58 38 46 46 46C49 46 50 49 50 50C50 49 51 46 54 46C62 46 62 58 50 68Z" fill="url(#gPk)"/>` +
  `<ellipse class="ga-gl" cx="50" cy="16" rx="16" ry="5" fill="none" stroke="url(#gGd)" stroke-width="4"/>` + tw(14, 20, 6, "#fff", 0) + tw(88, 24, 7, "#fff0a8", 0.6) + tw(80, 86, 5, "#fff", 1);

A["Космическая ракета"] =
  `<g class="ga-fy" style="transform-origin:50px 50px"><g transform="rotate(35 50 50)">` +
  `<path class="ga-fl" d="M42 76C40 88 46 94 50 100C54 94 60 88 58 76Z" fill="url(#gOr)"/><path class="ga-fl" style="animation-delay:.2s" d="M46 76C46 84 48 88 50 92C52 88 54 84 54 76Z" fill="#fff6c0"/>` +
  `<path d="M34 64L22 80L38 74Z" fill="url(#gRd)"/><path d="M66 64L78 80L62 74Z" fill="url(#gRd)"/>` +
  `<path d="M50 6C66 20 66 50 62 76H38C34 50 34 20 50 6Z" fill="url(#gWh)"/><path d="M50 6C60 14 64 26 64 36H36C36 26 40 14 50 6Z" fill="url(#gRd)"/>` +
  `<circle cx="50" cy="48" r="9" fill="url(#gBl)" stroke="#8a5a10" stroke-width="3"/><path d="M44 46C46 42 50 42 52 44" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/><rect x="38" y="68" width="24" height="5" fill="#b8861c"/></g></g>` +
  `<path class="ga-rain" d="M12 10V26" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path class="ga-rain" style="animation-delay:.9s" d="M88 4V22" stroke="#bfe9ff" stroke-width="2" stroke-linecap="round"/>` + tw(14, 60, 6, "#fff0a8", 0.2) + tw(88, 70, 5, "#fff", 0.7);

A["Северное сияние"] =
  `<clipPath id="auc"><circle cx="50" cy="50" r="47"/></clipPath><circle cx="50" cy="50" r="47" fill="#120d2a"/><g clip-path="url(#auc)"><defs><linearGradient id="au1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46ffb0" stop-opacity="0"/><stop offset=".5" stop-color="#46ffb0" stop-opacity=".9"/><stop offset="1" stop-color="#46c8ff" stop-opacity=".1"/></linearGradient><linearGradient id="au2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d070ff" stop-opacity="0"/><stop offset=".5" stop-color="#d070ff" stop-opacity=".85"/><stop offset="1" stop-color="#7a5cf0" stop-opacity=".1"/></linearGradient></defs>` +
  `<path class="ga-au" d="M0 20C20 4 36 36 56 18S88 2 100 14V74C86 62 70 84 52 70S18 58 0 72Z" fill="url(#au1)"/>` +
  `<path class="ga-au" style="animation-delay:1.2s" d="M0 34C18 22 40 50 60 34S90 20 100 30V80C84 70 70 90 52 80S20 70 0 84Z" fill="url(#au2)"/>` +
  `<path d="M0 100L18 66L30 84L46 56L62 84L76 68L100 100Z" fill="#1a1533"/><path d="M46 56L40 66L46 63L52 67Z" fill="#fff" fill-opacity=".8"/><path d="M18 66L13 75L18 72L23 76Z" fill="#fff" fill-opacity=".8"/></g>` +
  tw(14, 14, 5, "#fff", 0) + tw(84, 10, 4, "#fff", 0.7) + tw(70, 26, 3, "#fff", 1.2) + tw(30, 30, 3, "#fff", 0.4);

A["Ледяная роза"] =
  `<defs>${R("ir1", "#e6fbff", "#3a9bff")}</defs><circle class="ga-gl" cx="50" cy="40" r="42" fill="#8fe0ff" fill-opacity=".25"/>` +
  `<path d="M50 52C47 70 53 82 50 95" stroke="#7fd0ff" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M50 80C38 77 31 69 29 62C41 62 48 68 50 74Z" fill="#9fe6ff"/><path d="M51 72C62 70 69 64 71 57C60 58 53 63 51 68Z" fill="#7fd0ff"/>` +
  `<g class="ga-pu"><path d="M50 12C29 12 22 34 31 47C38 57 62 57 69 47C78 34 71 12 50 12Z" fill="url(#ir1)"/><path d="M50 19C39 21 37 34 45 39C52 43 61 39 61 30C61 24 56 19 50 19Z" fill="#9fe6ff"/><path d="M45 29C45 24 55 24 55 30C55 35 46 36 45 29Z" fill="#3a9bff"/><path d="M35 24C37 20 42 17 47 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></g>` +
  `<path class="ga-rain" d="M20 6L22 10L26 12L22 14L20 18L18 14L14 12L18 10Z" fill="#fff"/><path class="ga-rain" style="animation-delay:1s" d="M80 4L82 8L86 10L82 12L80 16L78 12L74 10L78 8Z" fill="#bfe9ff"/>` + tw(86, 40, 6, "#fff", 0.4) + tw(12, 50, 5, "#bfe9ff", 0.9);

// Объём: мягкий свет сверху-слева, блик и тень под предметом.
const LIGHT =
  '<filter id="gLit" x="-12%" y="-12%" width="124%" height="130%" color-interpolation-filters="sRGB">' +
  '<feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/>' +
  '<feDiffuseLighting in="b" surfaceScale="3.2" diffuseConstant="1.05" lighting-color="#fff" result="df"><fePointLight x="22" y="4" z="70"/></feDiffuseLighting>' +
  '<feComposite in="df" in2="SourceGraphic" operator="arithmetic" k1="1.18" k2="0" k3="0" k4="0" result="sh"/>' +
  '<feSpecularLighting in="b" surfaceScale="4" specularConstant=".85" specularExponent="26" lighting-color="#fff" result="sp"><fePointLight x="22" y="4" z="60"/></feSpecularLighting>' +
  '<feComposite in="sp" in2="SourceAlpha" operator="in" result="sp2"/>' +
  '<feComposite in="sh" in2="sp2" operator="arithmetic" k1="0" k2="1" k3=".7" k4="0" result="lit"/>' +
  '<feComposite in="lit" in2="SourceAlpha" operator="in" result="lit2"/>' +
  '<feDropShadow in="lit2" dx="0" dy="3" stdDeviation="2.2" flood-color="#000" flood-opacity=".5"/>' +
  "</filter>";

export const GIFT_ART_NAMES = Object.keys(A);
export const hasGiftArt = (name: string) => !!A[name];
// Эти рисунки состоят из лучей/линий — им объём не нужен.
const FLAT = new Set(["Созвездие", "Праздничный фейерверк", "Вселенная", "Северное сияние"]);
export const giftSvg = (name: string): string | null => {
  const art = A[name];
  if (!art) return null;
  const head = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${COMMON}`;
  if (FLAT.has(name)) return `${head}${art}</svg>`;
  // свечение (круг ga-gl) остаётся вне фильтра, иначе превращается в тёмный шар
  const glows: string[] = [];
  const body = art.replace(/<circle class="ga-gl"[^>]*\/>/g, (m) => (glows.push(m), ""));
  return `${head}<defs>${LIGHT}</defs>${glows.join("")}<g filter="url(#gLit)">${body}</g></svg>`;
};
