import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { botForCountry } from "@/lib/countryBot";
import { regionIdsOfCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PAGE = 100;

// CRM → «Рассылка»: сообщение всем, по категориям или выбранным людям.
// Приходит всплывающим окном в приложении и сообщением от бота в Telegram.
// Большие списки уходят порциями по 100 — CRM вызывает метод, пока done не станет true.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  // Страна рассылки: пустая = все страны. Сообщение уходит только людям этой страны и от бота этой страны.
  const countryId = typeof b.countryId === "string" && b.countryId ? b.countryId.slice(0, 64) : null;
  const regionIds = countryId ? await regionIdsOfCountry(countryId) : null;

  if (b.action === "search") {
    const q = String(b.q ?? "").trim().replace(/[,()%]/g, " ");
    if (q.length < 2) return NextResponse.json({ ok: true, items: [] });
    let uq = supabaseAdmin
      .from("users")
      .select("id, first_name, username, telegram_id, age_category")
      .or(`first_name.ilike.%${q}%,username.ilike.%${q}%`);
    if (regionIds) uq = uq.in("region_id", regionIds.length ? regionIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data } = await uq.limit(15);
    return NextResponse.json({
      ok: true,
      items: ((data ?? []) as any[]).map((u) => ({ id: u.id, name: u.first_name || u.username || "—", nick: u.username, tg: !!u.telegram_id, cat: u.age_category || "main" })),
    });
  }

  if (b.action === "count") {
    const { count } = await filtered(b, supabaseAdmin.from("users").select("id", { count: "exact", head: true }), regionIds);
    return NextResponse.json({ ok: true, total: count ?? 0 });
  }

  if (b.action === "send") {
    const text = String(b.text ?? "").trim().slice(0, 1000);
    if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
    const offset = Math.max(0, Number(b.offset ?? 0));
    const { data: rows } = await filtered(b, supabaseAdmin.from("users").select("id, telegram_id"), regionIds).order("id", { ascending: true }).range(offset, offset + PAGE - 1);
    const list = (rows ?? []) as { id: string; telegram_id: string | null }[];

    let tg = 0;
    const token = (await botForCountry(countryId)).token;
    if (token) {
      const targets = list.filter((u) => u.telegram_id);
      for (let i = 0; i < targets.length; i += 25) {
        const chunk = targets.slice(i, i + 25);
        const res = await Promise.allSettled(
          chunk.map((u) =>
            fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: u.telegram_id, text: `📣 VETOKS\n\n${text}` }),
            }).then((x) => x.ok)
          )
        );
        tg += res.filter((x) => x.status === "fulfilled" && x.value).length;
        if (i + 25 < targets.length) await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const done = list.length < PAGE;
    if (offset === 0) await logAction(uid, "broadcast", null, { mode: b.mode, text: text.slice(0, 80) });
    return NextResponse.json({ ok: true, sent: list.length, tg, next: offset + PAGE, done });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}

// Кого выбрали: все / возрастные категории / конкретные люди (и только из выбранной страны).
function filtered(b: any, q: any, regionIds?: string[] | null) {
  q = q.eq("is_banned", false).not("telegram_id", "is", null); // рассылка только в Telegram: берём тех, у кого он привязан
  if (regionIds) q = q.in("region_id", regionIds.length ? regionIds : ["00000000-0000-0000-0000-000000000000"]);
  if (b.mode === "users") {
    const ids = (Array.isArray(b.userIds) ? b.userIds : []).map(String).slice(0, 500);
    return q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (b.mode === "category") {
    const cats = (Array.isArray(b.categories) ? b.categories : []).filter((x: string) => ["teen", "main", "adult"].includes(x));
    if (!cats.length) return q.in("id", ["00000000-0000-0000-0000-000000000000"]);
    return cats.includes("main") ? q.or(`age_category.in.(${cats.join(",")}),age_category.is.null`) : q.in("age_category", cats);
  }
  return q;
}
