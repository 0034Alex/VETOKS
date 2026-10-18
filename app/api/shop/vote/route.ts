import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { blockOtherCountry, bad, notify, participantOwner, requireUser } from "@/lib/shopServer";

import { pickText } from "@/lib/pushText";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Голосование. Все проверки (номер, лимиты, баланс) — внутри базы одной операцией.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "shop/vote", 40, 60, uid);
  if (rl) return rl;

  const body = await req.json().catch(() => ({}));
  const participantId = String(body.participantId || "");
  const count = Math.floor(Number(body.count) || 1);
  if (!participantId) return bad("bad_request");
  const oc = await blockOtherCountry(uid, participantId);
  if (oc) return oc;


  const { data, error } = await supabaseAdmin.rpc("vt_cast_votes", {
    p_user: uid,
    p_participant: participantId,
    p_count: count,
  });
  if (error || !data) return bad("server", 500);

  // Участница узнаёт, что за неё проголосовали (не чаще раза в 30 минут, чтобы не спамить).
  if ((data as any).ok) {
    try {
      const owner = await participantOwner(participantId);
      if (owner) {
        const since = new Date(Date.now() - 30 * 60000).toISOString();
        const { count } = await supabaseAdmin
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", owner.user_id)
          .like("message", "🗳%")
          .gte("created_at", since);
        if (!count) {
          const text = await pickText(owner.user_id, {
            ru: "🗳 За вас проголосовали! Позовите друзей — каждый голос приближает вас к короне.",
            uk: "🗳 За вас проголосували! Покличте друзів — кожен голос наближає вас до корони.",
            en: "🗳 Someone just voted for you! Invite friends — every vote brings you closer to the crown.",
          });
          await notify(owner.user_id, text, `/participant/${participantId}`, "votes");
        }
      }
    } catch {
      /* уведомление не должно ломать голосование */
    }
  }
  return NextResponse.json(data);
}
