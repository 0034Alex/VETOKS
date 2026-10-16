import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GOOGLE_CODE, isLang } from "@/lib/langs";

export const dynamic = "force-dynamic";

// Автоперевод текстов из CRM. Сначала смотрим в базу (translations),
// чего нет — переводим через Google (если задан ключ) и запоминаем.
const hits = new Map<string, { n: number; t: number }>();

function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 40;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 40);

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "x";
  if (limited(ip)) return NextResponse.json({ ok: false, error: "rate" }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const lang = body.lang;
  if (!isLang(lang)) return NextResponse.json({ ok: false, error: "lang" }, { status: 400 });
  const raw: unknown[] = Array.isArray(body.texts) ? body.texts.slice(0, 50) : [];
  const texts = Array.from(
    new Set(raw.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter((x) => x.length > 0 && x.length <= 800))
  );
  if (!texts.length) return NextResponse.json({ ok: true, map: {} });

  const hs = texts.map(hash);
  const map: Record<string, string> = {};
  try {
    const { data } = await supabaseAdmin.from("translations").select("h, text").eq("lang", lang).in("h", hs);
    const found: Record<string, string> = {};
    (data ?? []).forEach((r: any) => (found[r.h] = r.text));
    const missing: string[] = [];
    texts.forEach((t, i) => {
      const f = found[hs[i]];
      if (f != null && f !== "") map[t] = f;
      else missing.push(t);
    });

    const key = process.env.GOOGLE_TRANSLATE_KEY;
    if (missing.length && key) {
      const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: missing, target: GOOGLE_CODE[lang], format: "text" }),
      });
      if (r.ok) {
        const j = await r.json();
        const out: any[] = j?.data?.translations ?? [];
        const rows: any[] = [];
        missing.forEach((t, i) => {
          const tt = out[i]?.translatedText;
          if (typeof tt === "string" && tt) {
            map[t] = tt;
            rows.push({ lang, h: hash(t), src: t, text: tt, manual: false, updated_at: new Date().toISOString() });
          }
        });
        if (rows.length) await supabaseAdmin.from("translations").upsert(rows, { onConflict: "lang,h", ignoreDuplicates: true });
      }
    }
  } catch {}
  return NextResponse.json({ ok: true, map });
}
