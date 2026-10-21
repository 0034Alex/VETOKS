import { autoFollowOfficial } from "@/lib/officialFollow";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer, tokenHashForUser } from "@/lib/authServer";
import { rateLimit } from "@/lib/rateLimit";
import { familyMembers, familyRootId, MAX_SUB_ACCOUNTS } from "@/lib/familyServer";

export const dynamic = "force-dynamic";

// Добавить дополнительный аккаунт (до 2). Только после подтверждения номера
// в основном аккаунте. Номер и Telegram остаются за основным.
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });
  const rl = await rateLimit(req, "accounts/create", 5, 3600, userId);
  if (rl) return rl;

  const body = await req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim().slice(0, 60);
  if (!firstName) return NextResponse.json({ status: "error", message: "Введите имя." });

  const rootId = await familyRootId(userId);
  if (!rootId) return NextResponse.json({ status: "error" }, { status: 404 });

  const { data: root } = await supabaseAdmin
    .from("users")
    .select("phone_verified, region_id, is_banned, birth_date, age_category")
    .eq("id", rootId)
    .maybeSingle();
  if (!root?.phone_verified) {
    return NextResponse.json({ status: "error", message: "Сначала подтвердите номер в основном аккаунте." });
  }
  if (root.is_banned) return NextResponse.json({ status: "error", message: "Аккаунт заблокирован." });

  const members = await familyMembers(rootId);
  if (members.length - 1 >= MAX_SUB_ACCOUNTS) {
    return NextResponse.json({ status: "error", message: "Можно иметь не больше 3 аккаунтов." });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: `sub-${randomUUID()}@sub.vetoks.app`,
    password: randomBytes(24).toString("hex"),
    email_confirm: true,
  });
  if (createError || !created?.user) {
    return NextResponse.json({ status: "error", message: "Не удалось создать аккаунт." });
  }

  const { error: insertError } = await supabaseAdmin.from("users").insert({
    id: created.user.id,
    first_name: firstName,
    region_id: root.region_id,
    birth_date: (root as any).birth_date ?? null,
    age_category: (root as any).age_category ?? null,
    role: "viewer",
    parent_user_id: rootId,
    // Номер подтверждён у основного — дополнительному повторно не нужен.
    phone_verified: true,
    phone_verified_at: new Date().toISOString(),
  });
  if (insertError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ status: "error", message: "Не удалось сохранить аккаунт." });
  }

  await autoFollowOfficial(created.user.id, root.region_id as string);

  const tokenHash = await tokenHashForUser(created.user.id);
  if (!tokenHash) return NextResponse.json({ status: "error", message: "Ошибка входа." });
  return NextResponse.json({ status: "ok", token_hash: tokenHash });
}
