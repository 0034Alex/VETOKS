"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { getCurrencySymbol } from "@/lib/currency";
import TopUpSheet from "@/components/TopUpSheet";
import ExchangeSheet from "@/components/ExchangeSheet";
import CoinIcon from "@/components/CoinIcon";

// Текст окна «Вывод». Когда будет готова политика — вписать сюда номер пункта и раздела.
const WITHDRAW_INFO =
  "Вывод Корон доступен после окончания сезона — в порядке, который описан в правилах конкурса и политике платформы (раздел и пункт будут указаны здесь).";

type Tx = { id: string; type: string; amount: number; created_at: string; metadata?: { cur?: string } | null };

const TYPE_LABELS: Record<string, string> = {
  topup: "Пополнение",
  gift_sent: "Подарок отправлен",
  gift_received: "Подарок получен",
  vote_purchase: "Покупка голосов",
  task_reward: "Награда за задание",
  boost_purchase: "Буст в топ",
  refund: "Возврат",
  referral_reward: "Награда за приглашение",
  referral_commission: "Процент от покупок друга",
  advertiser_bonus: "Бонус за приведённого рекламодателя",
  exchange: "Обмен Корон на монеты",
};

export default function BalancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [money, setMoney] = useState(0);
  const [crowns, setCrowns] = useState(0);
  const [coinsPerCrown, setCoinsPerCrown] = useState(1);
  const [exchangeOn, setExchangeOn] = useState(true);
  const [topOpen, setTopOpen] = useState(false);
  const [exOpen, setExOpen] = useState(false);
  const [votes, setVotes] = useState(0);
  const [freeLeft, setFreeLeft] = useState(0);
  const [items, setItems] = useState<Tx[]>([]);
  const [symbol, setSymbol] = useState("\uE000");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  async function reload() {
    const info = await apiPost("/api/wallet/info");
    if (info?.ok) {
      setMoney(Number(info.coins));
      setCrowns(Number(info.crowns));
      setCoinsPerCrown(Number(info.coinsPerCrown) || 1);
      setExchangeOn(info.exchangeOn !== false);
    }
    const u = await getCurrentUser();
    if (!u) return;
    const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", u.id).maybeSingle();
    if (wallet) {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount, created_at, metadata")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data as Tx[]) ?? []);
    }
    const { data: cr } = await supabase.from("vote_credits").select("balance").eq("user_id", u.id).maybeSingle();
    setVotes(cr?.balance ?? 0);
  }

  useEffect(() => {
    (async () => {
      setSymbol(await getCurrencySymbol());
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/balance");
        return;
      }

      const { data: p } = await supabase.from("participants").select("id").eq("user_id", u.id).maybeSingle();
      setIsParticipant(!!p);

      const { data: credits } = await supabase.from("vote_credits").select("balance").eq("user_id", u.id).maybeSingle();
      setVotes(credits?.balance ?? 0);

      const info = await apiPost("/api/shop/vote-info");
      if (info?.ok) setFreeLeft(Number(info.free_left) || 0);

      await reload();
      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-5 px-6">Баланс</h1>

      {loading ? (
        <LoadingScreen inline />
      ) : (
        <>
          <div className="px-6 flex flex-col gap-3">
            <div className="bg-bgSurface border border-gold/40 rounded-2xl p-5">
              <p className="text-muted text-xs">Монеты</p>
              <p className="text-gold text-3xl font-semibold mt-1 flex items-center gap-2">
                <CoinIcon size={30} />
                {Math.round(money)}
              </p>
            </div>

            <div className="bg-bgSurface border border-muted/50 rounded-2xl p-5">
              <p className="text-muted text-xs">Ваши голоса</p>
              <p className="text-offwhite text-xl font-semibold mt-1">{votes}</p>
              {freeLeft > 0 && <p className="text-muted text-xs mt-2">Бесплатных голосов осталось: {freeLeft}</p>}
            </div>

            {isParticipant && (
              <div className="bg-bgSurface border border-gold/40 rounded-2xl p-5">
                <p className="text-muted text-xs">Короны (на вывод)</p>
                <p className="text-gold text-3xl font-semibold mt-1">👑 {Math.round(crowns * 100) / 100}</p>
                {exchangeOn && crowns > 0 && (
                  <button type="button" onClick={() => setExOpen(true)} className="text-offwhite text-xs underline mt-2">
                    Обменять на монеты
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTopOpen(true)}
                className="flex-1 h-12 rounded-xl bg-gold text-bgPrimary font-semibold text-sm"
              >
                Пополнить
              </button>
              {isParticipant && (
                <button
                  type="button"
                  onClick={() => setWithdrawOpen(true)}
                  className="flex-1 h-12 rounded-xl border border-gold/60 text-gold font-semibold text-sm"
                >
                  Вывод
                </button>
              )}
            </div>
          </div>

          <h2 className="text-offwhite font-semibold px-6 mt-8 mb-3">История</h2>
          {items.length === 0 && <p className="text-muted text-sm text-center px-6">Операций пока нет.</p>}
          <div className="px-6 flex flex-col gap-2">
            {items.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between bg-bgSurface border border-muted/50 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-offwhite text-sm">{TYPE_LABELS[t.type] ?? t.type}</p>
                  <p className="text-muted text-xs mt-0.5">{new Date(t.created_at).toLocaleString("ru-RU")}</p>
                </div>
                <span className={`text-sm font-semibold ${Number(t.amount) >= 0 ? "text-success" : "text-danger"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}
                  {Math.round(Number(t.amount) * 100) / 100} {t.metadata?.cur === "crown" ? "👑" : symbol}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-[70] bg-black/65 flex items-end justify-center" onClick={() => setWithdrawOpen(false)}>
          <div
            className="w-full max-w-md bg-bgSurface rounded-t-2xl p-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-offwhite font-semibold mb-3">Вывод средств</p>
            <p className="text-muted text-sm leading-relaxed mb-5">{WITHDRAW_INFO}</p>
            <button
              type="button"
              onClick={() => setWithdrawOpen(false)}
              className="w-full h-12 rounded-xl bg-gold text-bgPrimary font-semibold text-sm"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      <TopUpSheet open={topOpen} onClose={() => setTopOpen(false)} onDone={() => reload()} />
      <ExchangeSheet open={exOpen} onClose={() => setExOpen(false)} crowns={crowns} coinsPerCrown={coinsPerCrown} onDone={() => reload()} />
      <BottomNav />
    </main>
  );
}
