import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { normalizePhone, phoneVariants } from "@/lib/phone";

export const dynamic = "force-dynamic";

// Сохранение профиля. Принимаем только безопасные поля; роль, баланс, блокировки сюда не попадают.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const limited = await rateLimit(req, "profupd", 30, 600, uid);
  if (limited) return limited;

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof b.first_name === "string") {
    const n = b.first_name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (n.length < 1) return bad("name");
    patch.first_name = n;
  }
  if (typeof b.bio === "string") patch.bio = b.bio.trim().slice(0, 300) || null;
  if (b.photo_url === null) patch.photo_url = null;
  if (typeof b.photo_url === "string") {
    // Только наши картинки из хранилища.
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    if (!base || !b.photo_url.startsWith(`${base}/storage/v1/object/public/`)) return bad("photo");
    patch.photo_url = b.photo_url.slice(0, 500);
  }

  if (typeof b.phone === "string") {
    const raw = b.phone.trim();
    const { data: cur } = await supabaseAdmin.from("users").select("phone").eq("id", uid).maybeSingle();
    const same = !!cur?.phone && phoneVariants(String(cur.phone)).includes(normalizePhone(raw));
    if (!same) {
      if (raw === "") {
        patch.phone = null;
      } else {
        const digits = raw.replace(/\D/g, "");
        if (digits.length < 9 || digits.length > 15) return bad("phone");
        // Чужой номер занять нельзя.
        const { data: taken } = await supabaseAdmin
          .from("users")
          .select("id")
          .in("phone", phoneVariants(raw))
          .neq("id", uid)
          .limit(1);
        if (taken && taken.length) return bad("phone_taken", 409);
        patch.phone = normalizePhone(raw);
      }
      // Новый номер нужно подтвердить заново.
      patch.phone_verified = false;
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
  const { error } = await supabaseAdmin.from("users").update(patch).eq("id", uid);
  if (error) return bad("save", 500);
  return NextResponse.json({ ok: true, phone_changed: "phone" in patch });
}
