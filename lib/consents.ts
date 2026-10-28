import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { countryOfUser } from "@/lib/countryServer";

export type ConsentPlace = "register" | "apply";

// Документы, которые CRM отметила «показывать при регистрации / при подаче анкеты».
// Свои документы страны (country_id) важнее стандартных с тем же названием; чужих стран не видно.
export async function consentDocs(place: ConsentPlace, countryId?: string | null) {
  type Row = { id: string; title: string; version: number; country_id?: string | null };
  let rows: Row[] = [];
  const q1 = await supabaseAdmin
    .from("documents")
    .select("id, title, version, show_at, sort_order, country_id")
    .eq("is_active", true)
    .in("show_at", [place, "both"])
    .order("sort_order", { ascending: true });
  if (!q1.error) rows = (q1.data ?? []) as any[];
  else {
    // колонки country_id ещё нет — работаем как раньше
    const q2 = await supabaseAdmin
      .from("documents")
      .select("id, title, version, show_at, sort_order")
      .eq("is_active", true)
      .in("show_at", [place, "both"])
      .order("sort_order", { ascending: true });
    if (q2.error) return [] as { id: string; title: string; version: number }[];
    rows = (q2.data ?? []) as any[];
  }
  const own = rows.filter((d) => countryId && d.country_id === countryId);
  const ownTitles = new Set(own.map((d) => String(d.title).trim().toLowerCase()));
  const std = rows.filter((d) => !d.country_id && !ownTitles.has(String(d.title).trim().toLowerCase()));
  const pick = [...std, ...own];
  return pick.map((d) => ({ id: String(d.id), title: String(d.title), version: Number(d.version ?? 1) }));
}

// Запомнить, какие документы и какой версии человек принял (для споров). Ошибки молча пропускаем.
export async function recordConsents(userId: string, place: ConsentPlace) {
  try {
    const docs = await consentDocs(place, await countryOfUser(userId));
    if (!docs.length) return;
    await supabaseAdmin
      .from("user_consents")
      .insert(docs.map((d) => ({ user_id: userId, document_id: d.id, document_title: d.title, version: d.version, place })));
  } catch {
    /* не должно мешать регистрации */
  }
}
