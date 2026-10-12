"use client";

import { getVoteTotals } from "@/lib/voteTotals";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, signOutUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import SocialLinksBar from "@/components/SocialLinksBar";
import { getCurrencySymbol } from "@/lib/currency";
import { useT } from "@/lib/i18n";

type Participant = { id: string; display_name: string };

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

  useEffect(() => {
    const done = () => setPhoneDone(true);
    window.addEventListener("vetoks:verified", done);
    return () => window.removeEventListener("vetoks:verified", done);
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

  async function handleLogout() {
    await signOutUser();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto">
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
        >
          <Logo size={28} />
          <div className="flex items-center gap-4">
            {participant && (
              <Link href="/add-video" className="text-2xl leading-none text-gold">
                +
              </Link>
            )}
            {participant && (
              <Link href="/messages" className="relative text-xl">
                ✉️
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Link>
            )}
            <Link href="/notifications" className="relative text-xl">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="px-6">
          {user && !user.phone_verified && !phoneDone && (
            <div className="rounded-xl p-4 mb-4 border border-gold bg-gradient-to-r from-[#7C3AED]/30 to-[#EC4899]/30">
              <p className="text-offwhite font-semibold text-sm mb-1">{t("profile.verifyTitle")}</p>
              <p className="text-muted text-xs mb-3">
                {t("profile.verifyText")}
              </p>
              <button
                onClick={() => window.dispatchEvent(new Event("vetoks:verify-phone"))}
                className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
              >
                {t("profile.verifyBtn")}
              </button>
            </div>
          )}

          <div className="bg-bgSurface border border-muted rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl text-offwhite font-semibold">
                {user?.first_name}
                {participant && (
                  <span className="ml-2 text-xs bg-gold text-bgPrimary px-2 py-0.5 rounded-full align-middle">
                    {t("profile.participant")}
                  </span>
                )}
              </h1>
              <button
                onClick={() => setShowPrivate((v) => !v)}
                className="text-muted text-xs whitespace-nowrap"
              >
                {showPrivate ? t("profile.hideData") : t("profile.showData")}
              </button>
            </div>
            <p className="text-muted text-sm">
              {showPrivate ? user?.phone : maskPhone(user?.phone)}
            </p>
            <p className="text-muted text-sm">
              {showPrivate ? user?.email : maskEmail(user?.email)}
            </p>
            <p className="text-muted text-sm">
              {t("profile.region")} {user?.regions?.name ?? "—"}
            </p>
            <p className="text-muted text-xs mt-2">
              ID: {user?.referral_code}
            </p>
          </div>

          <Link
            href="/history"
            className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-xs">{t("profile.balance")}</p>
                <p className="text-gold text-xl font-semibold">{Math.round(balance)} {currencySymbol}</p>
              </div>
              <span className="text-gold text-xs">{t("profile.more")}</span>
            </div>
          </Link>

          {!participant && (
            <Link
              href="/region-clan"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-offwhite font-semibold text-sm">
                {t("profile.clan")}
              </span>
            </Link>
          )}

          {participant && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bgSurface border border-muted rounded-xl p-4">
                <p className="text-gold text-lg font-semibold">
                  {voteCount}
                </p>
                <p className="text-muted text-xs">{t("profile.votes")}</p>
              </div>
              <Link
                href={`/participant/${participant.id}/gifts`}
                className="bg-bgSurface border border-muted rounded-xl p-4"
              >
                <p className="text-gold text-lg font-semibold">
                  {giftCount}
                </p>
                <p className="text-muted text-xs">{t("profile.gifts")}</p>
              </Link>
            </div>
          )}

          {participant && goalText && goalEnabled && (
            <a
              href="/goal-donors"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
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
              <div className="flex items-center justify-between">
                <p className="text-muted text-xs">
                  Собрано {Math.round(goalCollected)} / {goalTarget} {currencySymbol}
                </p>
                <span className="text-gold text-xs">Кто донатил ▾</span>
              </div>
            </a>
          )}

          {participant && (
            <a
              href="/content-ideas"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-4"
            >
              <span className="text-white font-semibold text-sm">
                {t("profile.ideas")}
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/media-materials"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                {t("profile.materials")}
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/tasks"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold">{t("profile.tasks")}</span>
                <span className="text-white text-sm">
                  {tasksDone} / {TOTAL_TASKS}
                </span>
              </div>
              <div className="w-full bg-black/30 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2"
                  style={{
                    width: `${Math.min(
                      100,
                      (tasksDone / TOTAL_TASKS) * 100
                    )}%`,
                  }}
                />
              </div>
            </a>
          )}

          {participant && (
            <a
              href="/region-clan"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-offwhite font-semibold text-sm">
                {t("profile.clan")}
              </span>
            </a>
          )}

          <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted mb-6">
            <a href="/invites" className="p-4 flex items-center justify-between">
              <span className="text-offwhite text-sm">{t("profile.invites")}</span>
              <span className="text-gold text-sm">{referralCount} →</span>
            </a>
            <a
              href="/my-follows"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>{t("profile.follows")}</span>
              <span>→</span>
            </a>
            {participant && (
              <a
                href="/black-marks"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>{t("profile.blackMarks")}</span>
                <span>→</span>
              </a>
            )}
            <a
              href="/edit-profile"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>{t("profile.edit")}</span>
              <span>→</span>
            </a>
            {(participant || isPartner) && (
              <a
                href="/documents"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>{t("profile.docs")}</span>
                <span>→</span>
              </a>
            )}
            {(participant || isPartner) && (
              <a
                href="/ad-space"
                className="p-4 flex items-center justify-between text-muted text-sm"
              >
                <span>{t("profile.ads")}</span>
                <span>→</span>
              </a>
            )}
            <a
              href="/settings"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>{t("profile.settings")}</span>
              <span>→</span>
            </a>
            <a
              href="/support"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>{t("profile.support")}</span>
              <span>→</span>
            </a>
          </div>

          {isPartner ? (
            <a
              href="/partner-cabinet"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-6 text-center"
            >
              <span className="text-white font-semibold text-sm">
                {t("profile.partnerCabinet")}
              </span>
            </a>
          ) : (
            <a
              href="/partner"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-6 text-center"
            >
              <span className="text-white font-semibold text-sm">
                {t("profile.becomePartner")}
              </span>
            </a>
          )}

          <button
            onClick={installAndroid}
            className="w-full flex items-center justify-center gap-2 bg-gold text-bgPrimary font-semibold rounded-xl py-3 mb-2 text-sm"
          >
            {t("profile.install")}
          </button>

          <SocialLinksBar />

          <button
            onClick={handleLogout}
            className="w-full border border-danger text-danger font-semibold py-3 rounded-full text-sm mt-6"
          >
            {t("profile.logout")}
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
