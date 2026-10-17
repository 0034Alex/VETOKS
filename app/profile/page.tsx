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
import ProfileHero, { TopBtn, Drawer, IconMail, IconBell, IconMenu, IconSend, shareLink, KpiCrown, KpiHeart, KpiGift } from "@/components/ProfileHero";
import ProfileTabs from "@/components/ProfileTabs";
import { parseLinks } from "@/lib/socialLinks";
import { statusFor } from "@/lib/status";
import { loadTitleBadges, TitleBadge } from "@/lib/profileExtras";
import AccountSwitcher from "@/components/AccountSwitcher";
import { getCurrencySymbol } from "@/lib/currency";
import { useT } from "@/lib/i18n";
import { apiPost } from "@/lib/authClient";
import { chatGiftEmoji } from "@/lib/chatGifts";

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
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [chatGifts, setChatGifts] = useState<{ name: string; qty: number }[]>([]);
  const [goalText, setGoalText] = useState("");
  const [goalTarget, setGoalTarget] = useState(5000);
  const [goalCollected, setGoalCollected] = useState(0);
  const [goalEnabled, setGoalEnabled] = useState(true);
  const [showPrivate, setShowPrivate] = useState(false);
  const [tasksDone, setTasksDone] = useState(0);
  const [currencySymbol, setCurrencySymbol] = useState("₴");
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
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [ownPosts, setOwnPosts] = useState(0);
  const [rank, setRank] = useState<number | null>(null);
  const [videos, setVideos] = useState<Post[]>([]);
  const [photos, setPhotos] = useState<Post[]>([]);
  const [feedTab, setFeedTab] = useState<"video" | "photo">("video");
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
    apiPost("/api/dm/gifts-received").then((r) => {
      if (r?.ok) setChatGifts(r.items);
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

      const { count: referrals } = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", u.id);
      setReferralCount(referrals ?? 0);

      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id)
        .eq("is_read", false);
      setUnreadCount(unread ?? 0);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", u.id)
        .maybeSingle();
      setBalance(wallet ? Number(wallet.balance) : 0);

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
          .select("contest, stage_key, crown")
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
        const { data: all } = await supabase.from("participants").select("id").eq("is_eliminated", false);
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


  const menuBadge = user && !user.phone_verified && !phoneDone ? 1 : 0;
  const initialsName = user?.first_name || nick || "";
  const st = participant ? statusFor(statusRaw?.contest, statusRaw?.stage_key, statusRaw?.crown, user?.regions?.name ?? null) : null;
  const goalPct = Math.min(100, goalTarget ? (goalCollected / goalTarget) * 100 : 0);

  const Row = ({ href, label, right }: { href: string; label: string; right?: string }) => (
    <a href={href} className="flex items-center justify-between py-3.5 border-b border-muted/40 text-offwhite text-sm">
      <span>{label}</span>
      <span className="text-muted text-[13px]">{right ?? "→"}</span>
    </a>
  );

  const feed = feedTab === "video" ? videos : photos;

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
          {chatGifts.length > 0 && (
            <div className="bg-bgSurface border border-muted rounded-xl px-4 py-3 mt-5">
              <p className="text-muted text-xs mb-1">Подарки вам в чатах</p>
              <p className="text-offwhite text-sm flex flex-wrap gap-x-3 gap-y-1">
                {chatGifts.map((g) => (
                  <span key={g.name}>
                    {chatGiftEmoji(g.name)} {g.name} ×{g.qty}
                  </span>
                ))}
              </p>
            </div>
          )}

          <Link href="/add-video" className="block text-center text-gold text-sm mt-5">
            ＋ Добавить видео или фото
          </Link>
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
        <div className="rounded-xl p-4 mt-3 border border-gold bg-gradient-to-r from-[#7C3AED]/30 to-[#EC4899]/30">
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

        {participant && (
          <Link href="/balance" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-xs">{t("profile.balance")}</p>
                <p className="text-gold text-xl font-semibold">
                  {Math.round(balance)} {currencySymbol}
                </p>
              </div>
              <span className="text-gold text-xs">Пополнить · Вывод →</span>
            </div>
          </Link>
        )}

        {participant && goalText && goalEnabled && (
          <a href="/goal-donors" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
            <p className="text-offwhite text-sm font-semibold mb-1">🎯 Цель недели</p>
            <p className="text-muted text-xs mb-3">{goalText}</p>
            <div className="w-full bg-black/30 rounded-full h-2 mb-1">
              <div className="bg-gold rounded-full h-2" style={{ width: `${goalPct}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted text-xs">
                Собрано {Math.round(goalCollected)} / {goalTarget} {currencySymbol}
              </p>
              <span className="text-gold text-xs">Кто донатил ▾</span>
            </div>
          </a>
        )}

        {participant && (
          <>
            <a href="/content-ideas" className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mt-3">
              <span className="text-white font-semibold text-sm">{t("profile.ideas")}</span>
            </a>
            <a href="/media-materials" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
              <span className="text-gold font-semibold text-sm">{t("profile.materials")}</span>
            </a>
            <a href="/tasks" className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold text-sm">{t("profile.tasks")}</span>
                <span className="text-white text-sm">
                  {tasksDone} / {TOTAL_TASKS}
                </span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <div className="bg-white rounded-full h-2" style={{ width: `${Math.min(100, (tasksDone / TOTAL_TASKS) * 100)}%` }} />
              </div>
            </a>
          </>
        )}

        <a href="/region-clan" className="block bg-bgPrimary border border-gold/40 rounded-xl p-4 mt-3">
          <span className="text-offwhite font-semibold text-sm">{t("profile.clan")}</span>
        </a>

        <div className="mt-4">
          <Row href="/invites" label={t("profile.invites")} right={`${referralCount} →`} />
          {participant && <Row href="/black-marks" label={t("profile.blackMarks")} />}
          <Row href="/edit-profile" label={t("profile.edit")} />
          {(participant || isPartner) && <Row href="/documents" label={t("profile.docs")} />}
          {(participant || isPartner) && <Row href="/ad-space" label={t("profile.ads")} />}
          {!participant && <Row href="/balance" label={t("profile.balance")} />}
          <Row href="/settings" label={t("profile.settings")} />
          <Row href="/support" label={t("profile.support")} />
        </div>

        {isPartner ? (
          <a href="/partner-cabinet" className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mt-5 text-center">
            <span className="text-white font-semibold text-sm">{t("profile.partnerCabinet")}</span>
          </a>
        ) : (
          <a href="/partner" className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mt-5 text-center">
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
