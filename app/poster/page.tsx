"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { renderPoster, FRAME, POSTER_UNIT, PosterCat } from "@/lib/posterRender";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import LoadingScreen from "@/components/LoadingScreen";

const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = 'Jost, "Helvetica Neue", Arial, sans-serif';

type Info = {
  participant: boolean;
  first: string;
  last: string;
  age: number | null;
  cat: string;
  city: string;
  country: string;
  height: number | null;
  interests: string;
  about: string;
  latest: { url: string; at: string } | null;
  needParent: boolean;
};

type Crop = { z: number; cx: number; cy: number }; // масштаб и центр кадра (доли размера фото)

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("img"));
    i.src = src;
  });
}

async function ensureFonts() {
  if (!document.getElementById("poster-fonts")) {
    await new Promise<void>((res) => {
      const l = document.createElement("link");
      l.id = "poster-fonts";
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Jost:wght@400;500;600;700&display=swap&subset=cyrillic";
      l.onload = () => res();
      l.onerror = () => res();
      document.head.appendChild(l);
      setTimeout(res, 4000);
    });
  }
  const sample = "Аліна Київ абвгґдеєжзиіїйклмнопрстуфхцчшщьюя";
  try {
    await Promise.all([
      document.fonts.load('500 100px "Cormorant Garamond"', sample),
      document.fonts.load('600 100px "Cormorant Garamond"', sample),
      document.fonts.load('700 100px "Cormorant Garamond"', sample),
      document.fonts.load("400 40px Jost", sample),
      document.fonts.load("500 40px Jost", sample),
      document.fonts.load("600 40px Jost", sample),
      document.fonts.load("700 40px Jost", sample),
    ]);
  } catch {
    /* шрифты не загрузились — рисуем запасными */
  }
}

// Какую часть фото видно в кадре при данном масштабе и центре (в пикселях фото).
function region(iw: number, ih: number, f: number, c: Crop) {
  let vw: number;
  let vh: number;
  if (iw / ih > f) {
    vh = ih;
    vw = ih * f;
  } else {
    vw = iw;
    vh = iw / f;
  }
  vw /= c.z;
  vh /= c.z;
  const x = Math.min(Math.max(c.cx * iw - vw / 2, 0), iw - vw);
  const y = Math.min(Math.max(c.cy * ih - vh / 2, 0), ih - vh);
  return { x, y, vw, vh };
}

const ERR: Record<string, string> = {
  need_consent: "Постав галочку про згоду на публікацію.",
  need_parent: "Для публікації потрібна згода одного з батьків. Вона підтверджується в Telegram.",
  bad_file: "Не вдалося обробити фото. Спробуй інше.",
  bad_words: "У тексті «Інтереси» або «Про себе» є неприпустимі слова. Перепиши без грубощів.",
  not_participant: "Афіша доступна лише учасницям конкурсу.",
};

