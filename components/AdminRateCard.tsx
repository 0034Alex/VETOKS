"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";
import { loadScoped } from "@/lib/scopedSettings";
import { clearPricingCache } from "@/lib/currency";
import { apiPost } from "@/lib/authClient";

type H = { id: string; rate: number; changed_by: string | null; created_at: string };

// Дашборд: курс $ на сегодня + история изменений. От курса зависит только цена пакетов монет в валюте страны.
export default function AdminRateCard() {
  const cc = getCrmCountry() || null;
  const [rate, setRate] = useState("");
  const [cur, setCur] = useState("");
  const [hist, setHist] = useState<H[]>([]);
  const [histOk, setHistOk] = useState(true);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    const m = await loadScoped(["usd_to_uah_rate"], cc);
    setRate(m.usd_to_uah_rate ?? "");
    setCur(crmCur);
    const r: any = await apiPost("/api/admin/rate", { action: "history", countryId: cc });
    if (r?.ok) {
      setHist(r.items ?? []);
      setHistOk(r.tableOk !== false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    const r = Number(String(rate).replace(",", "."));
    if (!(r > 0)) {
      setMsg("Введите число больше нуля");
      return;
    }
    const res: any = await apiPost("/api/admin/rate", { action: "set", countryId: cc, rate: r });
    if (!res?.ok) {
      setMsg("Не удалось сохранить курс");
      return;
    }
    clearPricingCache();
    setMsg(res.historyOk ? "Курс сохранён ✓" : "Курс сохранён (история пока не ведётся)");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  return (
    <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-offwhite text-sm font-semibold">Курс на сегодня: $1 =</span>
        <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-24" />
        <span className="text-muted text-sm">{cur}</span>
        <button onClick={save} className="bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm">Сохранить</button>
        {msg && <span className="text-success text-xs">{msg}</span>}
      </div>
      <p className="text-muted text-xs mt-1">Меняет только цену пакетов монет в {cur || "валюте страны"}. Цены подарков в монетах остаются прежними.</p>
      <button onClick={() => setOpen((v) => !v)} className="text-gold text-xs underline mt-2">
        {open ? "Скрыть историю" : "История курса"}
      </button>
      {open && (
        <div className="mt-2">
          {!histOk && <p className="text-muted text-xs">История заработает после SQL (таблица rate_history).</p>}
          {histOk && hist.length === 0 && <p className="text-muted text-xs">Пока нет записей.</p>}
          {hist.map((h) => (
            <div key={h.id} className="flex justify-between text-xs text-offwhite py-1 border-t border-muted/40">
              <span>{new Date(h.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span>${1} = {h.rate} {cur}</span>
              <span className="text-muted">{h.changed_by ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
