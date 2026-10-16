"use client";

import { useEffect, useRef, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { useT } from "@/lib/i18n";
import type { CardInfo } from "@/lib/cardInfo";

type Fmt = "story" | "post";
const SIZES: Record<Fmt, [number, number]> = { story: [1080, 1920], post: [1080, 1350] };

const TXT: Record<string, { cta: string; place: (n: number, r: string) => string; sub: string }> = {
  ru: { cta: "ПРОГОЛОСУЙ ЗА МЕНЯ", place: (n, r) => `№${n} в регионе ${r}`, sub: "Голосуй в VETOKS" },
  uk: { cta: "ПРОГОЛОСУЙ ЗА МЕНЕ", place: (n, r) => `№${n} у регіоні ${r}`, sub: "Голосуй у VETOKS" },
  en: { cta: "VOTE FOR ME", place: (n, r) => `#${n} in ${r}`, sub: "Vote on VETOKS" },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img"));
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, start: number, weight = "bold") {
  let size = start;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  while (ctx.measureText(text).width > maxW && size > 28) {
    size -= 4;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  }
}

// Рисуем карточку прямо в браузере — готовая картинка для сторис и постов.
async function drawCard(info: CardInfo, fmt: Fmt, linkText: string, lang: string, withPhoto: boolean): Promise<HTMLCanvasElement> {
  const [W, H] = SIZES[fmt];
  const tx = TXT[lang] ?? TXT.en;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a1048");
  bg.addColorStop(0.55, "#0b0b12");
  bg.addColorStop(1, "#3a2606");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  let img: HTMLImageElement | null = null;
  if (withPhoto && info.photoUrl) {
    try {
      img = await loadImage(info.photoUrl);
    } catch {
      img = null;
    }
  }

  // размытый фон из того же фото
  if (img) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.filter = "blur(40px)";
    const s = Math.max(W / img.width, H / img.height) * 1.2;
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  }

  // корона и название
  const gold = ctx.createLinearGradient(0, 0, W, 0);
  gold.addColorStop(0, "#F5D77A");
  gold.addColorStop(0.5, "#C9A227");
  gold.addColorStop(1, "#F5D77A");
  ctx.textAlign = "center";
  const topY = fmt === "story" ? 150 : 100;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const cx = W / 2, cw = 120, ch = 72, cy = topY - 70;
  ctx.moveTo(cx - cw / 2, cy + ch);
  ctx.lineTo(cx - cw * 0.4, cy + ch * 0.25);
  ctx.lineTo(cx - cw * 0.18, cy + ch * 0.6);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + cw * 0.18, cy + ch * 0.6);
  ctx.lineTo(cx + cw * 0.4, cy + ch * 0.25);
  ctx.lineTo(cx + cw / 2, cy + ch);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText("V E T O K S", W / 2, topY + 40);

  // фото
  const pw = 860;
  const ph = fmt === "story" ? 1080 : 760;
  const px = (W - pw) / 2;
  const py = topY + 90;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 56);
  ctx.clip();
  if (img) {
    const s = Math.max(pw / img.width, ph / img.height);
    const sw = pw / s, sh = ph / s;
    ctx.drawImage(img, (img.width - sw) / 2, Math.max(0, (img.height - sh) / 3), sw, sh, px, py, pw, ph);
  } else {
    ctx.fillStyle = "#14101f";
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = gold;
    ctx.font = "bold 360px system-ui, sans-serif";
    ctx.fillText("♛", W / 2, py + ph / 2 + 120);
  }
  const fade = ctx.createLinearGradient(0, py + ph - 260, 0, py + ph);
  fade.addColorStop(0, "rgba(11,11,18,0)");
  fade.addColorStop(1, "rgba(11,11,18,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 260, pw, 260);
  ctx.restore();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 10;
  roundRect(ctx, px, py, pw, ph, 56);
  ctx.stroke();

  // имя и место
  let y = py + ph + 110;
  ctx.fillStyle = "#FFFFFF";
  fitText(ctx, info.name, W - 140, 96);
  ctx.fillText(info.name, W / 2, y);
  if (info.rank && info.region) {
    y += 70;
    ctx.fillStyle = "#E8C65A";
    fitText(ctx, tx.place(info.rank, info.region), W - 160, 52, "600");
    ctx.fillText(tx.place(info.rank, info.region), W / 2, y);
  }

  // кнопка-призыв
  const bw = 800, bh = 130;
  const by = y + 60;
  const bx = (W - bw) / 2;
  const bgGold = ctx.createLinearGradient(0, by, 0, by + bh);
  bgGold.addColorStop(0, "#F1DE98");
  bgGold.addColorStop(1, "#B08D1C");
  ctx.fillStyle = bgGold;
  roundRect(ctx, bx, by, bw, bh, 65);
  ctx.fill();
  ctx.fillStyle = "#1a1405";
  fitText(ctx, tx.cta, bw - 80, 58);
  ctx.fillText(tx.cta, W / 2, by + bh / 2 + 20);

  // ссылка
  ctx.fillStyle = "#C9B26A";
  fitText(ctx, linkText, W - 120, 40, "600");
  ctx.fillText(linkText, W / 2, by + bh + 80);
  return c;
}

