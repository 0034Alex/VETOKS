import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { countryOfUser } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

// «Вопрос недели» на главной между шоу. Ответы видит только владелец в CRM.
export async function POST(req: Request) {
  const uid = await userIdFromBearer(req);
  if (!uid) return NextResponse.json({ ok: false, message: "Войдите в аккаунт." }, { status: 401 });
  const cid = await countryOfUser(uid);
  if (!cid) return NextResponse.json({ ok: true, question: "", answered: false });
  const b = await req.json().catch(() => ({}));
  const { data: st } = await supabaseAdmin.from("platform_settings").select("value").eq("key", `between_question:${cid}`).maybeSingle();
  const question = String(st?.value ?? "").trim().slice(0, 300);
  if (!question) return NextResponse.json({ ok: true, question: "", answered: false });
  const { data: prev } = await supabaseAdmin.from("between_answers").select("id").eq("user_id", uid).eq("country_id", cid).eq("question", question).limit(1);
  const answered = !!prev?.length;
  if (b.action === "answer") {
    if (answered) return NextResponse.json({ ok: true, question, answered: true });
    const text = String(b.text ?? "").trim().slice(0, 500);
    if (text.length < 2) return NextResponse.json({ ok: false, message: "Напишите ответ." });
    const { error } = await supabaseAdmin.from("between_answers").insert({ country_id: cid, user_id: uid, question, answer: text });
    if (error) return NextResponse.json({ ok: false, message: "Не получилось отправить." });
    return NextResponse.json({ ok: true, question, answered: true });
  }
  return NextResponse.json({ ok: true, question, answered });
}
