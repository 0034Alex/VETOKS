"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
};

const PROFILE_TASK_REWARD = 100;

export default function TasksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [profileTaskDone, setProfileTaskDone] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/tasks");
        return;
      }

      const { data: p } = await supabase
        .from("participants")
        .select("id, display_name, bio, photo_url")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!p) {
        setIsParticipant(false);
        setLoading(false);
        return;
      }

      setIsParticipant(true);
      setParticipant(p as Participant);

      let { data: wallet } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet } = await supabase
          .from("wallets")
          .insert({ user_id: u.id })
          .select("id, balance")
          .single();
        wallet = newWallet;
      }

      if (wallet) {
        setWalletId(wallet.id);
        setBalance(Number(wallet.balance));

        const { data: existingReward } = await supabase
          .from("wallet_transactions")
          .select("id")
          .eq("wallet_id", wallet.id)
          .eq("type", "task_reward")
          .eq("metadata->>task", "profile_complete")
          .maybeSingle();

        setProfileTaskDone(!!existingReward);
      }

      setLoading(false);
    })();
  }, [router]);

  const profileComplete = !!(participant?.bio && participant?.photo_url);

  async function claimProfileTask() {
    if (!walletId || !profileComplete || profileTaskDone) return;
    setClaiming(true);

    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "task_reward",
      amount: PROFILE_TASK_REWARD,
      metadata: { task: "profile_complete" },
    });

    await supabase
      .from("wallets")
      .update({ balance: balance + PROFILE_TASK_REWARD })
      .eq("id", walletId);

    setBalance((b) => b + PROFILE_TASK_REWARD);
    setProfileTaskDone(true);
    setClaiming(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!isParticipant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-semibold text-gold mb-4">Задания</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса. Подайте анкету на
          главной странице, чтобы получить доступ.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between px-6 py-4">
          <Logo size={28} />
        </div>

        <div className="px-6 mb-6">
          <h1 className="text-2xl font-semibold text-offwhite mb-4">
            Задания
          </h1>
          <div className="bg-bgSurface border border-gold/40 rounded-xl p-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted text-xs mb-1">Ваш баланс</p>
              <p className="text-gold text-2xl font-semibold truncate">
                {Math.round(balance)} ₽
              </p>
            </div>
            <span className="text-3xl flex-shrink-0">🏆</span>
          </div>
          <p className="text-muted text-xs mt-2">
            Вывод пока недоступен — баланс копится и будет доступен к выводу
            после подключения выплат.
          </p>
        </div>

        <div className="px-6 flex flex-col gap-3">
          <div className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-offwhite font-semibold text-sm">
                Заполните профиль полностью
              </p>
              <p className="text-muted text-xs">
                Добавьте фото и описание о себе в анкете
              </p>
              <p className="text-gold text-xs mt-1">
                +{PROFILE_TASK_REWARD} ₽
              </p>
            </div>
            {profileTaskDone ? (
              <span className="text-success text-xs font-semibold whitespace-nowrap flex-shrink-0">
                Выполнено
              </span>
            ) : (
              <button
                onClick={claimProfileTask}
                disabled={!profileComplete || claiming}
                className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold px-3 py-2 rounded-full text-xs disabled:opacity-40 whitespace-nowrap flex-shrink-0"
              >
                {profileComplete ? "Забрать" : "Не готово"}
              </button>
            )}
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4 opacity-60">
            <p className="text-offwhite font-semibold text-sm">
              Пригласи подругу
            </p>
            <p className="text-muted text-xs">
              Скоро — начисление за приглашённых по вашей ссылке
            </p>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4 opacity-60">
            <p className="text-offwhite font-semibold text-sm">
              Выложи ролик в соцсети
            </p>
            <p className="text-muted text-xs">
              Скоро — начисление за контент, когда заработает раздел «Медиа»
            </p>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
