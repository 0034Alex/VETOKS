"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { getMyCountry, loadGoalSettings } from "@/lib/myCountry";
import { getVoteTotals } from "@/lib/voteTotals";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, signOutUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import SocialLinksBar from "@/components/SocialLinksBar";
import FollowsSheet from "@/components/FollowsSheet";
import CoinIcon from "@/components/CoinIcon";
import ProfileHero, { TopBtn, Drawer, IconBell, IconMenu, IconSend, shareLink, KpiCrown, KpiHeart, KpiGift } from "@/components/ProfileHero";
import ProfileTabs from "@/components/ProfileTabs";
import { parseLinks } from "@/lib/socialLinks";
import { statusFor } from "@/lib/status";
import { loadTitleBadges, TitleBadge } from "@/lib/profileExtras";
import AccountSwitcher from "@/components/AccountSwitcher";
import { getCurrencySymbol } from "@/lib/currency";
import { useT } from "@/lib/i18n";
import { useShow, hasBlock } from "@/lib/useShow";
import { apiPost } from "@/lib/authClient";
import GiftShowcase from "@/components/GiftShowcase";

type Participant = { id: string; display_name: string };
type Post = { id: string; video_url?: string; photo_url?: string };

function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return phone.slice(0, 3) + "*** ** " + digits.slice(-2);
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  const visible = name.slice(0, 1);
  return `${visible}***@${domain}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useT();
  const { show: curShowR } = useShow();
  const onR = (k: string) => hasBlock(curShowR, k);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [, setUnreadMessages] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [goalText, setGoalText] = useState("");
  const [goalTarget, setGoalTarget] = useState(5000);
  const [goalCollected, setGoalCollected] = useState(0);
  const [goalEnabled, setGoalEnabled] = useState(true);
  const [showPrivate, setShowPrivate] = useState(false);
  const [tasksDone, setTasksDone] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("\uE000");
  const [crowns, setCrowns] = useState(0);
  const [votes, setVotes] = useState(0);
  const TOTAL_TASKS = 3;
  const [loading, setLoading] = useState(true);
  const [phoneDone, setPhoneDone] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [nick, setNick] = useState<string | null>(null);
  const [badgeOn, setBadgeOn] = useState(false);
  const [statusRaw, setStatusRaw] = useState<{ contest?: string; stage_key?: string; crown?: string | null } | null>(null);
  const [titleBadges, setTitleBadges] = useState<TitleBadge[]>([]);
  const [socials, setSocials] = useState<string[]>([]);
  const [myChannels, setMyChannels] = useState<any[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [ownPosts, setOwnPosts] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [videos, setVideos] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<Post[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const done = () => setPhoneDone(true);
    window.addEventListener("vetoks:verified", done);
    return () => window.removeEventListener("vetoks:verified", done);
  }, []);

  useEffect(() => {
    apiPost("/api/dm/unread").then((r) => {
      if (r?.ok) setDmUnread(r.count);
    });
  }, []);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installAndroid() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else {
      router.push("/install");
    }
  }

  useEffect(() => {
    (async () => {
      setCurrencySymbol(await getCurrencySymbol());

      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/profile");
        return;
      }
      setUser(u);

      const { data: p } = await supabase
        .from("participants")
        .select("id, display_name")
        .eq("user_id", u.id)
        .maybeSingle();
      setParticipant(p as Participant | null);

      const { data: sponsorRow } = await supabase
        .from("sponsors")
        .select("id")
        .eq("user_id", u.id)
        .eq("status", "approved")
        .maybeSingle();
      setIsPartner(!!sponsorRow);

      if (p) {
        const totals = await getVoteTotals();
        setVoteCount(totals[(p as Participant).id] ?? 0);

        const { data: giftsData } = await supabase
          .from("gifts")
          .select("quantity")
          .eq("participant_id", (p as Participant).id);
        setGiftCount(
          (giftsData ?? []).reduce(
            (sum: number, g: { quantity: number }) => sum + (g.quantity ?? 1),
            0
          )
        );

        const { data: wallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", u.id)
          .maybeSingle();
        if (wallet) {
          const { count: doneTasks } = await supabase
            .from("wallet_transactions")
            .select("id", { count: "exact", head: true })
            .eq("wallet_id", wallet.id)
            .eq("type", "task_reward");
          setTasksDone(doneTasks ?? 0);
        }

        const { count: unreadMsgs } = await supabase
          .from("participant_messages")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", (p as Participant).id)
          .eq("recipient_id", u.id)
          .eq("is_read", false);
        setUnreadMessages(unreadMsgs ?? 0);

        const settingsMap = await loadGoalSettings((await getMyCountry()).countryId);
        setGoalText(settingsMap.weekly_goal_text ?? "");
        setGoalTarget(Number(settingsMap.weekly_goal_target ?? 5000));
        setGoalEnabled(settingsMap.weekly_goal_enabled !== "false");

        const now = new Date();
        const monday = new Date(now);
        const day = monday.getDay();
        const diffDays = day === 0 ? 6 : day - 1;
        monday.setDate(monday.getDate() - diffDays);
        monday.setHours(0, 0, 0, 0);
        const weekStartStr = monday.toISOString().slice(0, 10);

        const { data: contribData } = await supabase
          .from("weekly_goal_contributions")
          .select("amount")
          .eq("participant_id", (p as Participant).id)
          .eq("week_start", weekStartStr);
        setGoalCollected(
          (contribData ?? []).reduce(
            (sum: number, c: { amount: number }) => sum + Number(c.amount),
            0
          )
        );
      }

      const cnt = await apiPost("/api/notifications/my", { action: "count" });
      setReferralCount(cnt?.referrals ?? 0);
      setUnreadCount(cnt?.unread ?? 0);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance, withdrawable_balance")
        .eq("user_id", u.id)
        .maybeSingle();
      setBalance(wallet ? Number(wallet.balance) : 0);
      setCrowns(wallet ? Number((wallet as any).withdrawable_balance ?? 0) : 0);
      const { data: vc } = await supabase.from("vote_credits").select("balance").eq("user_id", u.id).maybeSingle();
      setVotes(Number(vc?.balance ?? 0));

      setLoading(false);
    })();
  }, [router]);

  // Данные для шапки профиля: фото, «о себе», соцсети, подписки, место в рейтинге, лента.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: row } = await supabase
        .from("users")
        .select("photo_url, bio, social_links, nick")
        .eq("id", user.id)
        .maybeSingle();
      const { count: fl } = await supabase
        .from("participant_follows")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const { count: fl2 } = await supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", user.id);
      setFollowing((fl ?? 0) + (fl2 ?? 0));
      const { count: fl3 } = await supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("followed_id", user.id);
      const { count: pc } = await supabase
        .from("content_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setOwnPosts(pc ?? 0);
      if (!participant) setFollowers(fl3 ?? 0);
      setSocials(parseLinks((row as any)?.social_links));
      apiPost("/api/channels", { action: "profile_list", userId: user.id }).then((r: any) => r?.ok && setMyChannels(r.channels));
      setNick(((row as any)?.nick as string | null) ?? null);
      const { data: vb } = await supabase.from("users").select("verified_badge").eq("id", user.id).maybeSingle();
      setBadgeOn(!!(vb as any)?.verified_badge);
      let ph: string | null = (row as any)?.photo_url ?? null;
      let b: string = (row as any)?.bio ?? "";
      if (participant) {
        const { data: pr } = await supabase
          .from("participants")
          .select("photo_url, bio")
          .eq("id", participant.id)
          .maybeSingle();
        ph = (pr as any)?.photo_url ?? ph;
        b = b || (pr as any)?.bio || "";
        const { data: st } = await supabase
          .from("participants")
          .select("contest, stage_key, crown, age_category")
          .eq("id", participant.id)
          .maybeSingle();
        setStatusRaw((st as any) ?? null);
        setTitleBadges(await loadTitleBadges(participant.id));
        const { count: fc } = await supabase
          .from("participant_follows")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", participant.id);
        setFollowers(fc ?? 0);
        const totals = await getVoteTotals();
        const { data: all } = await supabase.from("participants").select("id").eq("is_eliminated", false).eq("age_category", (st as any)?.age_category ?? "main");
        const sorted = (all ?? [])
          .map((x: { id: string }) => ({ id: x.id, v: totals[x.id] ?? 0 }))
          .sort((a, c) => c.v - a.v);
        const idx = sorted.findIndex((x) => x.id === participant.id);
        setRank(idx === -1 ? null : idx + 1);
        const { data: vids } = await supabase
          .from("content_posts")
          .select("id, video_url")
          .eq("participant_id", participant.id)
          .not("video_url", "is", null)
          .order("submitted_at", { ascending: false });
        setVideos((vids as Post[]) ?? []);
        const { data: phs } = await supabase
          .from("content_posts")
          .select("id, photo_url")
          .eq("participant_id", participant.id)
          .not("photo_url", "is", null)
          .order("submitted_at", { ascending: false });
        setPhotos((phs as Post[]) ?? []);
      }
      setPhotoUrl(ph);
      setBio(b);
    })();
  }, [user, participant]);

  async function share() {
    if (!user) return;
    const path = nick ? `/n/${nick}` : participant ? `/participant/${participant.id}` : `/u/${user.id}`;
    const r = await shareLink(window.location.origin + path, user.first_name ?? "VETOKS");
    if (r === "copied") {
      setToast("Ссылка скопирована");
      setTimeout(() => setToast(""), 2000);
    }
  }

  async function handleLogout() {
    await signOutUser();
    router.push("/login");
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }


  const needBirth = !!user && !user.birth_date;
  const menuBadge = (user && !user.phone_verified && !phoneDone ? 1 : 0) + (needBirth ? 1 : 0);
  const initialsName = user?.first_name || nick || "";
  const st = participant ? statusFor(statusRaw?.contest, statusRaw?.stage_key, statusRaw?.crown, user?.regions?.name ?? null) : null;
  const goalPct = Math.min(100, goalTarget ? (goalCollected / goalTarget) * 100 : 0);

  const Row = ({ href, label, right }: { href: string; label: string; right?: string }) => (
    <a href={href} className="flex items-center justify-between py-3.5 border-b border-muted/40 text-offwhite text-sm">
      <span>{label}</span>
      <span className="text-muted text-[13px]">{right ?? "→"}</span>
    </a>
  );


  return (
    <main className="min-h-screen pb-36">
      <div className="max-w-md mx-auto">
        <ProfileHero
          photoUrl={photoUrl}
          name={initialsName}
          status={st?.text ?? null}
          statusTone={st?.tone}
          statusTalent={st?.talent}
          badges={titleBadges}
          city={user?.regions?.name ?? null}
          bio={bio}
          socials={socials}
          channels={myChannels}
          stats={
            participant
              ? [
                  { value: videos.length + photos.length, label: "Публикации" },
                  { value: followers, label: "Подписчики", onClick: () => setFollowSheet("followers") },
                  { value: following, label: "Подписки", onClick: () => router.push("/my-follows") },
                ]
              : [
                  { value: ownPosts, label: "Публикации" },
                  { value: followers, label: "Подписчики", onClick: () => setFollowSheet("followers") },
                  { value: following, label: "Подписки", onClick: () => router.push("/my-follows") },
                ]
          }
          kpis={
            participant
              ? [
                  { icon: <KpiCrown />, value: rank ? `№${rank}` : "—", label: "в рейтинге" },
                  { icon: <KpiHeart />, value: voteCount.toLocaleString("ru-RU"), label: "голосов" },
                  { icon: <KpiGift />, value: giftCount.toLocaleString("ru-RU"), label: "подарков" },
                ]
              : []
          }
          onShare={share}
          actions={
            <>
              <Link
                href="/edit-profile"
                className="flex-1 min-w-0 h-11 rounded-xl border border-muted/60 bg-bgSurface text-offwhite text-[14px] font-semibold flex items-center justify-center"
              >
                Редактировать
              </Link>
              <Link
                href="/chats"
                className="relative flex-1 min-w-0 h-11 rounded-xl border border-muted/60 bg-bgSurface text-offwhite text-[14px] font-semibold flex items-center justify-center"
              >
                Сообщения
                {dmUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1 bg-danger text-white text-[10px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center">
                    {dmUnread > 9 ? "9+" : dmUnread}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={share}
                aria-label="Поделиться"
                className="flex-none w-11 h-11 rounded-xl border border-muted/60 bg-bgSurface text-offwhite flex items-center justify-center"
              >
                <IconSend />
              </button>
            </>
          }
          verified={badgeOn}
          belowCrown={<AccountSwitcher chip />}
          topRight={
            <>
              <TopBtn href="/add-video" label="Новая публикация">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-goldSoft))" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </TopBtn>
              <TopBtn href="/notifications" label="Уведомления" badge={unreadCount}>
                <IconBell />
              </TopBtn>
              <TopBtn onClick={() => setMenuOpen(true)} label="Меню" badge={menuBadge}>
                <IconMenu />
              </TopBtn>
            </>
          }
        />

        <div className="px-5">
          {user?.region_pending && (
            <a href="/edit-profile" className="block bg-bgSurface border border-gold rounded-xl px-4 py-3 mt-5">
              <p className="text-gold text-sm font-semibold">Выберите ваш регион</p>
              <p className="text-muted text-xs mt-0.5">Вас перенесли в новую страну. Укажите свой регион, чтобы попасть в нужный рейтинг и ленту.</p>
            </a>
          )}
          <GiftShowcase className="mt-5" />
        </div>
        <ProfileTabs />
      </div>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-44 z-50 bg-bgSurface border border-gold text-gold text-sm px-4 py-2 rounded-full">
          {toast}
        </div>
      )}

      {followSheet && <FollowsSheet kind={followSheet} onClose={() => setFollowSheet(null)} />}

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Меню">
        <div className="text-muted text-xs leading-relaxed mb-1">
          <div className="flex items-center justify-between">
            <span>
              {showPrivate ? user?.phone : maskPhone(user?.phone)} · {showPrivate ? user?.email : maskEmail(user?.email)}
            </span>
            <button onClick={() => setShowPrivate((v) => !v)} className="text-muted whitespace-nowrap ml-2">
              {showPrivate ? t("profile.hideData") : t("profile.showData")}
            </button>
          </div>
          <div>
            {t("profile.region")} {user?.regions?.name ?? "—"} · ID: {user?.referral_code}
          </div>
        </div>

      {user && !user.phone_verified && !phoneDone && (
        <div className="rounded-xl p-4 mt-3 border border-gold bg-gradient-to-r from-sec/30 to-sec2/30">
          <p className="text-offwhite font-semibold text-sm mb-1">{t("profile.verifyTitle")}</p>
          <p className="text-muted text-xs mb-3">{t("profile.verifyText")}</p>
          <button
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new Event("vetoks:verify-phone"));
            }}
            className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
          >
            {t("profile.verifyBtn")}
          </button>
        </div>
      )}

      {needBirth && (
        <div className="rounded-xl p-4 mt-3 border border-gold bg-gradient-to-r from-sec/30 to-sec2/30">
          <p className="text-offwhite font-semibold text-sm mb-1">Укажите дату рождения</p>
          <p className="text-muted text-xs mb-3">По дате мы определим вашу возрастную категорию. Указать можно один раз.</p>
          <button
            onClick={() => {
              setMenuOpen(false);
              window.dispatchEvent(new Event("vetoks:ask-birth"));
            }}
            className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
          >
            Указать
          </button>
        </div>
      )}

        {participant ? (
          <div className="bg-bgPrimary border border-gold/40 rounded-2xl p-4 mt-3">
            <p className="text-muted text-[11px] tracking-wide mb-2">{t("profile.balance").toUpperCase()}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="vb-tile bg-bgSurface border border-gold/30 rounded-xl p-2.5 min-w-0">
                <p className="text-muted text-[11px]">Монеты</p>
                <p className="vb-num text-gold font-bold flex items-center gap-1 mt-1"><CoinIcon size={16} />{Math.round(balance).toLocaleString("ru-RU")}</p>
              </div>
              <div className="vb-tile bg-bgSurface border border-muted/50 rounded-xl p-2.5 min-w-0">
                <p className="text-muted text-[11px]">Голоса</p>
                <p className="vb-num text-offwhite font-bold mt-1">{votes.toLocaleString("ru-RU")}</p>
              </div>
              <div className="vb-tile bg-bgSurface border border-gold/30 rounded-xl p-2.5 min-w-0">
                <p className="text-muted text-[11px]">Короны</p>
                <p className="vb-num text-gold font-bold mt-1 flex items-center gap-1"><span>👑</span>{(Math.round(crowns * 100) / 100).toLocaleString("ru-RU")}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <a href="/balance?open=topup" className="bg-gold text-bgPrimary rounded-xl py-2.5 text-xs font-bold text-center">Пополнить</a>
              <a href="/balance?open=exchange" className="border border-gold/50 text-offwhite rounded-xl py-2.5 text-xs font-semibold text-center">Обменять</a>
              <a href="/balance?open=withdraw" className="border border-gold/50 text-offwhite rounded-xl py-2.5 text-xs font-semibold text-center">Вывод</a>
            </div>
            {goalText && goalEnabled && onR("r_goal") && (
              <a href="/goal-donors" className="block border-t border-muted/40 mt-3 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-offwhite text-xs font-semibold">🎯 Цель недели · {goalText}</p>
                  <span className="text-muted text-xs">{Math.round(goalPct)}%</span>
                </div>
                <div className="w-full bg-black/30 rounded-full h-2 mt-2 mb-1">
                  <div className="bg-gold rounded-full h-2" style={{ width: `${goalPct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted text-xs">
                    Собрано {Math.round(goalCollected)} / {goalTarget}
                  </p>
                  <span className="text-gold text-xs">Кто донатил ▾</span>
                </div>
              </a>
            )}
          </div>
        ) : (
          <div className="bg-bgPrimary border border-gold/40 rounded-2xl p-4 mt-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-muted text-[11px] tracking-wide">МОНЕТЫ</p>
                <p className="text-gold text-2xl font-bold flex items-center gap-2 mt-1 whitespace-nowrap"><CoinIcon size={26} />{Math.round(balance).toLocaleString("ru-RU")}</p>
              </div>
              <a href="/balance?open=topup" className="bg-gold text-bgPrimary rounded-xl px-4 py-2.5 text-xs font-bold whitespace-nowrap">Пополнить</a>
            </div>
            <a href="/balance" className="inline-flex items-center gap-1.5 bg-bgSurface border border-muted/50 rounded-full px-3 py-1 text-xs text-offwhite mt-3">
              🗳 Голоса <b>{votes}</b>
            </a>
          </div>
        )}

        {participant && (
          <>
            {onR("r_ideas") && <a href="/content-ideas" className="block bg-gradient-to-r from-sec to-sec2 rounded-xl p-4 mt-3">
              <span className="text-white font-semibold text-sm">{t("profile.ideas")}</span>
            </a>}
            {onR("r_materials") && <a href="/media-materials" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
              <span className="text-gold font-semibold text-sm">{t("profile.materials")}</span>
            </a>}
            {onR("r_tasks") && <a href="/tasks" className="block bg-gradient-to-r from-sec to-sec2 rounded-xl p-4 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold text-sm">{t("profile.tasks")}</span>
                <span className="text-white text-sm">
                  {tasksDone} / {TOTAL_TASKS}
                </span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <div className="bg-white rounded-full h-2" style={{ width: `${Math.min(100, (tasksDone / TOTAL_TASKS) * 100)}%` }} />
              </div>
            </a>}
          </>
        )}

        {onR("r_clan") && <a href="/region-clan" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
          <span className="text-offwhite font-semibold text-sm">{t("profile.clan")}</span>
        </a>}

        <div className="mt-4">
          {onR("r_invites") && <Row href="/invites" label={t("profile.invites")} right={`${referralCount} →`} />}
          {participant && onR("r_blackmarks") && <Row href="/black-marks" label={t("profile.blackMarks")} />}
          <Row href="/edit-profile" label={t("profile.edit")} />
          {(participant || isPartner) && onR("r_docs") && <Row href="/documents" label={t("profile.docs")} />}
          <Row href="/settings" label={t("profile.settings")} />
          <Row href="/support" label={t("profile.support")} />
        </div>

        {!onR("r_partner") ? null : isPartner ? (
          <a href="/partner-cabinet" className="block bg-gradient-to-r from-sec to-sec2 rounded-xl p-4 mt-5 text-center">
            <span className="text-white font-semibold text-sm">{t("profile.partnerCabinet")}</span>
          </a>
        ) : (
          <a href="/ad-space" className="block bg-gradient-to-r from-sec to-sec2 rounded-xl p-4 mt-5 text-center">
            <span className="text-white font-semibold text-sm">{t("profile.becomePartner")}</span>
          </a>
        )}

        <button
          onClick={installAndroid}
          className="w-full flex items-center justify-center gap-2 bg-gold text-bgPrimary font-semibold rounded-xl py-3 mt-3 text-sm"
        >
          {t("profile.install")}
        </button>

        <div className="mt-4">
          <SocialLinksBar />
        </div>

        <button
          onClick={handleLogout}
          className="w-full border border-danger text-danger font-semibold py-3 rounded-full text-sm mt-6"
        >
          {t("profile.logout")}
        </button>
      </Drawer>

      <BottomNav />
    </main>
  );
}
