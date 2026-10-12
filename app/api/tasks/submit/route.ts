import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";

export const dynamic = "force-dynamic";

// Участница отправляет задание на проверку.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const taskId = String(body.taskId ?? "");
  if (!taskId) return bad("no_task");

  const { data: p } = await supabaseAdmin
    .from("participants")
    .select("id, region_id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!p) return bad("not_participant", 403);

  const { data: t } = await supabaseAdmin
    .from("custom_tasks")
    .select("id, is_active, deadline, region_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!t || !t.is_active) return bad("no_task", 404);
  if (t.deadline && new Date(t.deadline).getTime() + 86400000 < Date.now()) return bad("expired");
  if (t.region_id && t.region_id !== p.region_id) return bad("wrong_region", 403);

  const { error } = await supabaseAdmin
    .from("task_completions")
    .insert({ task_id: taskId, participant_id: p.id, status: "pending" });
  if (error) return bad("already_sent");
  return NextResponse.json({ ok: true });
}
