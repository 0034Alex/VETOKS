import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, notify, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";
import { pickText } from "@/lib/pushText";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Подписка на обычного человека (на участниц — прежний способ). on=false — отписаться.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const rl = await rateLimit(req, "profile/follow", 60, 60, me);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const target = String(b.userId || "");
  const on = b.on !== false;
  if (!target || target === me) return bad("bad_request");
  if (!(await sameCountry(me, target))) return bad("not_found", 404);

  const { data: t } = await supabaseAdmin.from("users").select("id, is_banned").eq("id", target).maybeSingle();
  if (!t || t.is_banned) return bad("not_found", 404);

  if (!on) {
    await supabaseAdmin.from("user_follows").delete().eq("follower_id", me).eq("followed_id", target);
    return NextResponse.json({ ok: true, on: false });
  }

  const { data: ex } = await supabaseAdmin
    .from("user_follows")
    .select("id")
    .eq("follower_id", me)
    .eq("followed_id", target)
    .maybeSingle();
  if (!ex) {
    await supabaseAdmin.from("user_follows").insert({ follower_id: me, followed_id: target });
    const { data: u } = await supabaseAdmin.from("users").select("first_name, nick").eq("id", me).maybeSingle();
    const name = (u?.first_name as string) || (u?.nick as string) || "Гость";
    const text = await pickText(target, {
      ru: `👤 ${name} подписался(лась) на вас`,
      uk: `👤 ${name} підписався(лась) на вас`,
      en: `👤 ${name} started following you`,
    });
    await notify(target, text, `/u/${me}`, "other");
  }
  return NextResponse.json({ ok: true, on: true });
}
