"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, signOutUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

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
  const [goalDonors, setGoalDonors] = useState<
    { name: string; amount: number; created_at: string }[]
  >([]);
  const [showPrivate, setShowPrivate] = useState(false);
  const [giftEarnings, setGiftEarnings] = useState(0);
  const [taskEarnings, setTaskEarnings] = useState(0);
  const [tasksDone, setTasksDone] = useState(0);
  const TOTAL_TASKS = 3;
  const [loading, setLoading] = useState(true);

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

        // Цель недели — та же логика, что на публичной странице.
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
          .select("amount, user_id, created_at")
          .eq("participant_id", (p as Participant).id)
          .eq("week_start", weekStartStr)
          .order("created_at", { ascending: false });
        setGoalCollected(
          (contribData ?? []).reduce(
            (sum: number, c: { amount: number }) => sum + Number(c.amount),
            0
          )
        );
        if (contribData && contribData.length > 0) {
          const donorIds = [...new Set(contribData.map((c: { user_id: string }) => c.user_id))];
          const { data: donorUsers } = await supabase
            .from("users")
            .select("id, first_name")
            .in("id", donorIds);
          const nameMap: Record<string, string> = {};
          (donorUsers ?? []).forEach((du: { id: string; first_name: string }) => {
            nameMap[du.id] = du.first_name ?? "Гость";
          });
          setGoalDonors(
            contribData.map((c: { user_id: string; amount: number; created_at: string }) => ({
              name: nameMap[c.user_id] ?? "Гость",
              amount: Number(c.amount),
              created_at: c.created_at,
            }))
          );
        }
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

      if (wallet) {
        const { data: txs } = await supabase
          .from("wallet_transactions")
          .select("type, amount")
          .eq("wallet_id", wallet.id)
          .gt("amount", 0);

        let gifts = 0;
        let tasks = 0;
        (txs ?? []).forEach((t: { type: string; amount: number }) => {
          if (t.type === "gift_received") gifts += Number(t.amount);
          if (t.type === "task_reward") tasks += Number(t.amount);
        });
        setGiftEarnings(gifts);
        setTaskEarnings(tasks);
      }

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
          <Link href="/notifications" className="relative text-xl">
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
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
                Собрано {Math.round(goalCollected)} / {goalTarget} ₽
              </p>
              {goalDonors.length > 0 ? (
                <div className="border-t border-muted pt-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
                  <p className="text-muted text-xs">Кто донатил на этой неделе:</p>
                  {goalDonors.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-offwhite">{d.name}</span>
                      <span className="text-gold">{Math.round(d.amount)} ₽</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-xs">Пока никто не задонатил.</p>
              )}
            </div>
          )}

          {participant && (
            <a
              href="/messages"
              className="flex items-center justify-between bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                ✉️ Сообщения от зрителей
              </span>
              {unreadMessages > 0 && (
                <span className="bg-danger text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </a>
          )}

          {participant && (
            <a
              href="/my-application"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                📝 Моя анкета (редактировать)
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/add-video"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                🎬 Добавить видео
              </span>
            </a>
          )}

          {participant && (
            <a
              href="/my-cards"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                🃏 Мои карточки
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
              href="/history"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>История операций</span>
              <span>→</span>
            </a>
            <a
              href="/how-it-works"
              className="p-4 flex items-center justify-between text-muted text-sm"
            >
              <span>Как это работает</span>
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

          <a
            href="/partner"
            className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-6 text-center"
          >
            <span className="text-white font-semibold text-sm">
              🤝 Стать партнёром
            </span>
          </a>

          <button
            onClick={handleLogout}
            className="w-full border border-danger text-danger font-semibold py-3 rounded-full text-sm"
          >
            Выйти
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
