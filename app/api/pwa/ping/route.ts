import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Учёт установок PWA: установка (event "install") и запуск с экрана «Домой» (event "open").
export async function POST(req: Request) {
  const rl = await rateLimit(req, "pwa/ping", 20, 3600);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const ua = String(req.headers.get("user-agent") ?? "");
  const platform = /iphone|ipad|ios/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "desktop";
  const now = new Date().toISOString();

  let uid: string | null = null;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    uid = data?.user?.id ?? null;
  }

  if (uid) {
    const { data: ex } = await supabaseAdmin.from("pwa_installs").select("id").eq("user_id", uid).limit(1).maybeSingle();
    if (ex) {
      await supabaseAdmin.from("pwa_installs").update({ last_seen: now, platform }).eq("id", (ex as any).id);
      return NextResponse.json({ ok: true });
    }
  } else if (b.event !== "install") {
    return NextResponse.json({ ok: true });
  }
  await supabaseAdmin.from("pwa_installs").insert({ user_id: uid, platform, last_seen: now });
  return NextResponse.json({ ok: true });
}
