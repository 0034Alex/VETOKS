import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";

const STAFF = ["moderator", "finance_admin", "super_admin"];

// Безвозвратное удаление своего аккаунта. Личные данные, фото, сообщения, каналы и вход стираются.
// Если какая-то запись связана с деньгами (история платежей) и не удаляется — она остаётся без имени и контактов.
async function quiet(p: PromiseLike<any>) {
  try {
    await p;
  } catch {
    /* не мешаем удалению */
  }
}

export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "account/delete", 5, 3600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== true) return bad("confirm");

  const { data: u } = await supabaseAdmin.from("users").select("id, role, is_official").eq("id", uid).maybeSingle();
  if (!u) return bad("no_user", 404);
  if (STAFF.includes(String((u as any).role)) || (u as any).is_official) return bad("staff", 403);

  // 1. Файлы: фото и аудио с префиксом «<id>-»
  for (const bucket of ["participant-photos", "channel-audio"]) {
    await quiet(
      (async () => {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list("", { limit: 1000, search: uid });
        const names = (files ?? []).map((f: any) => f.name as string).filter((n) => n.startsWith(`${uid}-`));
        if (names.length) await supabaseAdmin.storage.from(bucket).remove(names);
      })()
    );
  }

  // 2. Каналы владельца и всё внутри
  await quiet(
    (async () => {
      const { data: chs } = await supabaseAdmin.from("channels").select("id").eq("owner_id", uid);
      const ids = (chs ?? []).map((c: any) => c.id as string);
      if (ids.length) {
        const { data: ps } = await supabaseAdmin.from("channel_posts").select("id").in("channel_id", ids);
        const pids = (ps ?? []).map((p: any) => p.id as string);
        if (pids.length) {
          await supabaseAdmin.from("channel_comments").delete().in("post_id", pids);
          await supabaseAdmin.from("channel_reactions").delete().in("post_id", pids);
          await supabaseAdmin.from("channel_views").delete().in("post_id", pids);
        }
        await supabaseAdmin.from("channel_posts").delete().in("channel_id", ids);
        await supabaseAdmin.from("channel_members").delete().in("channel_id", ids);
        await supabaseAdmin.from("channels").delete().in("id", ids);
      }
    })()
  );

  // 3. Личное: подписки, сообщения, черновики, уведомления
  const own: [string, string][] = [
    ["channel_members", "user_id"],
    ["channel_comments", "user_id"],
    ["channel_reactions", "user_id"],
    ["region_clan_messages", "user_id"],
    ["post_drafts", "user_id"],
    ["notifications", "user_id"],
    ["participant_follows", "user_id"],
    ["user_follows", "follower_id"],
    ["user_follows", "followed_id"],
    ["user_blocks", "blocker_id"],
    ["user_blocks", "blocked_id"],
    ["telegram_links", "user_id"],
    ["pwa_installs", "user_id"],
  ];
  for (const [t, c] of own) await quiet(supabaseAdmin.from(t).delete().eq(c, uid));

  // 4. Анкета участницы
  await quiet(supabaseAdmin.from("participants").delete().eq("user_id", uid));

  // 5. Сама запись пользователя. Не удалилась (есть история платежей) — стираем имя и контакты.
  const del = await supabaseAdmin.from("users").delete().eq("id", uid);
  if (del.error) {
    const wipe: Record<string, unknown>[] = [
      { first_name: "Удалённый аккаунт" },
      { phone: null },
      { email: null },
      { bio: null },
      { photo_url: null },
      { telegram_id: null },
      { nick: null },
      { social_links: [] },
      { phone_verified: false },
    ];
    for (const w of wipe) await quiet(supabaseAdmin.from("users").update(w).eq("id", uid));
  }

  // 6. Вход
  const au = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (au.error) return NextResponse.json({ ok: false, error: "server" }, { status: 500 });

  await quiet(logSecurity("account_deleted", { mode: del.error ? "anonymized" : "full" }, { req, userId: null }));
  return NextResponse.json({ ok: true, mode: del.error ? "anonymized" : "full" });
}
