// Очистка фото перед загрузкой: убираем из файла всё лишнее (место съёмки, модель телефона, время),
// уменьшаем слишком большие снимки и убеждаемся, что это действительно картинка.
// Видео, PDF и GIF не трогаем. Если картинку не удалось прочитать — выбрасываем понятную ошибку.
const MAX_SIDE = 2400;

export async function cleanImage(file: File, maxSide: number = MAX_SIDE): Promise<File> {
  const t = (file.type || "").toLowerCase();
  const isImg = t.startsWith("image/") && t !== "image/gif";
  if (!isImg) return file;

  const fail = () => new Error("Не удалось обработать фото. Выберите снимок в формате JPG или PNG.");

  let w = 0;
  let h = 0;
  let source: CanvasImageSource | null = null;
  let revoke: (() => void) | null = null;

  try {
    if (typeof createImageBitmap === "function") {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as any).catch(() => null);
      if (bmp) {
        source = bmp;
        w = bmp.width;
        h = bmp.height;
        revoke = () => bmp.close?.();
      }
    }
    if (!source) {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(fail());
        i.src = url;
      }).finally(() => URL.revokeObjectURL(url));
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    }
    if (!w || !h) throw fail();

    const k = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * k));
    const ch = Math.max(1, Math.round(h * k));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw fail();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(source, 0, 0, cw, ch);

    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw fail();
    const base = (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    try {
      revoke?.();
    } catch {
      /* ignore */
    }
  }
}
