import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { settingsForCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// CRM → «Главная» → «Опрос»: ответы людей на текущий вопрос.
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin", "finance_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const countryId = b.countryId ? String(b.countryId) : null;
  const set = await settingsForCountry(["survey_question"], countryId);
  const question = String(set.survey_question ?? "").trim();
  if (!question) return NextResponse.json({ ok: true, question: "", total: 0, items: [] });

  const { count } = await supabaseAdmin.from("survey_answers").select("id", { count: "exact", head: true }).eq("question", question);
  const { data: rows } = await supabaseAdmin
    .from("survey_answers")
    .select("user_id, answer, created_at")
    .eq("question", question)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = Array.from(new Set(((rows ?? []) as any[]).map((r) => r.user_id).filter(Boolean)));
  const { data: us } = ids.length ? await supabaseAdmin.from("users").select("id, first_name").in("id", ids as string[]) : { data: [] as any[] };
  const nm = new Map<string, string>(((us ?? []) as any[]).map((u: any) => [u.id, u.first_name]));
  const items = ((rows ?? []) as any[]).map((r) => ({ name: nm.get(r.user_id) ?? "—", answer: r.answer as string, at: r.created_at as string }));
  return NextResponse.json({ ok: true, question, total: count ?? items.length, items });
}
