"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PageHeader from "@/components/PageHeader";

type Gift = {
  id: string;
  name: string;
  price: number;
  category: string;
  participant_share_percent: number;
};

type Participant = { id: string; display_name: string; user_id: string; photo_url?: string | null };

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(str: string): string {
  return str
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("");
}

function matchesSearch(name: string, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  return translit(n).includes(translit(q));
}

const GIFT_EMOJI: Record<string, string> = {
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

const CATEGORIES = [
  { key: "light", label: "Лёгкие" },
  { key: "premium", label: "Премиум" },
  { key: "vip", label: "VIP" },
];

function ShopContent() {
  const searchParams = useSearchParams();
  const participantId = searchParams.get("participant");
  const participantName = searchParams.get("name");

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [category, setCategory] = useState("light");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedParticipant, setSelectedParticipant] = useState(
    participantId ?? ""
  );
  const [participantSearch, setParticipantSearch] = useState("");
  const [followedParticipants, setFollowedParticipants] = useState<
    (Participant & { photo_url: string | null })[]
  >([]);
  const [recentParticipants, setRecentParticipants] = useState<
    (Participant & { photo_url: string | null })[]
  >([]);
  const [participantRegions, setParticipantRegions] = useState<Record<string, string>>({});
  const [walletId, setWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<"gifts" | "cards">("gifts");

  useEffect(() => {
    (async () => {
      const { data: giftsData } = await supabase
        .from("gift_catalog")
        .select("id, name, price, category, participant_share_percent")
        .eq("is_active", true)
        .order("price");
      setGifts((giftsData as Gift[]) ?? []);

      if (!participantId) {
        const { data: participantsData } = await supabase
          .from("participants")
          .select("id, display_name, user_id, photo_url, season_id")
          .eq("is_eliminated", false);
        setParticipants((participantsData as Participant[]) ?? []);

        const { data: seasonsData } = await supabase
          .from("seasons")
          .select("id, region_id, regions(name)");
        const seasonToRegionName: Record<string, string> = {};
        (seasonsData ?? []).forEach(
          (s: { id: string; regions: { name: string } | null }) => {
            if (s.regions) seasonToRegionName[s.id] = s.regions.name;
          }
        );
        const regionMap: Record<string, string> = {};
        (participantsData ?? []).forEach(
          (p: { id: string; season_id: string }) => {
            regionMap[p.id] = seasonToRegionName[p.season_id] ?? "";
          }
        );
        setParticipantRegions(regionMap);
      }

      const u = await getCurrentUser();
      if (!u) return;
      setUserId(u.id);

      let { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet } = await supabase
          .from("wallets")
          .insert({ user_id: u.id })
          .select("id, balance")
          .single();
        wallet = newWallet;
      }

      if (wallet) {
        setWalletId(wallet.id);
        setBalance(Number(wallet.balance));
      }

      // Подписки пользователя — для блока «Ваши подписки».
      const { data: followsData } = await supabase
        .from("participant_follows")
        .select("participant_id, participants(id, display_name, user_id, photo_url)")
        .eq("user_id", u.id);
      setFollowedParticipants(
        (followsData ?? [])
          .map((f: { participants: any }) => f.participants)
          .filter(Boolean)
      );

      // Недавние получатели подарков от этого пользователя.
      const { data: recentGifts } = await supabase
        .from("gifts")
        .select("participant_id, created_at, participants(id, display_name, user_id, photo_url)")
        .eq("sender_id", u.id)
        .order("created_at", { ascending: false })
        .limit(20);
      const seen = new Set<string>();
      const recents: (Participant & { photo_url: string | null })[] = [];
      (recentGifts ?? []).forEach((g: { participant_id: string; participants: any }) => {
        if (g.participants && !seen.has(g.participant_id)) {
          seen.add(g.participant_id);
          recents.push(g.participants);
        }
      });
      setRecentParticipants(recents.slice(0, 10));
    })();
  }, [participantId]);

  async function testTopUp() {
    if (!walletId) return;
    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "topup",
      amount: 1000,
      metadata: { test: true },
    });
    await supabase
      .from("wallets")
      .update({ balance: balance + 1000 })
      .eq("id", walletId);
    setBalance((b) => b + 1000);
  }

  async function sendGift(gift: Gift) {
    if (!walletId || !userId || !selectedParticipant) return;
    const qty = quantities[gift.id] ?? 1;
    const totalPrice = gift.price * qty;
    if (balance < totalPrice) {
      setErrorMessage("Недостаточно средств. Пополните тестовый баланс.");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    const participantEarning =
      (totalPrice * gift.participant_share_percent) / 100;

    // Списываем у отправителя.
    const { data: senderTx } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        type: "gift_sent",
        amount: -totalPrice,
        related_participant_id: selectedParticipant,
      })
      .select("id")
      .single();

    await supabase
      .from("wallets")
      .update({ balance: balance - totalPrice })
      .eq("id", walletId);

    // Находим/создаём кошелёк участницы и начисляем её долю.
    const { data: participant } = await supabase
      .from("participants")
      .select("user_id")
      .eq("id", selectedParticipant)
      .single();

    if (participant) {
      let { data: pWallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", participant.user_id)
        .maybeSingle();

      if (!pWallet) {
        const { data: newWallet } = await supabase
          .from("wallets")
          .insert({ user_id: participant.user_id })
          .select("id, balance")
          .single();
        pWallet = newWallet;
      }

      if (pWallet) {
        await supabase.from("wallet_transactions").insert({
          wallet_id: pWallet.id,
          type: "gift_received",
          amount: participantEarning,
          related_participant_id: selectedParticipant,
        });
        await supabase
          .from("wallets")
          .update({ balance: Number(pWallet.balance) + participantEarning })
          .eq("id", pWallet.id);
      }
    }

    // Запись самого подарка.
    await supabase.from("gifts").insert({
      sender_id: userId,
      participant_id: selectedParticipant,
      gift_catalog_id: gift.id,
      quantity: qty,
      total_price: totalPrice,
      participant_earning: participantEarning,
      wallet_transaction_id: senderTx?.id ?? null,
    });

    if (participant) {
      await supabase.from("notifications").insert({
        user_id: participant.user_id,
        message: `🎁 Вам подарили ${gift.name}${qty > 1 ? ` ×${qty}` : ""}`,
        link: `/participant/${selectedParticipant}/gifts`,
      });
    }

    setBalance((b) => b - totalPrice);
    setQuantities((q) => ({ ...q, [gift.id]: 1 }));
    setStatus("sent");
    setTimeout(() => setStatus("idle"), 2000);
  }

  function changeQty(giftId: string, delta: number) {
    setQuantities((q) => {
      const current = q[giftId] ?? 1;
      const next = Math.min(99, Math.max(1, current + delta));
      return { ...q, [giftId]: next };
    });
  }

  const filteredGifts = gifts.filter((g) => g.category === category);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />

      <div className="px-6 mb-4 flex gap-2">
        <button
          onClick={() => setSection("gifts")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            section === "gifts"
              ? "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
              : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          Подарки
        </button>
        <button
          onClick={() => setSection("cards")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            section === "cards"
              ? "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
              : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          🃏 Карточки
        </button>
      </div>

      {section === "cards" ? (
        <CardsSection />
      ) : (
        <>
      <div className="px-6 mb-4">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          Подарки{participantName ? ` — ${participantName}` : ""}
        </h1>
        <p className="text-muted text-xs">
          Тестовый режим — реальные деньги пока не подключены
        </p>
      </div>

      <div className="px-6 mb-4 bg-bgSurface border border-gold/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-muted text-xs">Ваш баланс</p>
          <p className="text-gold text-xl font-semibold">{Math.round(balance)} ₽</p>
        </div>
        <button
          onClick={testTopUp}
          className="bg-bgPrimary border border-muted text-offwhite text-xs px-3 py-2 rounded-full"
        >
          Пополнить (тест +1000₽)
        </button>
      </div>

      {!participantId && (
        <div className="px-6 mb-4">
          <label className="text-offwhite text-sm">Кому дарим</label>
          {selectedParticipant ? (
            <div className="flex items-center justify-between bg-bgSurface border border-gold rounded-lg px-4 py-3 mt-1">
              <span className="text-offwhite text-sm">
                {participants.find((p) => p.id === selectedParticipant)
                  ?.display_name ?? ""}
              </span>
              <button
                onClick={() => {
                  setSelectedParticipant("");
                  setParticipantSearch("");
                }}
                className="text-muted text-xs"
              >
                Изменить
              </button>
            </div>
          ) : (
            <>
              {followedParticipants.length > 0 && (
                <div className="mt-2">
                  <p className="text-muted text-xs mb-2">Ваши подписки</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {followedParticipants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedParticipant(p.id)}
                        className="flex flex-col items-center gap-1 flex-shrink-0"
                      >
                        <div className="w-14 h-14 rounded-full bg-black/40 overflow-hidden border-2 border-gold">
                          {p.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photo_url}
                              alt={p.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="text-offwhite text-[10px] max-w-[60px] truncate">
                          {p.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recentParticipants.length > 0 && (
                <div className="mt-4">
                  <p className="text-muted text-xs mb-2">Вы недавно дарили</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {recentParticipants.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedParticipant(p.id)}
                        className="flex flex-col items-center gap-1 flex-shrink-0"
                      >
                        <div className="w-14 h-14 rounded-full bg-black/40 overflow-hidden border border-muted">
                          {p.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photo_url}
                              alt={p.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="text-offwhite text-[10px] max-w-[60px] truncate">
                          {p.display_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <input
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                placeholder="Введите имя или ник — рус. или англ."
                className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-4"
              />
              {participantSearch && (
                <div className="max-h-56 overflow-y-auto mt-2 flex flex-col gap-1">
                  {participants
                    .filter((p) => matchesSearch(p.display_name, participantSearch))
                    .slice(0, 20)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedParticipant(p.id);
                          setParticipantSearch("");
                        }}
                        className="flex items-center gap-3 text-left bg-bgSurface border border-muted rounded-lg px-3 py-2"
                      >
                        <div className="w-9 h-9 rounded-full bg-black/40 overflow-hidden flex-shrink-0">
                          {p.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photo_url}
                              alt={p.display_name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className="text-offwhite text-sm">{p.display_name}</p>
                          {participantRegions[p.id] && (
                            <p className="text-muted text-xs">
                              Регион: {participantRegions[p.id]}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  {participants.filter((p) =>
                    matchesSearch(p.display_name, participantSearch)
                  ).length === 0 && (
                    <p className="text-muted text-xs px-2">Никого не найдено.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="px-6 mb-4 flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              category === c.key
                ? "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
                : "bg-bgSurface text-muted border border-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="px-6 grid grid-cols-3 gap-3">
        {filteredGifts.map((g) => {
          const qty = quantities[g.id] ?? 1;
          return (
            <div
              key={g.id}
              className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col items-center gap-1"
            >
              <span className="text-3xl">{GIFT_EMOJI[g.name] ?? "🎁"}</span>
              <span className="text-offwhite text-xs text-center">
                {g.name}
              </span>
              <span className="text-gold text-xs font-semibold">
                {g.price * qty} ₽
              </span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => changeQty(g.id, -1)}
                  className="w-6 h-6 rounded-full bg-bgPrimary border border-muted text-offwhite text-xs"
                >
                  −
                </button>
                <span className="text-offwhite text-xs w-4 text-center">
                  {qty}
                </span>
                <button
                  onClick={() => changeQty(g.id, 1)}
                  className="w-6 h-6 rounded-full bg-bgPrimary border border-muted text-offwhite text-xs"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => sendGift(g)}
                disabled={!selectedParticipant || status === "sending"}
                className="mt-1 w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-1.5 rounded-full text-xs disabled:opacity-40"
              >
                Подарить
              </button>
            </div>
          );
        })}
      </div>

      {errorMessage && (
        <p className="text-danger text-sm text-center mt-4">
          {errorMessage}
        </p>
      )}
      {status === "sent" && (
        <p className="text-success text-sm text-center mt-4">
          Подарок отправлен! 🎉
        </p>
      )}
        </>
      )}

      <BottomNav />
    </main>
  );
}

function CardsSection() {
  const [cards, setCards] = useState<
    {
      id: string;
      stage: string;
      final_image_url: string | null;
      status: string;
      participant_id: string;
      participants: { display_name: string } | null;
    }[]
  >([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("collectible_cards")
        .select(
          "id, stage, final_image_url, status, participant_id, participants(display_name)"
        )
        .in("status", ["ready", "sold"]);
      setCards((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = cards.filter((c) =>
    matchesSearch(c.participants?.display_name ?? "", search)
  );

  return (
    <div className="px-6">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск участницы — рус. или англ."
        className="w-full bg-bgSurface text-offwhite border border-muted rounded-full px-5 py-3 text-sm mb-4"
      />

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-muted text-center">
          Пока нет опубликованных карточек — они появятся, когда участницы
          загрузят фото и мы их обработаем.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((c) => (
          <a
            key={c.id}
            href={`/participant/${c.participant_id}`}
            className="bg-bgSurface border border-muted rounded-xl overflow-hidden"
          >
            <div className="aspect-[3/4] bg-black/40">
              {c.final_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.final_image_url}
                  alt={STAGE_LABELS[c.stage] ?? c.stage}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-2">
              <p className="text-offwhite text-xs font-semibold truncate">
                {c.participants?.display_name ?? "—"}
              </p>
              <p className="text-muted text-[10px]">
                {STAGE_LABELS[c.stage] ?? c.stage}
              </p>
              <p
                className={`text-xs font-semibold mt-1 ${
                  c.status === "sold" ? "text-success" : "text-gold"
                }`}
              >
                {c.status === "sold" ? "Продана" : "25 000 ₽"}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

const STAGE_LABELS: Record<string, string> = {
  casting: "Кастинг",
  week2: "Неделя 2",
  week3: "Неделя 3",
  grand_final: "Гранд-финал",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}
