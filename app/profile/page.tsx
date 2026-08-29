"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, signOutUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import SocialLinksBar from "@/components/SocialLinksBar";

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
  const TOTAL_TASKS = 3;
  const [loading, setLoading] = useState(true);

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
        const { count: votes } = await supabase
          .from("votes")
          .select("id", { count: "exact", head: true })
          .eq("participant_id", (p as Participant).id);
        setVoteCount(votes ?? 0);

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
        .from("referral_events")
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
          <div className="bg-bgSurface border border-muted rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl text-offwhite font-semibold">
                {user?.first_name}
                {participant && (
                  <span className="ml-2 text-xs bg-gold text-bgPrimary px-2 py-0.5 rounded-full align-middle">
                    Участница
                  </span>
                )}
              </h1>
              <button
                onClick={() => setShowPrivate((v) => !v)}
                className="text-muted text-xs whitespace-nowrap"
              >
                {showPrivate ? "🙈 Скрыть" : "👁 Показать данные"}
              </button>
            </div>
            <p className="text-muted text-sm">
              {showPrivate ? user?.phone : maskPhone(user?.phone)}
            </p>
            <p className="text-muted text-sm">
              {showPrivate ? user?.email : maskEmail(user?.email)}
            </p>
            <p className="text-muted text-sm">
              Регион: {user?.regions?.name ?? "—"}
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
                <p className="text-muted text-xs">Баланс</p>
                <p className="text-gold text-xl font-semibold">{Math.round(balance)} ₽</p>
              </div>
              <span className="text-gold text-xs">Подробнее →</span>
            </div>
          </Link>

          {participant && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bgSurface border border-muted rounded-xl p-4">
                <p className="text-gold text-lg font-semibold">
                  {voteCount}
                </p>
                <p className="text-muted text-xs">Голосов набрано</p>
              </div>
              <Link
                href={`/participant/${participant.id}/gifts`}
                className="bg-bgSurface border border-muted rounded-xl p-4"
              >
                <p className="text-gold text-lg font-semibold">
                  {giftCount}
                </p>
                <p className="text-muted text-xs">Подарков получено →</p>
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
                  Собрано {Math.round(goalCollected)} / {goalTarget} ₽
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
                💡 Идеи для контента на сегодня
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/media-materials"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                🎬 Материалы для монтажа
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/tasks"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold">⭐ Задания</span>
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

          <div className="bg-bgSurface border border-muted rounded-xl divide-y divide-muted mb-6">
            <div className="p-4 flex items-center justify-between">
              <span className="text-offwhite text-sm">Мои приглашения</span>
              <span className="text-gold text-sm">{referralCount}</span>
            </div>
            <a
              href="/edit-profile"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>Редактировать профиль</span>
              <span>→</span>
            </a>
            <a
              href="/documents"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>Документы</span>
              <span>→</span>
            </a>
            <a
              href="/ad-space"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>Рекламный кабинет</span>
              <span>→</span>
            </a>
            <div className="p-4 flex items-center justify-between text-muted text-sm">
              <span>Настройки</span>
              <span>→</span>
            </div>
            <a
              href="/support"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>Помощь и поддержка</span>
              <span>→</span>
            </a>
          </div>

          {isPartner ? (
            <a
              href="/partner-cabinet"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-6 text-center"
            >
              <span className="text-white font-semibold text-sm">
                🏢 Кабинет партнёра
              </span>
            </a>
          ) : (
            <a
              href="/partner"
              className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-6 text-center"
            >
              <span className="text-white font-semibold text-sm">
                🤝 Стать партнёром
              </span>
            </a>
          )}

          <div className="flex gap-3 mb-2">
            <a
              href="/install"
              className="flex-1 flex items-center justify-center gap-2 bg-black border border-white/20 rounded-xl py-2.5"
            >
              <svg viewBox="0 0 384 512" width="20" height="20" fill="#fff">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.9c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-92.3zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              <span className="text-white text-xs font-semibold leading-tight text-left">
                Загрузить в
                <br />
                App Store
              </span>
            </a>
            <button
              onClick={installAndroid}
              className="flex-1 flex items-center justify-center gap-2 bg-black border border-white/20 rounded-xl py-2.5"
            >
              <svg viewBox="0 0 512 512" width="20" height="20">
                <path fill="#00D9FF" d="M47 25c-9 5-15 15-15 27v408c0 12 6 22 15 27l231-231z" />
                <path fill="#FFBC00" d="M47 25l231 231-96 96-159-83c-14-8-22-23-22-38V52c0-12 5-22 13-27z" />
                <path fill="#FF3A44" d="M182 352l96-96-231-231c-7 4-12 10-13 17z" />
                <path fill="#00F076" d="M278 256l96 55c17 10 17 34 0 44l-96 55-96-96z" />
              </svg>
              <span className="text-white text-xs font-semibold leading-tight text-left">
                Загрузить в
                <br />
                Google Play
              </span>
            </button>
          </div>

          <SocialLinksBar />

          <button
            onClick={handleLogout}
            className="w-full border border-danger text-danger font-semibold py-3 rounded-full text-sm mt-6"
          >
            Выйти
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
