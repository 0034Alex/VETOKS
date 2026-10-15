import { NextRequest, NextResponse } from "next/server";
import { userIdFromBearer, tokenHashForUser } from "@/lib/authServer";
import { familyMembers, familyRootId } from "@/lib/familyServer";

export const dynamic = "force-dynamic";

// Переключение между своими аккаунтами: только внутри своей «семьи».
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });

  const { targetId } = await req.json().catch(() => ({}));
  const rootId = await familyRootId(userId);
  if (!rootId || !targetId) return NextResponse.json({ status: "error" }, { status: 400 });

  const members = await familyMembers(rootId);
  const target = members.find((m) => m.id === String(targetId));
  if (!target) return NextResponse.json({ status: "error", message: "Это не ваш аккаунт." }, { status: 403 });
  if (members.some((m) => m.id === rootId && m.is_banned)) {
    return NextResponse.json({ status: "error", message: "Аккаунт заблокирован." }, { status: 403 });
  }

  const tokenHash = await tokenHashForUser(target.id);
  if (!tokenHash) return NextResponse.json({ status: "error" }, { status: 500 });
  return NextResponse.json({ status: "ok", token_hash: tokenHash });
}
