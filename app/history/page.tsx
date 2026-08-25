"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Tx = {
  id: string;
  type: string;
  amount: number;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  topup: "Пополнение",
  gift_sent: "Подарок отправлен",
  gift_received: "Подарок получен",
  vote_purchase: "Сообщение / голос",
  task_reward: "Награда за задание",
  boost_purchase: "Буст в топ",
  refund: "Возврат",
};

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/history");
        return;
      }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (wallet) {
        const { data } = await supabase
          .from("wallet_transactions")
          .select("id, type, amount, created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(100);
        setItems((data as Tx[]) ?? []);
      }

      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        История операций
      </h1>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p className="text-muted text-center px-6">Операций пока нет.</p>
      )}

      <div className="px-6 flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between bg-bgSurface border border-muted rounded-lg px-4 py-3"
          >
            <div>
              <p className="text-offwhite text-sm">
                {TYPE_LABELS[t.type] ?? t.type}
              </p>
              <p className="text-muted text-xs">
                {new Date(t.created_at).toLocaleString("ru-RU")}
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${
                Number(t.amount) >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {Number(t.amount) >= 0 ? "+" : ""}
              {t.amount} ₽
            </span>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
