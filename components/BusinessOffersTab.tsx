"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const EMPTY = { id: "", title: "", description: "", promo_code: "", discount_percent: "", valid_until: "", usage_limit: "", is_active: true };
const ERR: Record<string, string> = { empty_name: "Введите название.", bad_percent: "Скидка от 1 до 100%.", need_code: "Для скидки нужен промокод." };

// Спецпредложения для зрителей VETOKS: скидка по промокоду, срок и лимит.
export default function BusinessOffersTab() {
  const [items, setItems] = useState<any[] | null>(null);
  const [f, setF] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await apiPost("/api/business/manage", { action: "offers" });
    setItems(r?.ok ? r.items : []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(body: any) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/manage", { action: "offer_save", ...body });
    setBusy(false);
    if (r?.ok) {
      setF(null);
      load();
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить.");
  }

  const inp = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";
  const set = (k: string) => (e: any) => setF((o: any) => ({ ...o, [k]: e.target.value }));

  if (f) {
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setF(null)} className="text-muted text-sm self-start">← К предложениям</button>
        <label className="text-muted text-xs flex flex-col gap-1">Название (например, «−15% для зрителей VETOKS»)<input className={inp} value={f.title} onChange={set("title")} maxLength={120} /></label>
        <label className="text-muted text-xs flex flex-col gap-1">Описание<textarea className={inp} rows={2} value={f.description} onChange={set("description")} maxLength={500} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-muted text-xs flex flex-col gap-1">Промокод<input className={inp} value={f.promo_code} onChange={set("promo_code")} maxLength={30} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Скидка, %<input className={inp} value={f.discount_percent} onChange={set("discount_percent")} inputMode="numeric" /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Действует до<input type="date" className={inp} value={f.valid_until} onChange={set("valid_until")} /></label>
          <label className="text-muted text-xs flex flex-col gap-1">Лимит использований<input className={inp} value={f.usage_limit} onChange={set("usage_limit")} inputMode="numeric" placeholder="без лимита" /></label>
        </div>
        <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={!!f.is_active} onChange={(e) => setF((o: any) => ({ ...o, is_active: e.target.checked }))} /> Предложение включено</label>
        <button onClick={() => save(f)} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">{busy ? "Сохраняем..." : "Сохранить"}</button>
        {msg && <p className="text-danger text-sm">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setF({ ...EMPTY })} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">+ Новое предложение</button>
      {!items && <p className="text-muted text-sm">Загрузка...</p>}
      {items && items.length === 0 && <p className="text-muted text-sm">Предложений пока нет. Скидка или подарок для зрителей привлекают первых покупателей.</p>}
      {items?.map((o) => (
        <div key={o.id} className={`bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-1 ${o.is_active ? "" : "opacity-60"}`}>
          <p className="text-offwhite text-sm font-semibold break-words">{o.title}</p>
          <p className="text-muted text-xs">
            {[o.promo_code && `код ${o.promo_code}`, o.discount_percent ? `−${o.discount_percent}%` : "", o.valid_until && `до ${new Date(o.valid_until).toLocaleDateString("ru-RU")}`, `использовано ${o.used_count}${o.usage_limit != null ? ` из ${o.usage_limit}` : ""}`].filter(Boolean).join(" · ")}
          </p>
          <div className="flex gap-4 mt-1">
            <button onClick={() => setF({ ...o, description: o.description ?? "", promo_code: o.promo_code ?? "", discount_percent: o.discount_percent ?? "", valid_until: o.valid_until ?? "", usage_limit: o.usage_limit ?? "" })} className="text-gold text-xs underline">Изменить</button>
            <button onClick={() => save({ ...o, discount_percent: o.discount_percent ?? "", usage_limit: o.usage_limit ?? "", is_active: !o.is_active })} className="text-muted text-xs underline">{o.is_active ? "Выключить" : "Включить"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}
