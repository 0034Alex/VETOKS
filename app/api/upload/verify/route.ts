import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { logSecurity } from "@/lib/security";
import { parseStorageUrl, verifyStoredFile } from "@/lib/fileCheck";

export const dynamic = "force-dynamic";

// После загрузки своего фото/видео проверяем, что внутри действительно картинка или ролик.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const rl = await rateLimit(req, "upload/verify", 40, 600, uid);
  if (rl) return rl;
  const b = await req.json().catch(() => ({}));
  const url = String(b.url ?? "");
  const p = parseStorageUrl(url);
  // Только свои файлы: имя начинается с номера аккаунта.
  if (!p || !(p.name.startsWith(`${uid}-`) || p.name.startsWith(`raw-${uid}-`))) return bad("bad_url", 400);
  const want = b.want === "video" ? "video" : "image";
  const ok = await verifyStoredFile(url, want);
  if (!ok) {
    await logSecurity("bad_upload_file", { bucket: p.bucket, name: p.name.slice(0, 80) }, { req, userId: uid });
    return bad("bad_file", 400);
  }
  return NextResponse.json({ ok: true });
}
