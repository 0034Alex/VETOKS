"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import FollowsSheet from "@/components/FollowsSheet";
import ProfileHero, { ProfileActions, BigBtn, RoundBtn, TopBtn, IconMail, shareLink, KpiCrown, KpiHeart, KpiGift } from "@/components/ProfileHero";
import ProfileTabs from "@/components/ProfileTabs";
import { GiftIcon, parseLinks } from "@/lib/socialLinks";
import { statusFor } from "@/lib/status";
import { loadTitleBadges, TitleBadge } from "@/lib/profileExtras";
import VoteModal from "@/components/VoteModal";
import VoteCardModal from "@/components/VoteCardModal";
import { getAppPrices, getCurrencySymbol } from "@/lib/currency";
import { apiPost } from "@/lib/authClient";
import { getVoteTotals } from "@/lib/voteTotals";
import { getMyCountry, loadGoalSettings } from "@/lib/myCountry";

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
  const router = useRouter();
  const id = params.id as string;
  const [owner, setOwner] = useState<{
    photoUrl: string | null;
    bio: string;
    city: string | null;
    socials: string[];
    nick: string | null;
    following: number | null;
    verified: boolean;
    regionName: string | null;
    status: { contest?: string; stage_key?: string; crown?: string | null } | null;
    titles: TitleBadge[];
  } | null>(null);
  const [toast, setToast] = useState("");
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);

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
  const [cardOpen, setCardOpen] = useState(false);
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
      .select("id, display_name, bio, photo_url, user_id, region_id")
      .eq("id", id)
      .maybeSingle();
    const mcp = await getMyCountry();
    if (p && mcp.countryId && (!(p as any).region_id || !mcp.regionIds.includes((p as any).region_id))) {
      setParticipant(null);
      return;
    }
    setParticipant(p as Participant | null);

    if (p) {
      const { data: ou } = await supabase
        .from("users")
        .select("photo_url, bio, social_links, privacy, nick, regions(name)")
        .eq("id", (p as Participant).user_id)
        .maybeSingle();
      const priv = (((ou as any)?.privacy ?? {}) as Record<string, boolean>) || {};
      let fl: number | null = null;
      if (priv.follows !== false) {
        const { count } = await supabase
          .from("participant_follows")
          .select("id", { count: "exact", head: true })
          .eq("user_id", (p as Participant).user_id);
        fl = count ?? 0;
      }
      const { data: vb } = await supabase.from("users").select("verified_badge").eq("id", (p as Participant).user_id).maybeSingle();
      const { data: stRow } = await supabase.from("participants").select("contest, stage_key, crown").eq("id", id).maybeSingle();
      const titles = await loadTitleBadges(id);
      setOwner({
        verified: !!(vb as any)?.verified_badge,
        regionName: (Array.isArray((ou as any)?.regions) ? (ou as any).regions[0]?.name : (ou as any)?.regions?.name) ?? null,
        status: (stRow as any) ?? null,
        titles,
        photoUrl: (ou as any)?.photo_url ?? null,
        bio: (ou as any)?.bio ?? "",
        city: priv.region === false ? null : (ou as any)?.regions?.name ?? null,
        socials: parseLinks((ou as any)?.social_links),
        nick: ((ou as any)?.nick as string | null) ?? null,
        following: fl,
      });
    }

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
    const settingsMap = await loadGoalSettings((await getMyCountry()).countryId);
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

  async function share() {
    if (!participant) return;
    // Ссылка ведёт на красивую страницу с карточкой — в Telegram и Instagram виден предпросмотр.
    const r = await shareLink(window.location.origin + `/v/${id}`, participant.display_name);
    if (r === "copied") {
      setToast("Ссылка скопирована");
      setTimeout(() => setToast(""), 2000);
    }
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
      <LoadingScreen />
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
  const ps = statusFor(owner?.status?.contest, owner?.status?.stage_key, owner?.status?.crown, owner?.regionName ?? null);
  const boostsLeft = BOOST_LIMIT - boostCount;

  return (
    <main className="min-h-screen pb-36">
      <div className="max-w-md mx-auto">
        <ProfileHero
          photoUrl={participant.photo_url ?? owner?.photoUrl ?? null}
          name={participant.display_name}
          status={ps.text}
          statusTone={ps.tone}
          statusTalent={ps.talent}
          badges={owner?.titles ?? []}
          city={owner?.city ?? null}
          rank={votesToNextRank !== null && votesToNextRank > 0 ? `До топ-25: +${votesToNextRank} голосов` : null}
          kpis={[
            { icon: <KpiCrown />, value: rankPosition !== null ? `№${rankPosition}` : "—", label: "в рейтинге" },
            { icon: <KpiHeart />, value: voteCount.toLocaleString("ru-RU"), label: "голосов" },
            { icon: <KpiGift />, value: giftCount.toLocaleString("ru-RU"), label: "подарков" },
          ]}
          bio={owner?.bio || participant.bio || ""}
          socials={owner?.socials ?? []}
          stats={[
            { value: videoPosts.length + photoPosts.length, label: "Публикации" },
            { value: followerCount, label: "Подписчики", onClick: () => setFollowSheet("followers") },
            ...(owner?.following != null ? [{ value: owner.following, label: "Подписки", onClick: () => setFollowSheet("following") }] : []),
          ]}
          onShare={share}
          verified={owner?.verified ?? false}
          topRight={
            <>
              <TopBtn onClick={() => router.back()} label="Назад">
                <span className="text-xl leading-none">←</span>
              </TopBtn>
            </>
          }
        />

        <ProfileActions>
          {isOwner ? (
            <>
              <BigBtn href="/edit-profile">Править профиль</BigBtn>
              <BigBtn variant="vote" onClick={() => setCardOpen(true)}>
                Позвать голосовать
              </BigBtn>
              <RoundBtn href={`/participant/${id}/gifts`} label="Подарки">
                <GiftIcon />
              </RoundBtn>
            </>
          ) : (
            <>
              <BigBtn variant={isFollowing ? "on" : "gold"} onClick={toggleFollow} disabled={busy || !userId}>
                {isFollowing ? "✓ Вы подписаны" : "Подписаться"}
              </BigBtn>
              <BigBtn variant="vote" onClick={() => setVoteModalOpen(true)} disabled={!userId}>
                Голосовать
              </BigBtn>
              <RoundBtn
                href={`/shop?participant=${participant.id}&name=${encodeURIComponent(participant.display_name)}`}
                label="Подарить"
              >
                <GiftIcon />
              </RoundBtn>
              {userId && (
                <RoundBtn href={`/chats/${participant.user_id}`} label="Написать">
                  <IconMail />
                </RoundBtn>
              )}
            </>
          )}
        </ProfileActions>
        <ProfileTabs userId={participant.user_id} />
        <div className="px-6 mt-5">
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

          {notice && (
            <p className="text-gold text-sm text-center mb-4">{notice}</p>
          )}
        </div>
      </div>

      {followSheet && participant && (
        <FollowsSheet userId={participant.user_id} kind={followSheet} onClose={() => setFollowSheet(null)} />
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-44 z-50 bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}

      {cardOpen && <VoteCardModal participantId={participant.id} onClose={() => setCardOpen(false)} />}

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
