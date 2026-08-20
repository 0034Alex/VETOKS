"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, signOutUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PageHeader from "@/components/PageHeader";

type Participant = { id: string; display_name: string };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [giftCount, setGiftCount] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [balance, setBalance] = useState(0);
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
      }

      const { count: referrals } = await supabase
        .from("referral_events")
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", u.id);
      setReferralCount(referrals ?? 0);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
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
        <PageHeader />

        <div className="px-6">
          <div className="bg-bgSurface border border-muted rounded-xl p-5 mb-4">
            <h1 className="text-xl text-offwhite font-semibold mb-1">
              {user?.first_name}
              {participant && (
                <span className="ml-2 text-xs bg-gold text-bgPrimary px-2 py-0.5 rounded-full align-middle">
                  Участница
                </span>
              )}
            </h1>
            <p className="text-muted text-sm">{user?.phone}</p>
            <p className="text-muted text-sm">{user?.email}</p>
            <p className="text-muted text-sm">
              Регион: {user?.regions?.name ?? "—"}
            </p>
            <p className="text-muted text-xs mt-2">
              ID: {user?.referral_code}
            </p>
          </div>

          <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-muted text-xs">Баланс</p>
              <p className="text-gold text-xl font-semibold">{balance} ₽</p>
            </div>
            <span className="text-muted text-xs max-w-[140px] text-right">
              Пополнение появится вместе с платёжной системой
            </span>
          </div>

          {participant && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bgSurface border border-muted rounded-xl p-4">
                <p className="text-gold text-lg font-semibold">
                  {voteCount}
                </p>
                <p className="text-muted text-xs">Голосов набрано</p>
              </div>
              <div className="bg-bgSurface border border-muted rounded-xl p-4">
                <p className="text-gold text-lg font-semibold">
                  {giftCount}
                </p>
                <p className="text-muted text-xs">Подарков получено</p>
              </div>
            </div>
          )}

          {participant && (
            <a
              href="/messages"
              className="block bg-bgSurface border border-gold/40 rounded-xl p-4 mb-4"
            >
              <span className="text-gold font-semibold text-sm">
                ✉️ Сообщения от зрителей
              </span>
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
            <div className="p-4 flex items-center justify-between text-muted text-sm">
              <span>История операций</span>
              <span>→</span>
            </div>
            <div className="p-4 flex items-center justify-between text-muted text-sm">
              <span>Настройки</span>
              <span>→</span>
            </div>
            <div className="p-4 flex items-center justify-between text-muted text-sm">
              <span>Помощь и поддержка</span>
              <span>→</span>
            </div>
          </div>

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
