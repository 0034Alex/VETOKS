import type { Metadata } from "next";
import { getCardInfo } from "@/lib/cardInfo";
import VoteLanding from "@/components/VoteLanding";

export const dynamic = "force-dynamic";

// Публичная страница для ссылки «Проголосуй за меня»: красивый предпросмотр в Telegram/Instagram.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const info = await getCardInfo(params.id);
  const title = info ? `${info.name} — VETOKS` : "VETOKS";
  const description = info?.rank
    ? `№${info.rank} в регионе ${info.region ?? ""}. Проголосуй за меня!`
    : "Проголосуй за меня!";
  const img = `/api/og/vote/${params.id}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: img, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default async function VotePage({ params }: { params: { id: string } }) {
  const info = await getCardInfo(params.id);
  return <VoteLanding id={params.id} info={info} />;
}
