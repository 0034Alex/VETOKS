"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  user_id: string;
};

const MESSAGE_PRICE = 10000;
const BOOST_PRICE = 100000;
const BOOST_LIMIT = 3;

export default function ParticipantProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [giftTotal, setGiftTotal] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [boostCount, setBoostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");

  async function getOrCreateWallet(uid: string) {
    let { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", uid)
      .maybeSingle();
    if (!wallet) {
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: uid })
        .select("id, balance")
        .single();
      wallet = newWallet;
    }
    return wallet;
  }

  async function load() {
    setLoading(true);

    const { data: p } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url, user_id")
      .eq("id", id)
      .maybeSingle();
    setParticipant(p as Participant | null);

    const { count: votes } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id);
    setVoteCount(votes ?? 0);

    const { data: giftsData } = await supabase
      .from("gifts")
      .select("quantity, total_price")
      .eq("participant_id", id);
    setGiftCount(
      (giftsData ?? []).reduce(
        (sum: number, g: { quantity: number }) => sum + (g.quantity ?? 1),
        0
      )
    );
    setGiftTotal(
      (giftsData ?? []).reduce(
        (sum: number, g: { total_price: number }) => sum + Number(g.total_price),
        0
      )
    );

    const { count: followers } = await supabase
      .from("participant_follows")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id);
    setFollowerCount(followers ?? 0);

    const { count: boosts } = await supabase
      .from("boosts")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id)
      .eq("boost_type", "rating_bump");
    setBoostCount(boosts ?? 0);

    const u = await getCurrentUser();
    if (u) {
      setUserId(u.id);

      const votedIds = JSON.parse(
        localStorage.getItem("vetoks_voted_ids") ?? "[]"
      );
      setHasVoted(votedIds.includes(id));

      const { data: followRow } = await supabase
        .from("participant_follows")
        .select("id")
        .eq("participant_id", id)
        .eq("user_id", u.id)
        .maybeSingle();
      setIsFollowing(!!followRow);

      const wallet = await getOrCreateWallet(u.id);
      if (wallet) {
        setWalletId(wallet.id);
        setBalance(Number(wallet.balance));
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function handleVote() {
    if (!userId || hasVoted) return;
    setBusy(true);
    await supabase.from("votes").insert({
      voter_id: userId,
      participant_id: id,
      weight: 1,
      is_paid: false,
    });
    const votedIds = JSON.parse(
      localStorage.getItem("vetoks_voted_ids") ?? "[]"
    );
    localStorage.setItem(
      "vetoks_voted_ids",
      JSON.stringify([...votedIds, id])
    );
    await load();
    setBusy(false);
  }

  async function toggleFollow() {
    if (!userId) return;
    setBusy(true);
    if (isFollowing) {
      await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("participant_follows")
        .insert({ participant_id: id, user_id: userId });
    }
    await load();
    setBusy(false);
  }

  async function sendMessage() {
    if (!userId || !walletId || !messageText.trim()) return;
    if (balance < MESSAGE_PRICE) {
      setNotice("Недостаточно средств для платного сообщения.");
      return;
    }
    setBusy(true);

    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "vote_purchase",
      amount: -MESSAGE_PRICE,
      related_participant_id: id,
      metadata: { kind: "paid_message" },
    });
    await supabase
      .from("wallets")
      .update({ balance: balance - MESSAGE_PRICE })
      .eq("id", walletId);

    if (participant) {
      const pWallet = await getOrCreateWallet(participant.user_id);
      if (pWallet) {
        const earning = MESSAGE_PRICE * 0.5;
        await supabase.from("wallet_transactions").insert({
          wallet_id: pWallet.id,
          type: "gift_received",
          amount: earning,
          related_participant_id: id,
          metadata: { kind: "paid_message" },
        });
        await supabase
          .from("wallets")
          .update({ balance: Number(pWallet.balance) + earning })
          .eq("id", pWallet.id);
      }
    }

    await supabase.from("participant_messages").insert({
      sender_id: userId,
      participant_id: id,
      body: messageText,
      price: MESSAGE_PRICE,
    });

    setBalance((b) => b - MESSAGE_PRICE);
    setMessageText("");
    setMessageOpen(false);
    setNotice("Сообщение отправлено!");
    setBusy(false);
  }

  async function buyBoost() {
    if (!userId || !walletId) return;
    if (boostCount >= BOOST_LIMIT) return;
    if (balance < BOOST_PRICE) {
      setNotice("Недостаточно средств для буста.");
      return;
    }
    setBusy(true);

    const { data: tx } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        type: "boost_purchase",
        amount: -BOOST_PRICE,
        related_participant_id: id,
      })
      .select("id")
      .single();

    await supabase
      .from("wallets")
      .update({ balance: balance - BOOST_PRICE })
      .eq("id", walletId);

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 7);

    await supabase.from("boosts").insert({
      participant_id: id,
      boost_type: "rating_bump",
      price: BOOST_PRICE,
      ends_at: endsAt.toISOString(),
      wallet_transaction_id: tx?.id ?? null,
    });

    setBalance((b) => b - BOOST_PRICE);
    setNotice("Буст активирован на 7 дней!");
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!participant) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Участница не найдена.
      </main>
    );
  }

  const isOwner = userId === participant.user_id;
  const boostsLeft = BOOST_LIMIT - boostCount;

  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

      <div className="max-w-md mx-auto">
        <div className="aspect-[3/4] bg-black/40 rounded-2xl mx-6 overflow-hidden mb-4">
          {participant.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={participant.photo_url}
              alt={participant.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">
              Нет фото
            </div>
          )}
        </div>

        <div className="px-6">
          <h1 className="text-2xl text-offwhite font-semibold mb-2">
            {participant.display_name}
          </h1>

          <div className="flex gap-4 text-sm mb-4">
            <span className="text-rose">♥ {voteCount} голосов</span>
            <span className="text-gold">🎁 {giftCount} подарков</span>
            <span className="text-muted">👥 {followerCount} подписчиков</span>
          </div>

          {isOwner && giftTotal > 0 && (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-muted text-xs mb-1">
                Ваш заработок с подарков (видно только вам)
              </p>
              <p className="text-gold text-xl font-semibold">{giftTotal} ₽</p>
            </div>
          )}

          {participant.bio && (
            <p className="text-offwhite text-sm mb-6">{participant.bio}</p>
          )}

          <div className="flex gap-3 mb-3">
            <button
              onClick={handleVote}
              disabled={hasVoted || busy || !userId}
              className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-3 rounded-full text-sm disabled:opacity-40"
            >
              {hasVoted ? "Голос отдан" : "Поддержать"}
            </button>
            <Link
              href={`/shop?participant=${participant.id}&name=${encodeURIComponent(
                participant.display_name
              )}`}
              className="flex-1 bg-bgPrimary border border-gold text-gold font-semibold py-3 rounded-full text-sm text-center"
            >
              🎁 Подарить
            </Link>
          </div>

          <button
            onClick={toggleFollow}
            disabled={busy || !userId}
            className={`w-full border font-semibold py-3 rounded-full text-sm disabled:opacity-40 mb-3 ${
              isFollowing
                ? "border-muted text-muted"
                : "border-gold text-gold"
            }`}
          >
            {isFollowing ? "Вы подписаны" : "Подписаться"}
          </button>

          {!isOwner && (
            <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-3">
              {!messageOpen ? (
                <button
                  onClick={() => setMessageOpen(true)}
                  disabled={!userId}
                  className="w-full text-offwhite font-semibold text-sm disabled:opacity-40"
                >
                  ✉️ Написать участнице — от {MESSAGE_PRICE.toLocaleString(
                    "ru-RU"
                  )} ₽
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={3}
                    placeholder="Ваше сообщение..."
                    className="bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={busy || !messageText.trim()}
                    className="bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
                  >
                    Отправить за {MESSAGE_PRICE.toLocaleString("ru-RU")} ₽
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
            <p className="text-offwhite text-sm font-semibold mb-1">
              🚀 Продвинуть в топ — {BOOST_PRICE.toLocaleString("ru-RU")} ₽
            </p>
            <p className="text-muted text-xs mb-3">
              Осталось {boostsLeft} из {BOOST_LIMIT} возможных бустов для этой
              участницы
            </p>
            <button
              onClick={buyBoost}
              disabled={boostsLeft <= 0 || busy || !userId}
              className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-2 rounded-full text-sm disabled:opacity-40"
            >
              {boostsLeft <= 0 ? "Лимит исчерпан" : "Продвинуть"}
            </button>
          </div>

          {notice && (
            <p className="text-gold text-sm text-center mb-4">{notice}</p>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
