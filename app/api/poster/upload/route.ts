import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { parentConsentOk } from "@/lib/parentServer";
import { hasBadWords } from "@/lib/badWords";
import { countryOfUser } from "@/lib/countryServer";
import { posterProfile, posterChat, sendPosterToTg, POSTER_CAT_LABEL } from "@/lib/posterServer";

export const dynamic = "force-dynamic";

// Готовая афиша участницы: сохраняем в хранилище, записываем в CRM и отправляем в Telegram-чат нужной категории.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const limited = await rateLimit(req, "poster_upload", 10, 86400, uid);
  if (limited) return limited;

  const p = await posterProfile(uid);
  if (!p) return NextResponse.json({ ok: false, error: "not_participant" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  if (String(form.get("consent")) !== "1") return NextResponse.json({ ok: false, error: "need_consent" }, { status: 400 });
  if (!(await parentConsentOk(uid))) return NextResponse.json({ ok: false, error: "need_parent" }, { status: 403 });

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0 || file.size > 4_000_000 || (file as any).type !== "image/jpeg") {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }
  const h = Math.round(Number(form.get("height")));
  const height = h >= 120 && h <= 220 ? h : null;
  const bad = String(form.get("bad")) === "1";
  const interests = String(form.get("interests") ?? "").trim().slice(0, 80);
  const about = String(form.get("about") ?? "").trim().slice(0, 120);
  if (hasBadWords(`${interests} ${about}`)) return NextResponse.json({ ok: false, error: "bad_words" }, { status: 400 });

  const path = `${uid}/${Date.now()}.jpg`;
  const buf = Buffer.from(await file.arrayBuffer());
  const up = await supabaseAdmin.storage.from("posters").upload(path, buf, { contentType: "image/jpeg", upsert: false });
  if (up.error) return NextResponse.json({ ok: false, error: "storage" }, { status: 500 });
  const url = supabaseAdmin.storage.from("posters").getPublicUrl(path).data.publicUrl;

  const { data: row } = await supabaseAdmin
    .from("participant_posters")
    .insert({
      user_id: uid,
      participant_id: p.participantId,
      age_category: p.cat,
      name: p.name,
      city: p.city,
      image_url: url,
      height_cm: height,
      bad_cutout: bad,
      interests: interests || null,
      about_text: about || null,
    })
    .select("id")
    .single();

  let sent = false;
  const pCountry = await countryOfUser(uid);
  const chat = await posterChat(p.cat, pCountry);
  if (chat) {
    const caption = [
      p.name,
      POSTER_CAT_LABEL[p.cat] ?? p.cat,
      [p.city, p.country].filter(Boolean).join(", "),
      [p.age ? `${p.age} р.` : "", height ? `${height} см` : ""].filter(Boolean).join(" · "),
      bad ? "⚠️ Фон не вирізано — краще перезняти" : "",
    ]
      .filter(Boolean)
      .join("\n");
    const r = await sendPosterToTg(pCountry, chat, url, caption);
    sent = r.ok;
    if (sent && row) await supabaseAdmin.from("participant_posters").update({ sent_tg: true }).eq("id", (row as any).id);
  }
  return NextResponse.json({ ok: true, url, sent });
}
