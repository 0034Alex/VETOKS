import { NextResponse } from "next/server";
import { requireUser } from "@/lib/shopServer";
import { rateLimit } from "@/lib/rateLimit";
import { posterProfile } from "@/lib/posterServer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Вырезает фон на фото участницы. Работает через сервис Photoroom (или remove.bg) — ключ в настройках Vercel.
// Если ключа нет, отвечаем ошибкой, а страница сама поставит фото в рамку без вырезки.
export async function POST(req: Request) {
  const uid = await requireUser(req);
  if (uid instanceof NextResponse) return uid;
  const limited = await rateLimit(req, "poster_cutout", 8, 86400, uid);
  if (limited) return limited;
  if (!(await posterProfile(uid))) return NextResponse.json({ ok: false, error: "not_participant" }, { status: 403 });

  const pr = process.env.PHOTOROOM_API_KEY;
  const rb = process.env.REMOVEBG_API_KEY;
  if (!pr && !rb) return NextResponse.json({ ok: false, error: "no_provider" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0 || file.size > 3_500_000) {
    return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });
  }
  const type = (file as any).type || "";
  if (type !== "image/jpeg" && type !== "image/png") return NextResponse.json({ ok: false, error: "bad_file" }, { status: 400 });

  try {
    let res: Response;
    if (pr) {
      const fd = new FormData();
      fd.append("image_file", file, "photo.jpg");
      res = await fetch("https://sdk.photoroom.com/v1/segment", {
        method: "POST",
        headers: { "x-api-key": pr, Accept: "image/png" },
        body: fd,
      });
    } else {
      const fd = new FormData();
      fd.append("image_file", file, "photo.jpg");
      fd.append("size", "auto");
      fd.append("format", "png");
      res = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: { "X-Api-Key": rb as string },
        body: fd,
      });
    }
    if (!res.ok) return NextResponse.json({ ok: false, error: "provider_failed" }, { status: 502 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 4_200_000) return NextResponse.json({ ok: false, error: "too_big" }, { status: 502 });
    return new NextResponse(buf, { status: 200, headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "provider_failed" }, { status: 502 });
  }
}
