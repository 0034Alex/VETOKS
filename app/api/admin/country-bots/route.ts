import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { resetBotCache, postToCountryChannel } from "@/lib/countryBot";

export const dynamic = "force-dynamic";

const clean = (v: any, n: number) => String(v ?? "").trim().slice(0, n);
const tg = async (token: string, method: string, body?: object) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return (await r.json().catch(() => ({}))) as any;
  } catch {
    return { ok: false, description: "Нет связи с Telegram" };
  }
};

// Боты и каналы стран: только владелец. Токен наружу не отдаём — только «задан».
export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const a = b.action;

  if (a === "list") {
    const { data: cs } = await supabaseAdmin.from("countries").select("id, name").order("name");
    const { data: rows, error } = await supabaseAdmin.from("country_bots").select("country_id, bot_username, bot_token, channel_link, channel_chat");
    if (error) return NextResponse.json({ ok: false, message: "Таблица country_bots не создана — выполните SQL." });
    const m = new Map<string, any>(((rows ?? []) as any[]).map((r) => [r.country_id, r]));
    const items = ((cs ?? []) as any[]).map((c) => {
      const r = m.get(c.id);
      return {
        countryId: c.id,
        country: c.name,
        botUsername: r?.bot_username ?? "",
        hasToken: !!r?.bot_token,
        channelLink: r?.channel_link ?? "",
        channelChat: r?.channel_chat ?? "",
      };
    });
    return NextResponse.json({ ok: true, items });
  }

  const cid = clean(b.countryId, 64);
  if (!cid) return NextResponse.json({ ok: false }, { status: 400 });

  if (a === "save") {
    const { data: old } = await supabaseAdmin.from("country_bots").select("bot_token").eq("country_id", cid).maybeSingle();
    const token = clean(b.botToken, 200);
    if (token && !/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) return NextResponse.json({ ok: false, message: "Токен выглядит неверно. Скопируйте его из BotFather целиком." });
    const row: any = {
      country_id: cid,
      bot_username: clean(b.botUsername, 64).replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "") || null,
      channel_link: clean(b.channelLink, 200) || null,
      channel_chat: clean(b.channelChat, 64) || null,
      bot_token: token || (old as any)?.bot_token || null,
    };
    const { error } = await supabaseAdmin.from("country_bots").upsert(row, { onConflict: "country_id" });
    if (error) return NextResponse.json({ ok: false, message: "Не удалось сохранить: " + error.message });
    resetBotCache();
    await logAction(uid, "country_bot_save", cid, { token_changed: !!token });
    return NextResponse.json({ ok: true });
  }

  if (a === "clear_token") {
    await supabaseAdmin.from("country_bots").update({ bot_token: null }).eq("country_id", cid);
    resetBotCache();
    await logAction(uid, "country_bot_clear", cid, {});
    return NextResponse.json({ ok: true });
  }

  if (a === "connect") {
    const { data: r } = await supabaseAdmin.from("country_bots").select("bot_token").eq("country_id", cid).maybeSingle();
    const token = (r as any)?.bot_token;
    if (!token) return NextResponse.json({ ok: false, message: "Сначала сохраните токен бота." });
    const me = await tg(token, "getMe");
    if (!me?.ok) return NextResponse.json({ ok: false, message: "Telegram не принял токен: " + (me?.description || "ошибка") });
    const origin = new URL(req.url).origin;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
    const wh = await tg(token, "setWebhook", {
      url: `${origin}/api/telegram-webhook?c=${encodeURIComponent(cid)}`,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ["message", "callback_query"],
    });
    if (!wh?.ok) return NextResponse.json({ ok: false, message: "Не удалось подключить: " + (wh?.description || "ошибка") });
    const uname = String(me.result?.username || "");
    if (uname) await supabaseAdmin.from("country_bots").update({ bot_username: uname }).eq("country_id", cid);
    resetBotCache();
    await logAction(uid, "country_bot_connect", cid, { bot: uname });
    return NextResponse.json({ ok: true, username: uname });
  }

  if (a === "test_channel") {
    resetBotCache();
    const r = await postToCountryChannel(cid, "✅ Проверка связи: официальный бот VETOKS подключён к этому каналу.");
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, message: r.error });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