export default function VoteCardModal({ participantId, onClose }: { participantId: string; onClose: () => void }) {
  const { lang } = useT();
  const [info, setInfo] = useState<CardInfo | null>(null);
  const [fmt, setFmt] = useState<Fmt>("story");
  const [url, setUrl] = useState<string>("");
  const [link, setLink] = useState("");
  const [toast, setToast] = useState("");
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    (async () => {
      const r = await apiPost("/api/card/info", { id: participantId });
      if (!r?.ok) return;
      setInfo(r.info as CardInfo);
      let ref = "";
      try {
        const m = await apiPost("/api/referral/my", {});
        if (m?.enabled) ref = m.nick || m.code || "";
      } catch {}
      setLink(`${window.location.origin}/v/${participantId}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`);
    })();
  }, [participantId]);

  useEffect(() => {
    if (!info || !link) return;
    let alive = true;
    (async () => {
      const short = link.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
      let canvas: HTMLCanvasElement;
      let blob: Blob | null = null;
      try {
        canvas = await drawCard(info, fmt, short, lang, true);
        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      } catch {
        blob = null;
      }
      if (!blob) {
        // если фото не отдаётся для рисования — делаем карточку без фото
        canvas = await drawCard(info, fmt, short, lang, false);
        blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
      }
      if (!alive || !blob) return;
      blobRef.current = blob;
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob!);
      });
    })();
    return () => {
      alive = false;
    };
  }, [info, link, fmt, lang]);

  function say(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 2200);
  }

  const shareText = (TXT[lang] ?? TXT.en).cta.charAt(0) + (TXT[lang] ?? TXT.en).cta.slice(1).toLowerCase();

  async function shareFile() {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], "vetoks.jpg", { type: "image/jpeg" });
    const nav: any = navigator;
    try {
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: `${shareText}\n${link}` });
        return;
      }
    } catch {
      return; // человек закрыл окно «Поделиться»
    }
    download();
  }

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "vetoks.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    say("Картинка сохранена — загрузите её в сторис Instagram");
  }

  function telegram() {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`,
      "_blank"
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      say("Ссылка скопирована");
    } catch {
      say(link);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-bgPrimary border border-gold/40 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[94vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-offwhite font-semibold">Карточка «Проголосуй за меня»</p>
          <button onClick={onClose} className="text-muted text-2xl leading-none" aria-label="Закрыть">
            ×
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          {(["story", "post"] as Fmt[]).map((f) => (
            <button
              key={f}
              onClick={() => setFmt(f)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                fmt === f ? "bg-gold text-bgPrimary" : "bg-bgSurface border border-muted text-offwhite"
              }`}
            >
              {f === "story" ? "Сторис 9:16" : "Пост 4:5"}
            </button>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden bg-bgSurface flex items-center justify-center min-h-[240px]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="w-full max-h-[52vh] object-contain" />
          ) : (
            <p className="text-muted text-sm">Готовим карточку...</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button onClick={shareFile} disabled={!url} className="col-span-2 bg-gradient-to-b from-[#F1DE98] via-[#C9A227] to-[#b08d1c] text-[#1a1405] font-semibold rounded-full py-3 disabled:opacity-40">
            Поделиться (Instagram и др.)
          </button>
          <button onClick={telegram} disabled={!link} className="bg-[#229ED9] text-white font-semibold rounded-full py-3 disabled:opacity-40">
            Telegram
          </button>
          <button onClick={download} disabled={!url} className="bg-bgSurface border border-muted text-offwhite font-semibold rounded-full py-3 disabled:opacity-40">
            Скачать
          </button>
          <button onClick={copy} disabled={!link} className="col-span-2 border border-gold text-gold font-semibold rounded-full py-3 disabled:opacity-40">
            Скопировать ссылку
          </button>
        </div>
        <p className="text-muted text-[11px] mt-3 text-center">
          В ссылке — ваш код приглашения: кто зарегистрируется по ней, считается вашим приглашённым.
        </p>
        {toast && <p className="text-center text-gold text-sm mt-2">{toast}</p>}
      </div>
    </div>
  );
}
