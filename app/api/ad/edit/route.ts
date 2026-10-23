import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MAX_IMG = 3 * 1024 * 1024;

// Правка материала рекламы.
// • Реклама уже оплачена и идёт: старая версия продолжает показываться, правка уходит на проверку в CRM.
// • Ещё не оплачена (на рассмотрении / одобрена / отклонена): заявка возвращается на проверку, срок оплаты не продлевается.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "ad/edit", 20, 3600, uid);
  if (rl) return rl;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return bad("bad_request");
  }
  const s = (k: string, n: number) => String(fd.get(k) ?? "").trim().slice(0, n);
  const id = s("requestId", 60);
  const company = s("company", 120);
  let link = s("linkUrl", 300);
  const adText = s("adText", 1000);
  const comment = s("comment", 1000);
  if (!id || !company) return bad("bad_request");
  if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;

  const { data: r } = await supabaseAdmin
    .from("ad_slot_requests")
    .select("id, status, image_url, ad_slots(category)")
    .eq("id", id)
    .eq("user_id", uid)
    .maybeSingle();
  if (!r) return bad("not_found", 404);
  if (!["new", "approved", "rejected", "paid"].includes(String(r.status))) return bad("busy", 409);
  const sl: any = Array.isArray((r as any).ad_slots) ? (r as any).ad_slots[0] : (r as any).ad_slots;
  const isJury = String(sl?.category ?? "").replace(/_gf$/, "") === "jury";
  if (!isJury && !link) return bad("need_link");

  let imageUrl: string | null = (r.image_url as string | null) ?? null;
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
  if (!isJury && !imageUrl) return bad("need_image");

  const fields = { name: company, link_url: link || null, ad_text: adText || null, message: comment || null, image_url: imageUrl };

  if (r.status === "paid") {
    await supabaseAdmin
      .from("ad_slot_requests")
      .update({ pending_edit: fields, edit_kind: "edit_live" })
      .eq("id", id);
    return NextResponse.json({ ok: true, state: "review_live" });
  }

  await supabaseAdmin
    .from("ad_slot_requests")
    .update({ ...fields, status: "new", edit_kind: "edit_prepay", decision_note: null })
    .eq("id", id);
  return NextResponse.json({ ok: true, state: "review" });
}
