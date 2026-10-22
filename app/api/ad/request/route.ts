import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { slotFree } from "@/lib/adServer";

export const dynamic = "force-dynamic";

const MAX_IMG = 3 * 1024 * 1024;

// Заявка на рекламное место: данные рекламодателя, текст, ссылка и картинка. Дальше — решение в CRM, потом оплата.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "ad/request", 10, 3600, uid);
  if (rl) return rl;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return bad("bad_request");
  }
  const s = (k: string, n: number) => String(fd.get(k) ?? "").trim().slice(0, n);
  const slotId = s("slotId", 60);
  const company = s("company", 120);
  const phone = s("phone", 40);
  const email = s("email", 120);
  let link = s("linkUrl", 300);
  const adText = s("adText", 1000);
  const comment = s("comment", 1000);
  if (!slotId || !company) return bad("empty_name");
  if (!phone && !email) return bad("empty_contact");
  if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;

  const { data: slot } = await supabaseAdmin
    .from("ad_slots")
    .select("id, category, status, capacity, sold_count")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) return bad("no_slot", 404);
  if (!slotFree(slot)) return bad("slot_full", 409);

  const { data: dup } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id")
    .eq("user_id", uid)
    .eq("slot_id", slotId)
    .in("status", ["new", "approved"])
    .limit(1);
  if ((dup ?? []).length) return bad("already", 409);

  let imageUrl: string | null = null;
  const file = fd.get("file");
  if (file && typeof file !== "string" && (file as File).size > 0) {
    const f = file as File;
    if (!String(f.type).startsWith("image/")) return bad("bad_image");
    if (f.size > MAX_IMG) return bad("image_big");
    const ext = (f.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
    const path = `${uid}-${Date.now()}.${ext}`;
    const { error: ue } = await supabaseAdmin.storage
      .from("partner-creatives")
      .upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type });
    if (ue) return bad("upload_failed", 500);
    imageUrl = supabaseAdmin.storage.from("partner-creatives").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabaseAdmin.from("ad_slot_requests").insert({
    slot_id: slotId,
    user_id: uid,
    name: company,
    phone,
    email,
    link_url: link || null,
    ad_text: adText || null,
    message: comment || null,
    image_url: imageUrl,
    status: "new",
  });
  if (error) return bad("failed", 500);
  return NextResponse.json({ ok: true });
}
