"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Card = {
  id: string;
  stage: string;
  raw_photo_url: string | null;
  final_image_url: string | null;
  status: string;
  buyer_id: string | null;
};

const STAGES = [
  { key: "casting", label: "Кастинг" },
  { key: "week2", label: "Неделя 2" },
  { key: "week3", label: "Неделя 3" },
  { key: "grand_final", label: "Гранд-финал" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "На обработке",
  ready: "Доступна для покупки",
  sold: "Продана",
};

export default function MyCardsPage() {
  const router = useRouter();
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingStage, setUploadingStage] = useState<string | null>(null);

  async function load() {
    const u = await getCurrentUser();
    if (!u) {
      router.push("/login?redirect=/my-cards");
      return;
    }
    setUserId(u.id);

    const { data: p } = await supabase
      .from("participants")
      .select("id")
      .eq("user_id", u.id)
      .maybeSingle();

    if (!p) {
      setLoading(false);
      return;
    }
    setParticipantId(p.id);

    const { data: cardsData } = await supabase
      .from("collectible_cards")
      .select("id, stage, raw_photo_url, final_image_url, status, buyer_id")
      .eq("participant_id", p.id);

    const map: Record<string, Card> = {};
    (cardsData as Card[] ?? []).forEach((c) => {
      map[c.stage] = c;
    });
    setCards(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(stage: string, file: File) {
    if (!participantId || !userId) return;
    setUploadingStage(stage);

    const fileExt = file.name.split(".").pop();
    const filePath = `raw-${userId}-${stage}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("card-images")
      .upload(filePath, file);

    if (uploadError) {
      setUploadingStage(null);
      alert(`Ошибка загрузки: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("card-images")
      .getPublicUrl(filePath);

    const existing = cards[stage];
    if (existing) {
      await supabase
        .from("collectible_cards")
        .update({ raw_photo_url: publicUrlData.publicUrl, status: "pending" })
        .eq("id", existing.id);
    } else {
      await supabase.from("collectible_cards").insert({
        participant_id: participantId,
        stage,
        raw_photo_url: publicUrlData.publicUrl,
        status: "pending",
      });
    }

    await load();
    setUploadingStage(null);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!participantId) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Мои карточки</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">
          Мои коллекционные карточки
        </h1>
        <p className="text-muted text-sm mb-6">
          Загрузите фото для каждого этапа — команда VETOKS обработает его в
          фирменном стиле и опубликует карточку для продажи. Вы получаете 50%
          с каждой продажи.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {STAGES.map((s) => {
            const card = cards[s.key];
            const displayImage = card?.final_image_url ?? card?.raw_photo_url;
            return (
              <div
                key={s.key}
                className="bg-bgSurface border border-muted rounded-xl overflow-hidden"
              >
                <div className="aspect-[3/4] bg-black/40 flex items-center justify-center relative">
                  {displayImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayImage}
                      alt={s.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-muted text-xs text-center px-2">
                      Нет фото
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-offwhite text-sm font-semibold mb-1">
                    {s.label}
                  </p>
                  <p
                    className={`text-xs mb-2 ${
                      card?.status === "sold"
                        ? "text-success"
                        : card?.status === "ready"
                        ? "text-gold"
                        : "text-muted"
                    }`}
                  >
                    {card ? STATUS_LABELS[card.status] : "Не загружено"}
                  </p>
                  {card?.status !== "sold" && (
                    <label className="block w-full text-center bg-bgPrimary border border-gold text-gold text-xs font-semibold py-2 rounded-full cursor-pointer">
                      {uploadingStage === s.key
                        ? "Загрузка..."
                        : card
                        ? "Заменить фото"
                        : "Загрузить фото"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingStage === s.key}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(s.key, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
