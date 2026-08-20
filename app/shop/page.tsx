"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Gift = {
  id: string;
  name: string;
  price: number;
  category: string;
  participant_share_percent: number;
};

type Participant = { id: string; display_name: string; user_id: string };

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
  const [walletId, setWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

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
          .select("id, display_name, user_id")
          .eq("is_eliminated", false);
        setParticipants((participantsData as Participant[]) ?? []);
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
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

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
          <p className="text-gold text-xl font-semibold">{balance} ₽</p>
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
          <select
            value={selectedParticipant}
            onChange={(e) => setSelectedParticipant(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
          >
            <option value="">— выберите участницу —</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
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

      <BottomNav />
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}
