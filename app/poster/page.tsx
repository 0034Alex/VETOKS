"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { renderPoster, PosterCat } from "@/lib/posterRender";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import LoadingScreen from "@/components/LoadingScreen";

const SCRIPT = '"Great Vibes", cursive';
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
  latest: { url: string; at: string } | null;
  canCutout: boolean;
  needParent: boolean;
};

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
      l.href = "https://fonts.googleapis.com/css2?family=Great+Vibes&family=Jost:wght@400;500;600&display=swap&subset=cyrillic";
      l.onload = () => res();
      l.onerror = () => res();
      document.head.appendChild(l);
      setTimeout(res, 4000);
    });
  }
  const sample = "Аліна Київ абвгґдеєжзиіїйклмнопрстуфхцчшщьюя";
  try {
    await Promise.all([
      document.fonts.load('400 100px "Great Vibes"', sample),
      document.fonts.load("400 40px Jost", sample),
      document.fonts.load("500 40px Jost", sample),
      document.fonts.load("600 100px Jost", "MISSLADYTEEN"),
    ]);
  } catch {
    /* шрифты не загрузились — рисуем запасными */
  }
}

const ERR: Record<string, string> = {
  need_consent: "Постав галочку про згоду на публікацію.",
  need_parent: "Для публікації потрібна згода одного з батьків. Вона підтверджується в Telegram.",
  bad_file: "Не вдалося обробити фото. Спробуй інше.",
  not_participant: "Афіша доступна лише учасницям конкурсу.",
};

export default function PosterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<Info | null>(null);
  const [height, setHeight] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  
  const inp = useRef<HTMLInputElement>(null);

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
      }
      setLoading(false);
    })();
  }, [router]);

  async function build(f: File, h: number) {
    if (!info) return;
    setErr("");
    setBlob(null);
    setPreviewUrl(null);
    setBad(false);
    try {
      setBusy("Готуємо фото…");
      const clean = await cleanImage(f, 1400);
      let cutImg: HTMLImageElement | null = null;
      if (info.canCutout) {
        setBusy("Вирізаємо фон… це може зайняти до пів хвилини");
        try {
          const { data } = await supabase.auth.getSession();
          const fd = new FormData();
          fd.append("file", clean, "photo.jpg");
          const res = await fetch("/api/poster/cutout", {
            method: "POST",
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: fd,
          });
          if (res.ok && (res.headers.get("content-type") || "").includes("image/png")) {
            const b = await res.blob();
            cutImg = await loadImg(URL.createObjectURL(b));
          }
        } catch {
          cutImg = null;
        }
      }
      const cutout = !!cutImg;
      const photo = cutImg ?? (await loadImg(URL.createObjectURL(clean)));
      setBad(!cutout);
      setBusy("Збираємо афішу…");
      await ensureFonts();
      const out = await renderPoster({
        cat: (["teen", "main", "adult"].includes(info.cat) ? info.cat : "main") as PosterCat,
        photo,
        cutout,
        first: info.first,
        last: info.last,
        age: info.age,
        height: h,
        city: info.city,
        country: info.country,
        fonts: { script: SCRIPT, sans: SANS },
      });
      setBlob(out);
      setPreviewUrl(URL.createObjectURL(out));
    } catch (e: any) {
      setErr(e?.message || "Не вдалося створити афішу. Спробуй інше фото.");
    }
    setBusy("");
  }

  function pick(f: File | null) {
    setFile(f);
    setSentUrl(null);
    if (!f) return;
    const h = Number(height);
    if (!(h >= 120 && h <= 220)) {
      setErr("Спочатку вкажи свій зріст (120–220 см), потім обери фото.");
      return;
    }
    build(f, h);
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
      fd.append("bad", bad ? "1" : "0");
      fd.append("consent", "1");
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
            <li>✅ Однотонна світла стіна: біла, бежева, сіра</li>
            <li>✅ Рівне денне світло, без фільтрів</li>
            <li>✅ Ти одна в кадрі, руки не закривають обличчя</li>
            <li>❌ Одяг або волосся не мають зливатися з фоном</li>
            <li>❌ Без людей, меблів і яскравих плям позаду</li>
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

        <input ref={inp} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        <button
          onClick={() => inp.current?.click()}
          disabled={!!busy}
          className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold rounded-xl py-3.5 mb-4 disabled:opacity-60"
        >
          {file ? "Обрати інше фото" : "📷 Обрати фото"}
        </button>

        {busy && <p className="text-gold text-sm text-center mb-4">{busy}</p>}
        {err && <p className="text-danger text-sm mb-4">{err}</p>}

        {previewUrl && !busy && (
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Афіша" className="w-full rounded-xl border border-gold/30" />
            {bad && (
              <p className="text-muted text-xs mt-2">
                Фон не вдалося вирізати — фото стоїть у рамці. Для кращого результату обери фото на однотонному світлому фоні.
              </p>
            )}
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
