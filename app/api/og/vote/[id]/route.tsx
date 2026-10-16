import { ImageResponse } from "next/og";
import { getCardInfo } from "@/lib/cardInfo";

export const dynamic = "force-dynamic";

// Картинка для предпросмотра ссылки (Telegram, Instagram, WhatsApp...): 1200×630.
async function photoData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    const type = r.headers.get("content-type") || "";
    // Движок рисует только JPEG/PNG; другие форматы пропускаем (будет красивый фон без фото).
    if (!/image\/(jpeg|jpg|png)/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const info = await getCardInfo(params.id);
  let font: ArrayBuffer | null = null;
  try {
    font = await (await fetch(new URL("/fonts/Inter-Bold.otf", req.url))).arrayBuffer();
  } catch {}
  const photo = await photoData(info?.photoUrl ?? null);
  const name = info?.name ?? "VETOKS";
  const place =
    info?.rank && info.inRegion
      ? `№${info.rank} · ${info.region ?? ""}`.trim()
      : info?.region ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg,#1a0b2e 0%,#0b0b12 55%,#2a1a05 100%)",
          fontFamily: "Inter",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "56px 64px", flex: 1 }}>
          <div style={{ display: "flex", color: "#E8C65A", fontSize: 30, letterSpacing: 8 }}>♛ VETOKS</div>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, marginTop: 28, fontWeight: 700 }}>{name}</div>
          {place ? <div style={{ display: "flex", fontSize: 38, color: "#E8C65A", marginTop: 20 }}>{place}</div> : null}
          <div
            style={{
              display: "flex",
              marginTop: 44,
              alignSelf: "flex-start",
              fontSize: 36,
              color: "#1a1405",
              background: "linear-gradient(180deg,#F1DE98,#C9A227)",
              padding: "18px 38px",
              borderRadius: 60,
              fontWeight: 700,
            }}
          >
            Проголосуй за меня
          </div>
        </div>
        <div style={{ display: "flex", width: 460, padding: 40, alignItems: "center", justifyContent: "center" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              width={380}
              height={520}
              style={{ objectFit: "cover", borderRadius: 28, border: "6px solid #C9A227" }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 380,
                height: 520,
                borderRadius: 28,
                border: "6px solid #C9A227",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 160,
                color: "#C9A227",
                background: "#14101f",
              }}
            >
              ♛
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "Inter", data: font, weight: 700, style: "normal" }] : undefined,
    }
  );
}
