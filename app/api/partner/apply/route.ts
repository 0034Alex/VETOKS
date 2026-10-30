import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser } from "@/lib/countryServer";
import { attachAdvertiserReferrer } from "@/lib/referral";

export const dynamic = "force-dynamic";

// Заявка «Стать партнёром». Запись делает сервер: напрямую из приложения таблица закрыта.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "partner/apply", 5, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 120);
  const phone = String(b.phone ?? "").trim().slice(0, 40);
  const email = String(b.email ?? "").trim().slice(0, 120);
  const message = String(b.message ?? "").trim().slice(0, 1500);
  if (!name) return bad("empty_name");
  if (!phone && !email) return bad("empty_contact");

  // Уже есть активная заявка или одобренный партнёр: вторую не создаём.
  const { data: ex } = await supabaseAdmin.from("sponsors").select("id, status").eq("user_id", uid).in("status", ["lead", "approved"]).limit(1);
  if ((ex ?? []).length) return bad("already", 409);

  const { data: u } = await supabaseAdmin.from("users").select("region_id").eq("id", uid).maybeSingle();
  const regionId = b.regionId ? String(b.regionId) : (u as any)?.region_id ?? null;
  const { data: created, error } = await supabaseAdmin
    .from("sponsors")
    .insert({
      country_id: await countryOfUser(uid),
      name,
      status: "lead",
      region_id: regionId,
      contact_info: { phone, email, message },
      user_id: uid,
    })
    .select("id")
    .maybeSingle();
  if (error) return bad("failed", 500);
  // Пришёл по ссылке «для рекламодателя»: записываем, кто его привёл, и процент из CRM.
  if (created?.id) await attachAdvertiserReferrer(created.id as string, uid);
  return NextResponse.json({ ok: true });
}