export default function PosterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [height, setHeight] = useState("");
  const [interests, setInterests] = useState("");
  const [about, setAbout] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [crop, setCrop] = useState<Crop>({ z: 1, cx: 0.5, cy: 0.4 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/poster");
        return;
      }
      const r = await apiPost("/api/poster/info");
      if (r?.ok) {
        setInfo(r as Info);
        if (r.height) setHeight(String(r.height));
        if (r.interests) setInterests(r.interests);
        if (r.about) setAbout(r.about);
      }
      setLoading(false);
    })();
  }, [router]);

  const cat = ((info && ["teen", "main", "adult"].includes(info.cat) ? info.cat : "main") as PosterCat);
  const frame = FRAME[cat];

  // редактор кадра: показываем ту часть фото, что попадёт на афішу
  useEffect(() => {
    const cv = editor.current;
    const im = img.current;
    if (!cv || !im || !hasPhoto) return;
    const cw = cv.clientWidth || 260;
    cv.width = Math.round(cw * 2);
    cv.height = Math.round((cw * 2 * frame.h) / frame.w);
    const r = region(im.naturalWidth, im.naturalHeight, frame.w / frame.h, crop);
    const c = cv.getContext("2d")!;
    c.drawImage(im, r.x, r.y, r.vw, r.vh, 0, 0, cv.width, cv.height);
  }, [crop, hasPhoto, frame.w, frame.h]);

  const draw = useCallback(async () => {
    const im = img.current;
    if (!info || !im) return;
    const h = Number(height);
    try {
      await ensureFonts();
      const k = POSTER_UNIT * 1.5;
      const out = document.createElement("canvas");
      out.width = Math.round(frame.w * k);
      out.height = Math.round(frame.h * k);
      const r = region(im.naturalWidth, im.naturalHeight, frame.w / frame.h, crop);
      out.getContext("2d")!.drawImage(im, r.x, r.y, r.vw, r.vh, 0, 0, out.width, out.height);
      const b = await renderPoster({
        cat,
        photo: out,
        first: info.first,
        last: info.last,
        age: info.age,
        height: h >= 120 && h <= 220 ? h : null,
        city: info.city,
        country: info.country,
        interests,
        about,
        fonts: { serif: SERIF, sans: SANS },
      });
      setBlob(b);
      setPreviewUrl(URL.createObjectURL(b));
      setSentUrl(null);
    } catch (e: any) {
      setErr(e?.message || "Не вдалося створити афішу. Спробуй інше фото.");
    }
  }, [info, height, interests, about, crop, cat, frame.w, frame.h]);

  // что-то поменяла (кадр, рост, текст) — афіша перерисовывается сама
  useEffect(() => {
    if (!hasPhoto) return;
    const t = setTimeout(() => {
      draw();
    }, 450);
    return () => clearTimeout(t);
  }, [draw, hasPhoto]);

  async function pick(f: File | null) {
    if (!f) return;
    setErr("");
    setSentUrl(null);
    setBlob(null);
    setPreviewUrl(null);
    setBusy("Готуємо фото…");
    try {
      const clean = await cleanImage(f, 2000);
      img.current = await loadImg(URL.createObjectURL(clean));
      setCrop({ z: 1, cx: 0.5, cy: 0.4 });
      setHasPhoto(true);
    } catch {
      setErr("Не вдалося обробити фото. Спробуй інше.");
    }
    setBusy("");
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    const im = img.current;
    const cv = editor.current;
    if (!d || !im || !cv) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x: e.clientX, y: e.clientY };
    const r = region(im.naturalWidth, im.naturalHeight, frame.w / frame.h, crop);
    const kx = r.vw / cv.clientWidth;
    const ky = r.vh / cv.clientHeight;
    setCrop((c) => ({
      ...c,
      cx: Math.min(1, Math.max(0, c.cx - (dx * kx) / im.naturalWidth)),
      cy: Math.min(1, Math.max(0, c.cy - (dy * ky) / im.naturalHeight)),
    }));
  }
  function onUp() {
    drag.current = null;
  }

  async function send() {
    if (!blob) return;
    if (!consent) {
      setErr(ERR.need_consent);
      return;
    }
    setBusy("Надсилаємо…");
    setErr("");
    try {
      const { data } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("file", blob, "poster.jpg");
      fd.append("height", height);
      fd.append("bad", "0");
      fd.append("consent", "1");
      fd.append("interests", interests);
      fd.append("about", about);
      const res = await fetch("/api/poster/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (j?.ok) {
        setSentUrl(j.url);
      } else {
        setErr(ERR[j?.error] || "Не вдалося надіслати. Спробуй ще раз.");
      }
    } catch {
      setErr("Не вдалося надіслати. Перевір інтернет і спробуй ще раз.");
    }
    setBusy("");
  }

  if (loading) return <LoadingScreen />;

  if (!info?.participant) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
          <h1 className="text-2xl font-semibold text-gold mb-4">Моя афіша</h1>
          <p className="text-muted max-w-sm">Афіша доступна лише учасницям конкурсу. Подай анкету на головній сторінці.</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">Моя афіша</h1>
        <p className="text-muted text-sm mb-5">
          Завантаж одне фото — ми зробимо з нього красиву афішу для Instagram і TikTok. Ім’я, вік і місто підставляться самі.
        </p>

        {info.needParent && (
          <div className="bg-bgSurface border border-danger/50 rounded-xl p-4 mb-5 text-sm text-offwhite">
            Щоб афішу можна було публікувати, потрібна згода одного з батьків. Вона підтверджується в Telegram — перевір розділ «Згода батьків» у профілі.
          </div>
        )}

        <div className="bg-bgSurface border border-gold/30 rounded-xl p-4 mb-5">
          <p className="text-gold text-sm font-semibold mb-2">Яке фото підійде</p>
          <ul className="text-offwhite text-sm space-y-1.5 list-none">
            <li>✅ Вертикальне фото по пояс або на повний зріст</li>
            <li>✅ Гарне місце або однотонна світла стіна позаду</li>
            <li>✅ Рівне денне світло, обличчя добре видно</li>
            <li>✅ Ти одна в кадрі, руки не закривають обличчя</li>
            <li>❌ Без фільтрів, написів і чужих людей позаду</li>
          </ul>
        </div>

        <label className="block text-muted text-xs mb-1">Мій зріст, см</label>
        <input
          type="number"
          inputMode="numeric"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="Наприклад, 172"
          className="w-full bg-bgSurface border border-gold/30 rounded-xl px-4 py-3 text-offwhite mb-4"
        />
        <label className="block text-muted text-xs mb-1">Мої інтереси (до трьох, через кому)</label>
        <input
          value={interests}
          maxLength={60}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="Танці, подорожі, фотографія"
          className="w-full bg-bgSurface border border-gold/30 rounded-xl px-4 py-3 text-offwhite mb-4"
        />
        <label className="block text-muted text-xs mb-1">Коротко про себе (до 90 знаків)</label>
        <input
          value={about}
          maxLength={90}
          onChange={(e) => setAbout(e.target.value)}
          placeholder="Люблю сцену і вірю в красу з характером"
          className="w-full bg-bgSurface border border-gold/30 rounded-xl px-4 py-3 text-offwhite mb-4"
        />

        <input ref={inp} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <button
          onClick={() => inp.current?.click()}
          disabled={!!busy}
          className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold rounded-xl py-3.5 mb-4 disabled:opacity-60"
        >
          {hasPhoto ? "Обрати інше фото" : "📷 Обрати фото"}
        </button>

        {hasPhoto && (
          <div className="bg-bgSurface border border-gold/30 rounded-xl p-4 mb-4">
            <p className="text-gold text-sm font-semibold mb-1">Постав кадр</p>
            <p className="text-muted text-xs mb-3">Тягни фото пальцем, щоб обличчя було в потрібному місці. Повзунок збільшує фото.</p>
            <canvas
              ref={editor}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="block mx-auto rounded-xl border border-gold/40 w-full"
              style={{ maxWidth: 240, aspectRatio: `${frame.w} / ${frame.h}`, touchAction: "none", cursor: "grab" }}
            />
            <input
              type="range"
              min={100}
              max={300}
              value={Math.round(crop.z * 100)}
              onChange={(e) => setCrop((c) => ({ ...c, z: Number(e.target.value) / 100 }))}
              className="w-full mt-3"
              aria-label="Масштаб"
            />
          </div>
        )}

        {busy && <p className="text-gold text-sm text-center mb-4">{busy}</p>}
        {err && <p className="text-danger text-sm mb-4">{err}</p>}

        {previewUrl && !busy && (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Афіша" className="w-full rounded-xl border border-gold/30" />
          </div>
        )}

        {blob && !sentUrl && !busy && (
          <>
            <label className="flex items-start gap-3 text-sm text-offwhite mb-4">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
              <span>Дозволяю VETOKS публікувати цю афішу з моїм фото та даними в соцмережах.</span>
            </label>
            <button onClick={send} className="w-full bg-gold text-bgPrimary font-semibold rounded-xl py-3.5 mb-3">
              Надіслати афішу
            </button>
          </>
        )}

        {sentUrl && (
          <div className="bg-bgSurface border border-success/50 rounded-xl p-4 mb-4 text-center">
            <p className="text-success font-semibold mb-1">Афішу надіслано! 🎉</p>
            <p className="text-muted text-xs mb-3">Команда VETOKS отримала її й опублікує в соцмережах.</p>
            <a href={previewUrl ?? sentUrl} download="vetoks-afisha.jpg" className="inline-block bg-gold text-bgPrimary font-semibold rounded-xl px-5 py-2.5 text-sm">
              Завантажити собі
            </a>
          </div>
        )}

        {!previewUrl && info.latest && !busy && (
          <div className="mt-2">
            <p className="text-muted text-xs mb-2">Остання надіслана афіша:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={info.latest.url} alt="Остання афіша" className="w-full rounded-xl border border-gold/20" />
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
