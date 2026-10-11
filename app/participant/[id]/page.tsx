"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PageHeader from "@/components/PageHeader";
import VoteModal from "@/components/VoteModal";
import { getAppPrices, getCurrencySymbol } from "@/lib/currency";
import { apiPost } from "@/lib/authClient";
import { getVoteTotals } from "@/lib/voteTotals";

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

// Цены теперь не зашиты в коде — берутся из CRM («Базовые цены», в
// долларах) и переводятся в текущую валюту по курсу из CRM («Страны и
// регионы»). Значения ниже — только запасной вариант на случай, если
// цены в CRM ещё не заданы.
const DEFAULT_CARD_PRICE = 120;
const STAGE_LABELS: Record<string, string> = {
  casting: "Кастинг",
  week2: "Неделя 2",
  week3: "Неделя 3",
  grand_final: "Гранд-финал",
};
const DEFAULT_BOOST_PRICE = 400;
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
  const [videoPosts, setVideoPosts] = useState<{ id: string; video_url: string }[]>([]);
  const [photoPosts, setPhotoPosts] = useState<{ id: string; photo_url: string }[]>([]);
  const [feedTab, setFeedTab] = useState<"video" | "photo">("video");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [boostCount, setBoostCount] = useState(0);
  const [cards, setCards] = useState<CollectibleCard[]>([]);
  const [goalText, setGoalText] = useState("");
  const [goalTarget, setGoalTarget] = useState(5000);
  const [goalCollected, setGoalCollected] = useState(0);
  const [goalEnabled, setGoalEnabled] = useState(true);
  const [currencySymbol, setCurrencySymbol] = useState("₴");
  const [cardPrice, setCardPrice] = useState(DEFAULT_CARD_PRICE);
  const [boostPrice, setBoostPrice] = useState(DEFAULT_BOOST_PRICE);
  const [goalDonors, setGoalDonors] = useState<
    { name: string; amount: number; created_at: string }[]
  >([]);
  const [donateAmount, setDonateAmount] = useState("100");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [messageText, setMessageText] = useState("");
  const [thread, setThread] = useState<ThreadMessage[]>([]);

  async function load() {
    setLoading(true);

    const [symbol, prices] = await Promise.all([
      getCurrencySymbol(),
      getAppPrices(),
    ]);
    setCurrencySymbol(symbol);
    setCardPrice(prices.collectible_card || DEFAULT_CARD_PRICE);
    setBoostPrice(prices.boost || DEFAULT_BOOST_PRICE);

    const { data: p } = await supabase
      .from("participants")
      .select("id, display_name, bio, photo_url, user_id")
      .eq("id", id)
      .maybeSingle();
    setParticipant(p as Participant | null);

    // Голоса — из базы с учётом штрафов за чёрные метки.
    const totals = await getVoteTotals();
    setVoteCount(totals[id] ?? 0);

    const { data: videosData } = await supabase
      .from("content_posts")
      .select("id, video_url")
      .eq("participant_id", id)
      .not("video_url", "is", null)
      .order("submitted_at", { ascending: false });
    setVideoPosts((videosData as any) ?? []);

    const { data: photosData } = await supabase
      .from("content_posts")
      .select("id, photo_url")
      .eq("participant_id", id)
      .not("photo_url", "is", null)
      .order("submitted_at", { ascending: false });
    setPhotoPosts((photosData as any) ?? []);

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
      const sorted = allParticipants
        .map((p: { id: string }) => ({ id: p.id, votes: totals[p.id] ?? 0 }))
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
      .in("key", [
        "weekly_goal_text",
        "weekly_goal_target",
        "weekly_goal_enabled",
      ]);
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

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", u.id)
        .maybeSingle();
      setBalance(wallet ? Number(wallet.balance) : 0);

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

  function purchaseError(r: any, fallback: string) {
    if (r?.error === "not_enough") return "Недостаточно средств. Пополните баланс в разделе «Подарки».";
    if (r?.error === "sold") return "Эту карточку уже купили.";
    if (r?.error === "limit") return "Лимит бустов исчерпан.";
    if (r?.error === "banned") return "Аккаунт заблокирован.";
    return fallback;
  }

  async function buyCard(card: CollectibleCard) {
    if (!userId || card.status !== "ready") return;
    if (balance < cardPrice) {
      setNotice("Недостаточно средств для покупки карточки.");
      return;
    }
    setBusy(true);
    const r = await apiPost("/api/shop/buy-card", { cardId: card.id });
    if (r.ok) {
      setBalance(Number(r.balance));
      setNotice(`Карточка «${STAGE_LABELS[card.stage] ?? card.stage}» ваша!`);
    } else {
      setNotice(purchaseError(r, "Не удалось купить карточку."));
    }
    await load();
    setBusy(false);
  }

  async function donateToGoal() {
    if (!userId || !participant) return;
    const amount = Number(donateAmount);
    if (!amount || amount < 10) {
      setNotice("Минимальный донат — 10.");
      return;
    }
    if (balance < amount) {
      setNotice("Недостаточно средств.");
      return;
    }
    setBusy(true);
    const r = await apiPost("/api/shop/donate", { participantId: id, amount });
    if (r.ok) {
      setBalance(Number(r.balance));
      setGoalCollected((g) => g + amount);
      setNotice("Спасибо за поддержку!");
    } else {
      setNotice(purchaseError(r, "Не удалось отправить донат."));
    }
    setBusy(false);
  }

  async function buyBoost() {
    if (!userId) return;
    if (boostCount >= BOOST_LIMIT) return;
    if (balance < boostPrice) {
      setNotice("Недостаточно средств для буста.");
      return;
    }
    setBusy(true);
    const r = await apiPost("/api/shop/boost", { participantId: id });
    if (r.ok) {
      setBalance(Number(r.balance));
      setNotice("Буст активирован на 7 дней!");
    } else {
      setNotice(purchaseError(r, "Не удалось купить буст."));
    }
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
    <main className="min-h-screen pb-40">
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
              <p className="text-gold text-xl font-semibold">{Math.round(giftTotal)} {currencySymbol}</p>
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
                Собрано {Math.round(goalCollected)} / {goalTarget} {currencySymbol}
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
                      <span className="text-gold">{Math.round(d.amount)} {currencySymbol}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {participant.bio && (
            <p className="text-offwhite text-sm mb-6">{participant.bio}</p>
          )}

          <div
            className="fixed left-0 right-0 z-40 px-6"
            style={{ bottom: "calc(60px + env(safe-area-inset-bottom))" }}
          >
          <div className="max-w-md mx-auto flex gap-3 bg-bgPrimary/90 backdrop-blur rounded-full p-1">
            <button
              onClick={() => setVoteModalOpen(true)}
              disabled={!userId}
              className="flex-1 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-3 rounded-full text-sm disabled:opacity-40"
            >
              🗳️ Проголосовать
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
                        ? `${cardPrice.toLocaleString("ru-RU")} ${currencySymbol}`
                        : "Скоро"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isFollowing ? (
            <button
              onClick={toggleFollow}
              disabled={busy || !userId}
              className="w-full border border-muted text-muted font-semibold py-3 rounded-full text-sm disabled:opacity-40 mb-3"
            >
              Отписаться
            </button>
          ) : (
            <div
              className="rounded-full p-[2px] mb-3"
              style={{
                background:
                  "conic-gradient(from var(--vetoks-follow-angle, 0deg), transparent 0%, #C9A227 12%, #F5E6A8 18%, #C9A227 24%, transparent 36%)",
                animation: "vetoks-follow-border-spin 3s linear infinite",
              }}
            >
              <button
                onClick={toggleFollow}
                disabled={busy || !userId}
                className="w-full bg-bgPrimary text-gold font-semibold py-3 rounded-full text-sm disabled:opacity-40"
              >
                Подписаться
              </button>
            </div>
          )}
          <style>{`
            @property --vetoks-follow-angle {
              syntax: '<angle>';
              initial-value: 0deg;
              inherits: false;
            }
            @keyframes vetoks-follow-border-spin {
              to { --vetoks-follow-angle: 360deg; }
            }
          `}</style>

          {!isOwner && thread.length > 0 && (
            <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-3">
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
              <div className="flex flex-col gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={2}
                  placeholder="Ваш ответ..."
                  className="bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={sendReplyAsFan}
                  disabled={busy || !messageText.trim()}
                  className="bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
                >
                  Отправить
                </button>
              </div>
            </div>
          )}

          <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
            <p className="text-offwhite text-sm font-semibold mb-1">
              🚀 Продвинуть в топ — {boostPrice.toLocaleString("ru-RU")} {currencySymbol}
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

          {(videoPosts.length > 0 || photoPosts.length > 0) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setFeedTab("video")}
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    feedTab === "video"
                      ? "bg-gold text-bgPrimary"
                      : "text-muted border border-muted"
                  }`}
                >
                  🎬 Видео
                </button>
                <button
                  onClick={() => setFeedTab("photo")}
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    feedTab === "photo"
                      ? "bg-gold text-bgPrimary"
                      : "text-muted border border-muted"
                  }`}
                >
                  🖼 Фото
                </button>
              </div>

              {feedTab === "video" && (
                videoPosts.length === 0 ? (
                  <p className="text-muted text-xs">Пока нет видео.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {videoPosts.map((post, i) => (
                      <Link
                        key={post.id}
                        href={`/participant/${id}/videos?start=${i}`}
                        className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden"
                      >
                        <video
                          src={post.video_url}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </Link>
                    ))}
                  </div>
                )
              )}

              {feedTab === "photo" && (
                photoPosts.length === 0 ? (
                  <p className="text-muted text-xs">Пока нет фото.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {photoPosts.map((post, i) => (
                      <Link
                        key={post.id}
                        href={`/participant/${id}/photos?start=${i}`}
                        className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={post.photo_url}
                          alt=""
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      </Link>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {notice && (
            <p className="text-gold text-sm text-center mb-4">{notice}</p>
          )}
        </div>
      </div>

      {voteModalOpen && (
        <VoteModal
          participantId={id}
          userId={userId}
          onClose={() => setVoteModalOpen(false)}
        />
      )}

      <BottomNav />
    </main>
  );
}
