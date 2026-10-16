import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await userIdFromBearer(req);
  if (!userId) return NextResponse.json({ status: "error" }, { status: 401 });

  const { data } = await supabaseAdmin
    .from("users")
    .select("phone, phone_verified, created_at, verify_prompt_at, verify_dismiss_at")
    .eq("id", userId)
    .maybeSingle();

  return NextResponse.json({
    status: "ok",
    verified: !!data?.phone_verified,
    phone: data?.phone_verified ? data.phone : null,
    createdAt: data?.created_at ?? null,
    promptAt: (data as any)?.verify_prompt_at ?? null,
    dismissAt: (data as any)?.verify_dismiss_at ?? null,
  });
}
