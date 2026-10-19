import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ConsentPlace = "register" | "apply";

// Документы, которые CRM отметила «показывать при регистрации / при подаче анкеты».
export async function consentDocs(place: ConsentPlace) {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, title, version, show_at, sort_order")
    .eq("is_active", true)
    .in("show_at", [place, "both"])
    .order("sort_order", { ascending: true });
  if (error) return [] as { id: string; title: string; version: number }[]; // колонки ещё нет — старая заглушка
  return ((data ?? []) as any[]).map((d) => ({ id: String(d.id), title: String(d.title), version: Number(d.version ?? 1) }));
}

// Запомнить, какие документы и какой версии человек принял (для споров). Ошибки молча пропускаем.
export async function recordConsents(userId: string, place: ConsentPlace) {
  try {
    const docs = await consentDocs(place);
    if (!docs.length) return;
    await supabaseAdmin
      .from("user_consents")
      .insert(docs.map((d) => ({ user_id: userId, document_id: d.id, document_title: d.title, version: d.version, place })));
  } catch {
    /* не должно мешать регистрации */
  }
}
