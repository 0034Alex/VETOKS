"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PageHeader from "@/components/PageHeader";
import { formatCoins } from "@/lib/coins";

type CollectibleCard = {
  id: string;
  stage: string;
  final_image_url: string | null;
  status: string;
};

type ThreadMessage = {
  id: string;
  sender_id: string;
  body: string;
  price: number;
  created_at: string;
};

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  user_id: string;
};

const MESSAGE_PRICE = 10000;
const CARD_PRICE = 25000;
const STAGE_LABELS: Record<string, string> = {
  casting: "Кастинг",
  week2: "Неделя 2",
  week3: "Неделя 3",
  grand_final: "Гранд-финал",
};
const BOOST_PRICE = 100000;
const BOOST_LIMIT = 3;
const BOOST_VOTES = 1000;

export default function ParticipantProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [giftTotal, setGiftTotal] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [rankPosition, setRankPosition] = useState<number | null>(null);
  const [votesToNextRank, setVotesToNextRank] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [boostCount, setBoostCount] = useState(0);
  const [cards, setCards] = useState<CollectibleCard[]>([]);
  const [goalText, setGoalText] = useState("");
  const [goalTarget, setGoalTarget] = useState(5000);
  const [goalCollected, setGoalCollected] = useState(0);
  const [goalEnabled, setGoalEnabled] = useState(true);
  const [goalDonors, setGoalDonors] = useState<
    { name: string; amount: number; created_at: string }[]
  >([]);
  const [donateAmount, setDonateAmount] = useState("100");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);

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

    // Позиция в общем рейтинге по голосам.
    const { data: allParticipants } = await supabase
      .from("participants")
      .select("id")
      .eq("is_eliminated", false);
    if (allParticipants) {
      const { data: allVotes } = await supabase.from("votes").select("participant_id");
      const counts: Record<string, number> = {};
      (allVotes ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });
      const sorted = allParticipants
        .map((p: { id: string }) => ({ id: p.id, votes: counts[p.id] ?? 0 }))
        .sort((a, b) => b.votes - a.votes);
      const idx = sorted.findIndex((p) => p.id === id);
      if (idx !== -1) {
        setRankPosition(idx + 1);
        if (idx >= 25) {
          const threshold = sorted[24]?.votes ?? 0;
          setVotesToNextRank(threshold - sorted[idx].votes + 1);
        } else {
          setVotesToNextRank(null);
        }
      }
    }

    const { count: boosts } = await supabase
      .from("boosts")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", id)
      .eq("boost_type", "rating_bump");
    setBoostCount(boosts ?? 0);

    const { data: cardsData } = await supabase
      .from("collectible_cards")
      .select("id, stage, final_image_url, status")
      .eq("participant_id", id);
    setCards((cardsData as CollectibleCard[]) ?? []);

    const u = await getCurrentUser();

    // Еженедельная цель.
    const { data: settingsData } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["weekly_goal_text", "weekly_goal_target", "weekly_goal_enabled"]);
    const settingsMap: Record<string, string> = {};
    (settingsData ?? []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });
    setGoalText(settingsMap.weekly_goal_text ?? "");
    setGoalTarget(Number(settingsMap.weekly_goal_target ?? 5000));
    setGoalEnabled(settingsMap.weekly_goal_enabled !== "false");

    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = day === 0 ? 6 : day - 1;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    const weekStartStr = monday.toISOString().slice(0, 10);

    const { data: contribData } = await supabase
      .from("weekly_goal_contributions")
      .select("amount, user_id, created_at")
      .eq("participant_id", id)
      .eq("week_start", weekStartStr)
      .order("created_at", { ascending: false });
    setGoalCollected(
      (contribData ?? []).reduce(
        (sum: number, c: { amount: number }) => sum + Number(c.amount),
        0
      )
    );

    if (p && u && u.id === (p as Participant).user_id && contribData && contribData.length > 0) {
      const donorIds = [...new Set(contribData.map((c: { user_id: string }) => c.user_id))];
      const { data: donorUsers } = await supabase
        .from("users")
        .select("id, first_name")
        .in("id", donorIds);
      const nameMap: Record<string, string> = {};
      (donorUsers ?? []).forEach((u2: { id: string; first_name: string }) => {
        nameMap[u2.id] = u2.first_name ?? "Гость";
      });
      setGoalDonors(
        contribData.map((c: { user_id: string; amount: number; created_at: string }) => ({
          name: nameMap[c.user_id] ?? "Гость",
          amount: Number(c.amount),
          created_at: c.created_at,
        }))
      );
    }

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

      if (p) {
        const { data: threadData } = await supabase
          .from("participant_messages")
          .select("id, sender_id, body, price, created_at")
          .eq("participant_id", id)
          .or(
            `and(sender_id.eq.${u.id},recipient_id.eq.${(p as Participant).user_id}),and(sender_id.eq.${(p as Participant).user_id},recipient_id.eq.${u.id})`
          )
          .order("created_at", { ascending: true });
        setThread((threadData as ThreadMessage[]) ?? []);
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

  async function notify(recipientId: string, message: string, link?: string) {
    await supabase.from("notifications").insert({
      user_id: recipientId,
      message,
      link: link ?? null,
    });
  }

  async function toggleFollow() {
    if (!userId || !participant) return;
    setBusy(true);
    if (isFollowing) {
      const { error } = await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", id)
        .eq("user_id", userId);
      if (error) setNotice(`Ошибка: ${error.message}`);
    } else {
      const { error } = await supabase
        .from("participant_follows")
        .insert({ participant_id: id, user_id: userId });
      if (error) setNotice(`Ошибка: ${error.message}`);
      else
        await notify(
          participant.user_id,
          `👥 У вас новый подписчик`,
          `/participant/${id}`
        );
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

    const { error: msgError } = await supabase
      .from("participant_messages")
      .insert({
        sender_id: userId,
        recipient_id: participant?.user_id,
        participant_id: id,
        body: messageText,
        price: MESSAGE_PRICE,
      });

    if (!msgError && participant) {
      await notify(
        participant.user_id,
        `✉️ Новое платное сообщение (${formatCoins(MESSAGE_PRICE)})`,
        `/messages/${userId}`
      );
    }

    setBalance((b) => b - MESSAGE_PRICE);
    setMessageText("");
    setNotice(
      msgError ? `Ошибка отправки: ${msgError.message}` : "Сообщение отправлено!"
    );
    setBusy(false);
    await loadThread();
  }

  async function sendReplyAsFan() {
    if (!userId || !participant || !messageText.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("participant_messages").insert({
      sender_id: userId,
      recipient_id: participant.user_id,
      participant_id: id,
      body: messageText,
      price: 0,
    });
    if (error) setNotice(`Ошибка: ${error.message}`);
    setMessageText("");
    setBusy(false);
    await loadThread();
  }

  async function loadThread() {
    if (!userId || !participant) return;
    const { data } = await supabase
      .from("participant_messages")
      .select("id, sender_id, body, price, created_at")
      .eq("participant_id", id)
      .or(
        `and(sender_id.eq.${userId},recipient_id.eq.${participant.user_id}),and(sender_id.eq.${participant.user_id},recipient_id.eq.${userId})`
      )
      .order("created_at", { ascending: true });
    setThread((data as ThreadMessage[]) ?? []);
  }

  async function buyCard(card: CollectibleCard) {
    if (!userId || !walletId || card.status !== "ready") return;
    if (balance < CARD_PRICE) {
      setNotice("Недостаточно средств для покупки карточки.");
      return;
    }
    setBusy(true);

    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "gift_sent",
      amount: -CARD_PRICE,
      related_participant_id: id,
      metadata: { kind: "collectible_card", stage: card.stage },
    });
    await supabase
      .from("wallets")
      .update({ balance: balance - CARD_PRICE })
      .eq("id", walletId);

    if (participant) {
      const pWallet = await getOrCreateWallet(participant.user_id);
      if (pWallet) {
        const earning = CARD_PRICE * 0.5;
        await supabase.from("wallet_transactions").insert({
          wallet_id: pWallet.id,
          type: "gift_received",
          amount: earning,
          related_participant_id: id,
          metadata: { kind: "collectible_card", stage: card.stage },
        });
        await supabase
          .from("wallets")
          .update({ balance: Number(pWallet.balance) + earning })
          .eq("id", pWallet.id);
      }
    }

    await supabase
      .from("collectible_cards")
      .update({ status: "sold", buyer_id: userId, sold_at: new Date().toISOString() })
      .eq("id", card.id);

    if (participant) {
      await notify(
        participant.user_id,
        `🃏 Продана карточка «${STAGE_LABELS[card.stage]}» за ${formatCoins(CARD_PRICE)}`,
        `/my-cards`
      );
    }

    setBalance((b) => b - CARD_PRICE);
    setNotice(`Карточка «${STAGE_LABELS[card.stage]}» ваша!`);
    await load();
    setBusy(false);
  }

  async function donateToGoal() {
    if (!userId || !walletId || !participant) return;
    const amount = Number(donateAmount);
    if (!amount || amount <= 0) return;
    if (balance < amount) {
      setNotice("Недостаточно средств.");
      return;
    }
    setBusy(true);

    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "gift_sent",
      amount: -amount,
      related_participant_id: id,
      metadata: { kind: "weekly_goal" },
    });
    await supabase
      .from("wallets")
      .update({ balance: balance - amount })
      .eq("id", walletId);

    const earning = amount * 0.5;
    const pWallet = await getOrCreateWallet(participant.user_id);
    if (pWallet) {
      await supabase.from("wallet_transactions").insert({
        wallet_id: pWallet.id,
        type: "gift_received",
        amount: earning,
        related_participant_id: id,
        metadata: { kind: "weekly_goal" },
      });
      await supabase
        .from("wallets")
        .update({ balance: Number(pWallet.balance) + earning })
        .eq("id", pWallet.id);
    }

    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = day === 0 ? 6 : day - 1;
    monday.setDate(monday.getDate() - diff);
    monday.setHours(0, 0, 0, 0);

    await supabase.from("weekly_goal_contributions").insert({
      participant_id: id,
      user_id: userId,
      amount,
      week_start: monday.toISOString().slice(0, 10),
    });

    await notify(participant.user_id, `💝 Вам задонатили ${formatCoins(amount)} на цель недели`, `/participant/${id}`);

    setBalance((b) => b - amount);
    setGoalCollected((g) => g + amount);
    setNotice("Спасибо за поддержку!");
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

    // Половина стоимости буста — участнице, как и с подарками/сообщениями.
    if (participant) {
      const pWallet = await getOrCreateWallet(participant.user_id);
      if (pWallet) {
        const earning = BOOST_PRICE * 0.5;
        await supabase.from("wallet_transactions").insert({
          wallet_id: pWallet.id,
          type: "gift_received",
          amount: earning,
          related_participant_id: id,
          metadata: { kind: "boost" },
        });
        await supabase
          .from("wallets")
          .update({ balance: Number(pWallet.balance) + earning })
          .eq("id", pWallet.id);
      }
    }

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + 7);

    await supabase.from("boosts").insert({
      participant_id: id,
      boost_type: "rating_bump",
      price: BOOST_PRICE,
      ends_at: endsAt.toISOString(),
      wallet_transaction_id: tx?.id ?? null,
    });

    // Буст = 1000 реальных голосов, честно помеченных как купленные —
    // они сразу считаются в общем счётчике голосов везде в приложении,
    // но не участвуют в честном суточном топ-25.
    const boostVotes = Array.from({ length: BOOST_VOTES }, () => ({
      voter_id: userId,
      participant_id: id,
      weight: 1,
      is_paid: true,
    }));
    await supabase.from("votes").insert(boostVotes);

    if (participant) {
      await notify(
        participant.user_id,
        `🚀 Ваш профиль продвинут — +${BOOST_VOTES} голосов`,
        `/participant/${id}`
      );
    }

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
      <PageHeader />

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
            <Link href={`/participant/${id}/gifts`} className="text-gold underline">
              🎁 {giftCount} подарков
            </Link>
            <span className="text-muted">👥 {followerCount} подписчиков</span>
          </div>

          {rankPosition !== null && (
            <p className="text-muted text-sm mb-4">
              #{rankPosition} в общем рейтинге
              {votesToNextRank !== null && votesToNextRank > 0 && (
                <> · до топ-25: +{votesToNextRank} голосов</>
              )}
            </p>
          )}

          {isOwner && giftTotal > 0 && (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-muted text-xs mb-1">
                Ваш заработок с подарков (видно только вам)
              </p>
              <p className="text-gold text-xl font-semibold">{formatCoins(giftTotal)}</p>
            </div>
          )}

          {goalText && goalEnabled && (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-offwhite text-sm font-semibold mb-1">
                🎯 Цель недели
              </p>
              <p className="text-muted text-xs mb-3">{goalText}</p>
              <div className="w-full bg-black/30 rounded-full h-2 mb-1">
                <div
                  className="bg-gold rounded-full h-2"
                  style={{
                    width: `${Math.min(100, (goalCollected / goalTarget) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-muted text-xs mb-3">
                Собрано {formatCoins(goalCollected)} / {formatCoins(goalTarget)}
              </p>
              {!isOwner && (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={donateAmount}
                    onChange={(e) => setDonateAmount(e.target.value)}
                    className="flex-1 bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
                    min={10}
                  />
                  <button
                    onClick={donateToGoal}
                    disabled={busy || !userId}
                    className="bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-40"
                  >
                    Задонатить
                  </button>
                </div>
              )}
              {isOwner && goalDonors.length > 0 && (
                <div className="border-t border-muted mt-3 pt-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
                  <p className="text-muted text-xs">
                    Кто донатил на цель (видно только вам — чтобы могли
                    записать благодарность):
                  </p>
                  {goalDonors.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-offwhite">{d.name}</span>
                      <span className="text-gold">{formatCoins(d.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
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

          {cards.length > 0 && (
            <div className="mb-4">
              <p className="text-offwhite text-sm font-semibold mb-2">
                🃏 Коллекционные карточки
              </p>
              <div className="grid grid-cols-4 gap-2">
                {cards.map((c) => (
                  <div
                    key={c.stage}
                    className="bg-bgSurface border border-muted rounded-lg overflow-hidden"
                  >
                    <div className="aspect-[3/4] bg-black/40 flex items-center justify-center relative">
                      {c.final_image_url && c.status !== "pending" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.final_image_url}
                          alt={STAGE_LABELS[c.stage]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-muted text-[10px] text-center px-1">
                          🔒
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => buyCard(c)}
                      disabled={c.status !== "ready" || busy || !userId}
                      className="w-full text-[10px] py-1.5 font-semibold disabled:opacity-40 bg-gold text-bgPrimary"
                    >
                      {c.status === "sold"
                        ? "Продана"
                        : c.status === "ready"
                        ? formatCoins(25000)
                        : "Скоро"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {thread.length > 0 && (
                <div className="flex flex-col gap-2 mb-3 max-h-64 overflow-y-auto">
                  {thread.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender_id === userId
                          ? "self-end bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
                          : "self-start bg-bgPrimary text-offwhite"
                      }`}
                    >
                      {m.body}
                    </div>
                  ))}
                </div>
              )}

              {thread.length === 0 && !messageOpen ? (
                <button
                  onClick={() => setMessageOpen(true)}
                  disabled={!userId}
                  className="w-full text-offwhite font-semibold text-sm disabled:opacity-40"
                >
                  ✉️ Написать участнице — от {formatCoins(MESSAGE_PRICE)}
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={2}
                    placeholder="Ваше сообщение..."
                    className="bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    onClick={thread.length > 0 ? sendReplyAsFan : sendMessage}
                    disabled={busy || !messageText.trim()}
                    className="bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
                  >
                    {thread.length > 0
                      ? "Отправить"
                      : `Отправить за ${formatCoins(MESSAGE_PRICE)}`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
            <p className="text-offwhite text-sm font-semibold mb-1">
              🚀 Продвинуть в топ — {formatCoins(BOOST_PRICE)}
            </p>
            <p className="text-muted text-xs mb-3">
              +1000 голосов сразу · осталось {boostsLeft} из {BOOST_LIMIT}{" "}
              возможных бустов для этой участницы (не учитывается в честном
              суточном топ-25)
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
