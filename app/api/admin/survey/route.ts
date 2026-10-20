import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff } from "@/lib/staffServer";
import { currentStageOfCountry, pollResults } from "@/lib/stagePoll";

export const dynamic = "force-dynamic";

// CRM → «Главная» → «Опрос»: итоги опроса текущего этапа страны (за кого голосовали).
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["moderator", "super_admin", "finance_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const countryId = b.countryId ? String(b.countryId) : null;
  const stage = await currentStageOfCountry(countryId);
  if (!stage || !stage.question) return NextResponse.json({ ok: true, question: "", total: 0, items: [] });
  const { total, rows } = await pollResults(stage.id);
  const ids = rows.map((r) => r.participant_id).slice(0, 200);
  const nm = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabaseAdmin.from("participants").select("id, display_name").in("id", ids);
    ((data ?? []) as any[]).forEach((p) => nm.set(p.id, p.display_name));
  }
  const items = rows.slice(0, 200).map((r, i) => ({
    name: `${i + 1}. ${nm.get(r.participant_id) ?? "—"}`,
    answer: `${r.votes} голосов`,
    at: r.last_at,
  }));
  return NextResponse.json({ ok: true, question: `Этап ${stage.stage_number}: ${stage.question}`, total, items });
}
