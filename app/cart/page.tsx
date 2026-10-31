"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import { apiPost } from "@/lib/authClient";
import { money } from "@/lib/businessShared";

const PROBLEM: Record<string, string> = { gone: "Товар больше недоступен", out: "Закончился", less: "Столько нет в наличии" };
const ERR: Record<string, string> = {
  need_phone: "Укажите телефон, чтобы магазин мог связаться.",
  promo_invalid: "Промокод не подходит или закончился.",
  not_found: "Магазин недоступен.",
  own_business: "Нельзя заказывать у самого себя.",
  nothing: "Ничего не удалось оформить: проверьте наличие.",
};

// Корзина: товары из разных магазинов. Можно купить всё сразу или только у одного магазина.
export default function CartPage() {
  const [groups, setGroups] = useState<any[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [phone, setPhone] = useState("");
  const [promos, setPromos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<any[] | null>(null);

  async function load() {
    const r = await apiPost("/api/business/cart", { action: "list" });
    if (r?.error === "auth") {
      window.location.href = "/login?redirect=/cart";
      return;
    }
    setGroups(r?.groups ?? []);
    setUnavailable(!!r?.unavailable);
    try {
      window.dispatchEvent(new Event("vetoks:cart"));
    } catch {}
  }
  useEffect(() => {
    load();
  }, []);

  async function setQty(id: string, qty: number) {
    await apiPost("/api/business/cart", { action: "set", id, qty });
    load();
  }

  async function buy(businessId?: string) {
    setBusy(businessId ?? "all");
    setMsg("");
    const r = await apiPost("/api/business/cart", { action: "checkout", businessId, phone, promos });
    setBusy("");
    if (r?.error === "need_phone") return setMsg(ERR.need_phone);
    if (!r?.ok) return setMsg("Не получилось оформить. Попробуйте ещё раз.");
    setDone(r.results ?? []);
    load();
  }

  const ready = groups?.some((g) => g.lines.some((l: any) => !l.problem)) ?? false;
  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";

  return (
    <main className="min-h-screen pb-32">
      <PageHeader />
      <div className="max-w-md mx-auto px-5">
        <h1 className="text-xl font-semibold text-offwhite mb-4">🛒 Корзина</h1>
        {!groups && <LoadingScreen inline />}
        {unavailable && <p className="text-muted text-sm">Корзина ещё настраивается. Попробуйте позже.</p>}

        {done && (
          <div className="rounded-xl border border-gold bg-gold/10 p-4 mb-4">
            <p className="text-offwhite font-semibold text-sm mb-2">Результат покупки</p>
            {done.map((r) => (
              <p key={r.businessId} className={`text-sm ${r.ok ? "text-offwhite" : "text-danger"}`}>
                {r.name}: {r.ok ? `заказ оформлен · ${money(r.total, r.cur ?? "₴")}${r.skipped ? ` · не вошло: ${r.skipped}` : ""}` : ERR[r.error] ?? "не оформлен"}
              </p>
            ))}
            <Link href="/my-orders" className="block text-center bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm mt-3">Открыть мои заказы</Link>
            <button onClick={() => setDone(null)} className="w-full text-muted text-sm mt-2">Закрыть</button>
          </div>
        )}

        {groups && groups.length === 0 && !unavailable && (
          <div className="text-center py-12">
            <p className="text-muted text-sm mb-4">В корзине пока пусто.</p>
            <Link href="/partners-directory?tab=shops" className="inline-block bg-gold text-bgPrimary font-semibold rounded-full px-6 py-2.5 text-sm">🏪 Магазины платформы</Link>
          </div>
        )}

        {groups?.map((g) => {
          const sum = g.lines.filter((l: any) => !l.problem).reduce((a: number, l: any) => a + l.price * l.qty, 0);
          const can = g.lines.some((l: any) => !l.problem);
          return (
            <div key={g.business_id} className="bg-bgSurface border border-gold/30 rounded-2xl p-3 mb-4">
              <Link href={g.user_id ? `/u/${g.user_id}` : "#"} className="flex items-center gap-2.5 mb-3">
                <span className="w-9 h-9 rounded-full overflow-hidden bg-bgPrimary border border-gold/50 flex items-center justify-center text-gold text-xs font-bold flex-none">
                  {g.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (g.name || "?").slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="text-offwhite font-semibold text-sm truncate">{g.name}</span>
                <span className="text-gold ml-auto">›</span>
              </Link>
              {g.lines.map((l: any) => (
                <div key={l.id} className={`flex gap-3 py-2.5 border-t border-muted/40 ${l.problem ? "opacity-70" : ""}`}>
                  <div className="w-16 h-16 rounded-xl bg-bgPrimary overflow-hidden flex items-center justify-center text-gold font-bold flex-none">
                    {l.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (l.name || "?").slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-offwhite text-sm font-semibold break-words">{l.name}</p>
                    <p className="text-muted text-xs">{[l.size && `Размер ${l.size}`, l.sku && `ID ${l.sku}`].filter(Boolean).join(" · ")}</p>
                    <p className="text-gold text-sm font-semibold">{money(l.price, g.cur)}</p>
                    {l.problem && <p className="text-danger text-xs">{PROBLEM[l.problem]}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => setQty(l.id, l.qty - 1)} className="w-7 h-7 rounded-full border border-muted text-offwhite">−</button>
                      <span className="text-offwhite text-sm w-5 text-center">{l.qty}</span>
                      <button onClick={() => setQty(l.id, l.qty + 1)} className="w-7 h-7 rounded-full border border-muted text-offwhite">+</button>
                      <button onClick={() => setQty(l.id, 0)} className="ml-auto text-danger text-xs">Убрать</button>
                    </div>
                  </div>
                </div>
              ))}
              <input value={promos[g.business_id] ?? ""} onChange={(e) => setPromos({ ...promos, [g.business_id]: e.target.value })} placeholder="Промокод этого магазина (если есть)" maxLength={30} className={input + " uppercase mt-2"} />
              <div className="flex items-center justify-between mt-3">
                <span className="text-muted text-xs">Итого у магазина</span>
                <span className="text-gold font-bold">{money(sum, g.cur)}</span>
              </div>
              <button onClick={() => buy(g.business_id)} disabled={!can || !!busy} className="w-full mt-2 border border-gold text-gold font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">
                {busy === g.business_id ? "Оформляем..." : "Купить у этого магазина"}
              </button>
            </div>
          );
        })}

        {groups && groups.length > 0 && (
          <div className="bg-bgSurface border border-muted rounded-2xl p-3">
            <label className="text-muted text-xs flex flex-col gap-1">Ваш телефон (для связи магазинов с вами)
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={40} className={input} />
            </label>
            {msg && <p className="text-danger text-xs mt-2">{msg}</p>}
            <button onClick={() => buy()} disabled={!ready || !!busy} className="w-full mt-3 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
              {busy === "all" ? "Оформляем..." : "Купить всё"}
            </button>
            <p className="text-muted text-[11px] mt-2 text-center">Каждый магазин получит свой заказ только со своими товарами. Что не купили, останется в корзине.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
