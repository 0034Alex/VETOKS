"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { getCurrencySymbol } from "@/lib/currency";
import { apiPost } from "@/lib/authClient";
import { getMyCountry } from "@/lib/myCountry";

type Participant = {
  id: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  region_id: string | null;
};

type CustomTask = {
  id: string;
  title: string;
  description: string;
  reward: number;
  deadline: string | null;
  region_id: string | null;
  country_id?: string | null;
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
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [completions, setCompletions] = useState<Record<string, string>>({});
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState("\uE000");

  useEffect(() => {
    (async () => {
      setCurrencySymbol(await getCurrencySymbol());

      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/tasks");
        return;
      }

      const { data: p } = await supabase
        .from("participants")
        .select("id, display_name, bio, photo_url, region_id")
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
        .select("id, balance, withdrawable_balance")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!wallet) {
        const ens = await apiPost("/api/wallet/ensure", {});
        wallet = ens?.wallet ?? null;
      }

      if (wallet) {
        setWalletId(wallet.id);
        setBalance(Number((wallet as any).withdrawable_balance ?? 0));

        const { data: existingReward } = await supabase
          .from("wallet_transactions")
          .select("id")
          .eq("wallet_id", wallet.id)
          .eq("type", "task_reward")
          .eq("metadata->>task", "profile_complete")
          .maybeSingle();

        setProfileTaskDone(!!existingReward);
      }

      const { data: tasksData } = await supabase
        .from("custom_tasks")
        .select("id, title, description, reward, deadline, region_id, country_id")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const myC = await getMyCountry();
      setCustomTasks(
        ((tasksData as CustomTask[]) ?? []).filter((t) =>
          t.region_id
            ? t.region_id === p.region_id
            : !t.country_id || !myC.countryId || t.country_id === myC.countryId
        )
      );

      const { data: completionsData } = await supabase
        .from("task_completions")
        .select("task_id, status")
        .eq("participant_id", p.id);
      const map: Record<string, string> = {};
      (completionsData ?? []).forEach((c: { task_id: string; status: string }) => {
        map[c.task_id] = c.status;
      });
      setCompletions(map);

      setLoading(false);
    })();
  }, [router]);

  const profileComplete = !!(participant?.bio && participant?.photo_url);

  async function claimProfileTask() {
    if (!walletId || !profileComplete || profileTaskDone) return;
    setClaiming(true);

    const r = await apiPost("/api/tasks/claim-profile", {});
    if (!r?.ok) {
      setClaiming(false);
      if (r?.error === "already_done") setProfileTaskDone(true);
      return;
    }

    setBalance((b) => b + PROFILE_TASK_REWARD);
    setProfileTaskDone(true);
    setClaiming(false);
  }

  async function submitTaskCompletion(taskId: string) {
    if (!participant) return;
    setSubmittingTaskId(taskId);
    const r = await apiPost("/api/tasks/submit", { taskId });
    if (r?.ok || r?.error === "already_sent") {
      setCompletions((prev) => ({ ...prev, [taskId]: "pending" }));
    }
    setSubmittingTaskId(null);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (!isParticipant) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
          <h1 className="text-2xl font-semibold text-gold mb-4">Задания</h1>
          <p className="text-muted max-w-sm">
            Этот раздел доступен только участницам конкурса. Подайте анкету на
            главной странице, чтобы получить доступ.
          </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-2xl mx-auto">

        <div className="px-6 mb-6">
          <h1 className="text-2xl font-semibold text-offwhite mb-4">
            Задания
          </h1>
          <div className="bg-bgSurface border border-gold/40 rounded-xl p-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-muted text-xs mb-1">Ваши Короны</p>
              <p className="text-gold text-2xl font-semibold truncate">
                👑 {Math.round(balance * 100) / 100}
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
                +{PROFILE_TASK_REWARD} 👑
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

          {customTasks.map((task) => {
            const status = completions[task.id];
            const expired = task.deadline && new Date(task.deadline) < new Date();
            return (
              <div
                key={task.id}
                className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p data-tr className="text-offwhite font-semibold text-sm">{task.title}</p>
                  <p data-tr className="text-muted text-xs">{task.description}</p>
                  <p className="text-gold text-xs mt-1">
                    +{Math.round(task.reward)} 👑
                    {task.deadline && (
                      <span className="text-muted">
                        {" "}
                        · до {new Date(task.deadline).toLocaleDateString("ru-RU")}
                      </span>
                    )}
                  </p>
                </div>
                {status === "approved" ? (
                  <span className="text-success text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    Выполнено
                  </span>
                ) : status === "pending" ? (
                  <span className="text-muted text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    На проверке
                  </span>
                ) : status === "rejected" ? (
                  <span className="text-danger text-xs font-semibold whitespace-nowrap flex-shrink-0">
                    Отклонено
                  </span>
                ) : (
                  <button
                    onClick={() => submitTaskCompletion(task.id)}
                    disabled={!!expired || submittingTaskId === task.id}
                    className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold px-3 py-2 rounded-full text-xs disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                  >
                    {expired ? "Срок истёк" : "Выполнила"}
                  </button>
                )}
              </div>
            );
          })}

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
