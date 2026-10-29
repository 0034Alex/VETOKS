"use client";

import GiftArt from "@/components/GiftArt";
import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/authClient";
import { fireGiftFx } from "@/lib/giftFx";

type GiftRow = {
  id: string;
  quantity: number;
  created_at: string;
  gift_catalog: { name: string; art?: string | null } | null;
};

const GIFT_EMOJI: Record<string, string> = {
  Овации: "👏",
  Микрофон: "🎤",
  Ноты: "🎵",
  Гитара: "🎸",
  Прожектор: "🔦",
  Занавес: "🎭",
  Рояль: "🎹",
  "Звезда сцены": "🌟",
  "Гран-при": "🏆",
  Роза: "🌹",
  Сердце: "💗",
  Искра: "✨",
  Бабочка: "🦋",
  Цветок: "🌸",
  Лента: "🎀",
  Кристалл: "💎",
  Бриллиант: "💍",
  Туфелька: "👠",
  Звезда: "🌟",
  Кубок: "🏆",
  "Золотая корона": "👑",
  Созвездие: "💫",
  Алмаз: "💎",
  "Императорская корона": "👑",
  Лебедь: "🦢",
  Дворец: "🏰",
  Вселенная: "🌌",
};

export default function ParticipantGiftsPage() {
  const params = useParams();
  const id = params.id as string;

  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [artOf, setArtOf] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [participantName, setParticipantName] = useState("");
  const [fresh, setFresh] = useState<any[]>([]);
  const [playing, setPlaying] = useState(false);

  // Только владелица видит «новые подарки» — сервер отдаёт список лишь ей.
  useEffect(() => {
    apiPost("/api/gifts/fx", { action: "replay" })
      .then((r: any) => setFresh((r?.items ?? []).filter((i: any) => true)))
      .catch(() => {});
  }, [id]);

  async function playFresh() {
    if (playing) return;
    setPlaying(true);
    const list = [...fresh];
    for (const g of list) {
      fireGiftFx({ name: g.name, art: g.art, category: g.category, usd: g.usd, fx: g.fx === "off" ? "off" : "full", qty: g.qty, from: g.from, avatar: g.avatar });
      await apiPost("/api/gifts/fx", { action: "ack", played: [g.id] }).catch(() => {});
      await new Promise((r) => setTimeout(r, 4600));
    }
    setFresh([]);
    setPlaying(false);
  }

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("participants")
        .select("display_name")
        .eq("id", id)
        .maybeSingle();
      setParticipantName(p?.display_name ?? "");

      const { data } = await supabase
        .from("gifts")
        .select("id, quantity, created_at, gift_catalog(*)")
        .eq("participant_id", id)
        .order("created_at", { ascending: false });

      const list = (data as unknown as GiftRow[]) ?? [];
      setGifts(list);

      const sums: Record<string, number> = {};
      const arts: Record<string, string> = {};
      list.forEach((g) => {
        const name = g.gift_catalog?.name ?? "Подарок";
        sums[name] = (sums[name] ?? 0) + (g.quantity ?? 1);
        if (g.gift_catalog?.art) arts[name] = g.gift_catalog.art;
      });
      setTotals(sums);
      setArtOf(arts);

      setLoading(false);
    })();
  }, [id]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 mb-6">
        <h1 className="text-2xl font-semibold text-offwhite">
          Подарки {participantName && `— ${participantName}`}
        </h1>
      </div>

      {fresh.length > 0 && (
        <div className="px-6 mb-4">
          <button
            onClick={playFresh}
            disabled={playing}
            className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm"
          >
            {playing ? "Показываю…" : `▶ Посмотреть новые подарки (${fresh.length})`}
          </button>
        </div>
      )}

      {loading && <LoadingScreen inline />}
      {!loading && gifts.length === 0 && (
        <p className="text-muted text-center px-6">Подарков пока нет.</p>
      )}

      {Object.keys(totals).length > 0 && (
        <div className="px-6 mb-6 grid grid-cols-3 gap-2">
          {Object.entries(totals).map(([name, count]) => (
            <div
              key={name}
              className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col items-center"
            >
              <GiftArt name={artOf[name] ?? name} size={44} fallback={GIFT_EMOJI[name] ?? "🎁"} />
              <span className="text-offwhite text-xs mt-1">{name}</span>
              <span className="text-gold text-sm font-semibold">
                × {count}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-6 max-w-3xl mx-auto">
        <h2 className="text-muted text-sm mb-3">Последние подарки</h2>
        <div className="flex flex-col gap-2">
          {gifts.slice(0, 30).map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between bg-bgSurface border border-muted rounded-lg px-4 py-2"
            >
              <span className="text-offwhite text-sm">
                <GiftArt name={g.gift_catalog?.art || g.gift_catalog?.name || ""} size={24} fallback={GIFT_EMOJI[g.gift_catalog?.name ?? ""] ?? "🎁"} />{" "}
                {g.gift_catalog?.name ?? "Подарок"} × {g.quantity}
              </span>
              <span className="text-muted text-xs">
                {new Date(g.created_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
