"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import FanZoneStrip from "@/components/FanZoneStrip";
import { applyGiftOverrides, getAppPrices, getCurrencySymbol, getUsdRate } from "@/lib/currency";
import { apiPost } from "@/lib/authClient";
import { getMyCountry } from "@/lib/myCountry";

type Gift = {
  id: string;
  name: string;
  price: number;
  usd_price?: number | null;
  category: string;
  participant_share_percent: number;
  chat_only?: boolean;
};

function useTopupEnabled() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    apiPost("/api/shop/test-topup", { check: true }).then((r) => setOn(!!(r?.ok && r.enabled)));
  }, []);
  return on;
}

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
  const [showFollowed, setShowFollowed] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [followedParticipants, setFollowedParticipants] = useState<
    (Participant & { photo_url: string | null })[]
  >([]);
  const [recentParticipants, setRecentParticipants] = useState<
    (Participant & { photo_url: string | null })[]
  >([]);
  const [participantRegions, setParticipantRegions] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [section, setSection] = useState<"gifts" | "votes" | "cards">(
    (searchParams.get("section") as "gifts" | "votes" | "cards") ?? "gifts"
  );
  const [currencySymbol, setCurrencySymbol] = useState("₴");

  useEffect(() => {
    (async () => {
      setCurrencySymbol(await getCurrencySymbol());

      const { data: giftsData } = await supabase
        .from("gift_catalog")
        .select("id, name, price, usd_price, category, participant_share_percent, chat_only, is_active");
      // Цена подарка задаётся в CRM в долларах; пересчитываем по курсу.
      const rate = await getUsdRate();
      const withCountry = (await applyGiftOverrides((giftsData as any[]) ?? [])).filter((g: any) => g.is_active);
      const priced = (withCountry as Gift[]).filter((g) => !g.chat_only).map((g) => ({
        ...g,
        price:
          Number(g.usd_price) > 0
            ? Math.round(Number(g.usd_price) * rate)
            : Number(g.price),
      }));
      priced.sort((a, b) => a.price - b.price);
      setGifts(priced);

      if (!participantId) {
        const mcs = await getMyCountry();
        let sq = supabase
          .from("participants")
          .select("id, display_name, user_id, photo_url, season_id, region_id, regions(name)")
          .eq("is_eliminated", false);
        if (mcs.countryId) sq = sq.in("region_id", mcs.regionIds);
        const { data: participantsData } = await sq;
        setParticipants((participantsData as unknown as Participant[]) ?? []);

        const regionMap: Record<string, string> = {};
        (participantsData as any[] ?? []).forEach((p) => {
          const regionName = Array.isArray(p.regions) ? p.regions[0]?.name : p.regions?.name;
          regionMap[p.id] = regionName ?? "";
        });
        setParticipantRegions(regionMap);
      }

      const u = await getCurrentUser();
      if (!u) return;
      setUserId(u.id);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", u.id)
        .maybeSingle();

      // Кошелёк создаёт сервер при первой покупке или пополнении.
      setBalance(wallet ? Number(wallet.balance) : 0);

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

  const topupOn = useTopupEnabled();

  async function testTopUp() {
    const r = await apiPost("/api/shop/test-topup");
    if (r.ok) setBalance(Number(r.balance));
    else setErrorMessage("Пополнение сейчас недоступно.");
  }

  async function sendGift(gift: Gift) {
    if (!userId || !selectedParticipant) return;
    const qty = quantities[gift.id] ?? 1;
    const totalPrice = gift.price * qty;
    if (balance < totalPrice) {
      setErrorMessage("Недостаточно средств. Пополните баланс.");
      return;
    }

    setStatus("sending");
    setErrorMessage("");

    const r = await apiPost("/api/shop/gift", {
      giftId: gift.id,
      participantId: selectedParticipant,
      qty,
    });

    if (!r.ok) {
      setStatus("error");
      setErrorMessage(
        r.error === "not_enough"
          ? "Недостаточно средств. Пополните баланс."
          : `Не удалось отправить подарок. Попробуйте ещё раз. (${r.error ?? "?"}${r.detail ? ": " + r.detail : ""})`
      );
      if (typeof r.balance === "number") setBalance(r.balance);
      return;
    }

    setBalance(Number(r.balance));
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

      <FanZoneStrip />

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
          onClick={() => setSection("votes")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            section === "votes"
              ? "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
              : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          🗳️ Голоса
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
      ) : section === "votes" ? (
        <VotesSection />
      ) : (
        <>
      <div className="px-6 mb-4">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          Подарки{participantName ? ` — ${participantName}` : ""}
        </h1>
        {topupOn && (
          <p className="text-muted text-xs">
            Тестовый режим — реальные деньги пока не подключены
          </p>
        )}
      </div>

      <div className="px-6 mb-4 bg-bgSurface border border-gold/40 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-muted text-xs">Ваш баланс</p>
          <p className="text-gold text-xl font-semibold">{Math.round(balance)} {currencySymbol}</p>
        </div>
        {topupOn && (
          <button
            onClick={testTopUp}
            className="bg-bgPrimary border border-muted text-offwhite text-xs px-3 py-2 rounded-full"
          >
            Пополнить (тест +1000{currencySymbol})
          </button>
        )}
      </div>

      {!participantId && (
        <div className="px-6 mb-4">
          {selectedParticipant ? (
            <div className="flex items-center justify-between bg-bgSurface border border-gold rounded-lg px-4 py-3">
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
              <div className="flex gap-3 mb-3">
                {followedParticipants.length > 0 && (
                  <button
                    onClick={() => {
                      setShowFollowed((v) => !v);
                      setShowRecent(false);
                    }}
                    className="flex items-center gap-1 text-muted text-xs"
                  >
                    Ваши подписки
                    <span
                      className={`transition-transform ${showFollowed ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>
                )}
                {recentParticipants.length > 0 && (
                  <button
                    onClick={() => {
                      setShowRecent((v) => !v);
                      setShowFollowed(false);
                    }}
                    className="flex items-center gap-1 text-muted text-xs"
                  >
                    Кому недавно дарили
                    <span
                      className={`transition-transform ${showRecent ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>
                )}
              </div>

              {showFollowed && followedParticipants.length > 0 && (
                <div className="mb-4">
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

              {showRecent && recentParticipants.length > 0 && (
                <div className="mb-4">
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
              <span data-tr className="text-offwhite text-xs text-center">
                {g.name}
              </span>
              <span className="text-gold text-xs font-semibold">
                {g.price * qty} {currencySymbol}
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

const STAGE_ORDER = ["casting", "week2", "week3", "week4", "week5", "grand_final"];
const STAGE_LABELS: Record<string, string> = {
  casting: "Отбор",
  week2: "Неделя 2",
  week3: "Неделя 3",
  week4: "Неделя 4",
  week5: "Неделя 5",
  grand_final: "Гранд-финал",
};

function CardsSection() {
  const [cards, setCards] = useState<
    {
      id: string;
      stage: string;
      final_image_url: string | null;
      status: string;
      sold_at: string | null;
      participant_id: string;
      participants: { display_name: string } | null;
    }[]
  >([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState("₴");
  const [cardPrice, setCardPrice] = useState(120);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyMsg, setBuyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function buyCard(id: string) {
    setBuying(true);
    setBuyMsg(null);
    const r = await apiPost("/api/shop/buy-card", { cardId: id });
    setBuying(false);
    if (r?.ok) {
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "sold", sold_at: new Date().toISOString() } : c))
      );
      setBuyMsg({ ok: true, text: "Карточка куплена! Спасибо за поддержку участницы." });
      setConfirmId(null);
    } else if (r?.error === "not_enough") {
      setBuyMsg({ ok: false, text: "Недостаточно средств. Пополните баланс в разделе «Подарки»." });
    } else if (r?.error === "sold") {
      setBuyMsg({ ok: false, text: "Эту карточку уже купили." });
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status: "sold", sold_at: new Date().toISOString() } : c)));
      setConfirmId(null);
    } else {
      setBuyMsg({ ok: false, text: "Не удалось купить карточку. Попробуйте ещё раз." });
    }
  }

  useEffect(() => {
    (async () => {
      const [symbol, prices] = await Promise.all([
        getCurrencySymbol(),
        getAppPrices(),
      ]);
      setCurrencySymbol(symbol);
      if (prices.collectible_card) setCardPrice(prices.collectible_card);

      const { data } = await supabase
        .from("collectible_cards")
        .select(
          "id, stage, final_image_url, status, sold_at, participant_id, participants(display_name)"
        )
        .in("status", ["ready", "sold"]);
      setCards((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  // Проданные карточки видны ещё 12 часов после продажи, потом пропадают
  // из общего показа целиком.
  const visible = cards.filter((c) => {
    if (c.status !== "sold") return true;
    if (!c.sold_at) return true;
    const hoursSinceSold = (Date.now() - new Date(c.sold_at).getTime()) / 3600000;
    return hoursSinceSold < 12;
  });

  const searched = visible.filter((c) =>
    matchesSearch(c.participants?.display_name ?? "", search)
  );

  const byStage: Record<string, typeof searched> = {};
  searched.forEach((c) => {
    (byStage[c.stage] ??= []).push(c);
  });
  const presentStages = STAGE_ORDER.filter((s) => byStage[s]?.length > 0);
  const currentStage = presentStages[presentStages.length - 1];
  const currentCards = currentStage ? byStage[currentStage] : [];
  const previousStages = presentStages.slice(0, -1);

  function CardTile({ c }: { c: (typeof searched)[number] }) {
    return (
      <div
        onClick={() => {
          if (c.status === "ready") {
            setBuyMsg(null);
            setConfirmId(c.id);
          }
        }}
        className={`bg-bgSurface border border-muted rounded-xl overflow-hidden ${
          c.status === "ready" ? "cursor-pointer active:scale-[0.98] transition-transform" : "opacity-80"
        }`}
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
          <p className="text-muted text-[10px]">{STAGE_LABELS[c.stage] ?? c.stage}</p>
          <p
            className={`text-xs font-semibold mt-1 ${
              c.status === "sold" ? "text-success" : "text-gold"
            }`}
          >
            {c.status === "sold"
              ? "Продана"
              : `${cardPrice.toLocaleString("ru-RU")} ${currencySymbol}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск участницы — рус. или англ."
        className="w-full bg-bgSurface text-offwhite border border-muted rounded-full px-5 py-3 text-sm mb-4"
      />

      {loading && <LoadingScreen inline />}
      {!loading && searched.length === 0 && (
        <p className="text-muted text-center">
          Пока нет опубликованных карточек — они появятся, когда участницы
          загрузят фото и мы их обработаем.
        </p>
      )}

      {currentStage && (
        <>
          <p className="text-gold text-sm font-semibold mb-2">
            {STAGE_LABELS[currentStage] ?? currentStage}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {currentCards.map((c) => (
              <CardTile key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      {previousStages.length > 0 && (
        <div className="mt-8">
          <p className="text-muted text-sm font-semibold mb-2">
            Карточки предыдущих этапов
          </p>
          {previousStages.map((stageKey) => (
            <div key={stageKey} className="mb-6">
              <p className="text-muted text-xs mb-2">
                {STAGE_LABELS[stageKey] ?? stageKey}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {byStage[stageKey].map((c) => (
                  <CardTile key={c.id} c={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {buyMsg && !confirmId && (
        <p className={`text-center text-sm mt-4 ${buyMsg.ok ? "text-success" : "text-danger"}`}>{buyMsg.text}</p>
      )}

      {confirmId && (() => {
        const c = cards.find((x) => x.id === confirmId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => !buying && setConfirmId(null)}>
            <div className="bg-bgSurface border border-gold/40 rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-3 mb-4">
                <div className="w-20 aspect-[3/4] bg-black/40 rounded-lg overflow-hidden flex-shrink-0">
                  {c.final_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.final_image_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div>
                  <p className="text-offwhite font-semibold">{c.participants?.display_name ?? "—"}</p>
                  <p className="text-muted text-xs mb-2">{STAGE_LABELS[c.stage] ?? c.stage}</p>
                  <p className="text-gold font-semibold">
                    {cardPrice.toLocaleString("ru-RU")} {currencySymbol}
                  </p>
                  <a href={`/participant/${c.participant_id}`} className="text-muted text-xs underline">
                    Профиль участницы
                  </a>
                </div>
              </div>
              {buyMsg && !buyMsg.ok && <p className="text-danger text-sm mb-3">{buyMsg.text}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmId(null)}
                  disabled={buying}
                  className="flex-1 border border-muted text-offwhite rounded-full py-3 text-sm font-semibold disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={() => buyCard(c.id)}
                  disabled={buying}
                  className="flex-1 bg-gold text-bgPrimary rounded-full py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {buying ? "Покупаем..." : "Купить"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------
// ГОЛОСА
// ---------------------------------------------------------------------

const VOTE_PACKAGES = [25, 50, 100, 200, 500, 1000];
const DEFAULT_PRICE_PER_VOTE = 4;

function VotesSection() {
  const [balance, setBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buyingAmount, setBuyingAmount] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("₴");
  const [pricePerVote, setPricePerVote] = useState(DEFAULT_PRICE_PER_VOTE);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);

    const [symbol, prices] = await Promise.all([
      getCurrencySymbol(),
      getAppPrices(),
    ]);
    setCurrencySymbol(symbol);
    if (prices.vote) setPricePerVote(prices.vote);

    const u = await getCurrentUser();
    if (!u) {
      setLoading(false);
      return;
    }
    setUserId(u.id);
    const { data } = await supabase
      .from("vote_credits")
      .select("balance")
      .eq("user_id", u.id)
      .maybeSingle();
    setBalance(data?.balance ?? 0);

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", u.id)
      .maybeSingle();
    setWalletBalance(wallet ? Number(wallet.balance) : 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const topupOn = useTopupEnabled();

  async function testTopUp() {
    const r = await apiPost("/api/shop/test-topup");
    if (r.ok) setWalletBalance(Number(r.balance));
  }

  async function buy(amount: number) {
    if (!userId) return;
    setMessage("");
    if (walletBalance < amount * pricePerVote) {
      setMessage("Недостаточно средств на балансе. Пополните баланс.");
      return;
    }
    setBuyingAmount(amount);
    const r = await apiPost("/api/shop/buy-votes", { amount });
    if (r.ok) {
      setBalance(Number(r.votes));
      setWalletBalance(Number(r.balance));
      setMessage(`Куплено голосов: ${amount}`);
    } else if (r.error === "not_enough") {
      setMessage("Недостаточно средств на балансе. Пополните баланс.");
      if (typeof r.balance === "number") setWalletBalance(r.balance);
    } else {
      setMessage("Не удалось купить голоса. Попробуйте ещё раз.");
    }
    setBuyingAmount(null);
  }

  return (
    <div>
      <div className="px-6 mb-4">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">Голоса</h1>
        <p className="text-muted text-xs mb-3">
          {topupOn ? "Тестовый режим — реальные деньги пока не подключены. " : ""}1 голос = {pricePerVote} {currencySymbol}.
        </p>
        <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-3 flex items-center justify-between">
          <div>
            <p className="text-muted text-xs">Ваш баланс</p>
            <p className="text-gold text-xl font-semibold">
              {loading ? "..." : `${Math.round(walletBalance)} ${currencySymbol}`}
            </p>
          </div>
          {topupOn && (
            <button
              onClick={testTopUp}
              className="bg-bgPrimary border border-muted text-offwhite text-xs px-3 py-2 rounded-full"
            >
              Пополнить (тест +1000{currencySymbol})
            </button>
          )}
        </div>
        <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
          <p className="text-muted text-xs">Ваши купленные голоса</p>
          <p className="text-gold text-xl font-semibold">{loading ? "..." : balance}</p>
        </div>
        {message && <p className="text-gold text-sm text-center mt-3">{message}</p>}
      </div>

      <div className="px-6 grid grid-cols-2 gap-3">
        {VOTE_PACKAGES.map((amount) => (
          <button
            key={amount}
            onClick={() => buy(amount)}
            disabled={buyingAmount === amount}
            className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col items-center gap-1 disabled:opacity-50"
          >
            <span className="text-3xl">🗳️</span>
            <span className="text-offwhite font-semibold">{amount} голосов</span>
            <span className="text-gold text-sm">{amount * pricePerVote} {currencySymbol}</span>
            {buyingAmount === amount && (
              <span className="text-muted text-xs">Покупаем...</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
