import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { countryOfUser, settingsForCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// Опрос на главной: текущий вопрос (его задаёт CRM) и ответ человека. Один ответ на вопрос.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "survey", 20, 60, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));

  const set = await settingsForCountry(["survey_question"], await countryOfUser(uid));
  const question = String(set.survey_question ?? "").trim();

  const { data: prev } = question
    ? await supabaseAdmin.from("survey_answers").select("id").eq("user_id", uid).eq("question", question).limit(1)
    : { data: [] as any[] };
  const answered = (prev ?? []).length > 0;

  if (b.action === "answer") {
    if (!question) return bad("no_question");
    if (answered) return NextResponse.json({ ok: true, answered: true });
    const answer = String(b.answer ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (!answer) return bad("empty");
    const { error } = await supabaseAdmin.from("survey_answers").insert({ user_id: uid, question, answer });
    if (error) return bad("failed", 500);
    return NextResponse.json({ ok: true, answered: true });
  }

  return NextResponse.json({ ok: true, question, answered });
}
