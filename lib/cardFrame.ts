// Автоматическая рамка для коллекционной карточки: фото участницы + золотая рамка,
// имя и этап. Рисуется в браузере, результат — готовый JPEG.
const W = 900;
const H = 1200;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Не удалось загрузить фото"));
    img.src = url;
  });
}

export async function makeCardImage(rawUrl: string, name: string, stageLabel: string): Promise<Blob> {
  const img = await loadImage(rawUrl);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // фон
  ctx.fillStyle = "#0B0B12";
  ctx.fillRect(0, 0, W, H);

  // фото по центру с обрезкой под область
  const m = 48; // отступ рамки
  const ax = m, ay = m, aw = W - m * 2, ah = H - m * 2 - 150;
  const scale = Math.max(aw / img.width, ah / img.height);
  const sw = aw / scale, sh = ah / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 3; // чуть выше центра — лица
  ctx.drawImage(img, sx, Math.max(0, sy), sw, sh, ax, ay, aw, ah);

  // затемнение снизу для подписи
  const g = ctx.createLinearGradient(0, ay + ah - 260, 0, ay + ah);
  g.addColorStop(0, "rgba(11,11,18,0)");
  g.addColorStop(1, "rgba(11,11,18,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(ax, ay + ah - 260, aw, 260);

  // золотая рамка (двойная)
  const gold = ctx.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, "#F5D77A");
  gold.addColorStop(0.5, "#B8902F");
  gold.addColorStop(1, "#F5D77A");
  ctx.strokeStyle = gold;
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.lineWidth = 3;
  ctx.strokeRect(m - 6, m - 6, W - (m - 6) * 2, H - (m - 6) * 2);

  // табличка внизу
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  let size = 74;
  ctx.font = `bold ${size}px sans-serif`;
  while (ctx.measureText(name).width > W - 140 && size > 34) {
    size -= 4;
    ctx.font = `bold ${size}px sans-serif`;
  }
  ctx.fillText(name, W / 2, H - 130);
  ctx.fillStyle = "#E8C65A";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText(stageLabel.toUpperCase(), W / 2, H - 80);
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "#B8902F";
  ctx.fillText("V E T O K S", W / 2, H - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Не удалось создать картинку"))), "image/jpeg", 0.92);
  });
}
