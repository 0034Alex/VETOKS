import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { familyMembers, familyRootId, MAX_SUB_ACCOUNTS } from "@/lib/familyServer";

export const dynamic = "force-dynamic";

// Мои аккаунты (основной + дополнительные) и можно ли добавить ещё.
export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });

  const rootId = await familyRootId(userId);
  if (!rootId) return NextResponse.json({ status: "error" }, { status: 404 });

  const members = await familyMembers(rootId);
  const { data: root } = await supabaseAdmin
    .from("users")
    .select("phone_verified")
    .eq("id", rootId)
    .maybeSingle();

  const subs = members.filter((m) => m.id !== rootId).length;
  return NextResponse.json({
    status: "ok",
    accounts: members.map((m) => ({
      id: m.id,
      name: m.first_name || "Без имени",
      main: m.id === rootId,
      current: m.id === userId,
    })),
    canAdd: !!root?.phone_verified && subs < MAX_SUB_ACCOUNTS,
    needVerify: !root?.phone_verified,
  });
}
