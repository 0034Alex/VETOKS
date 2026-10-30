"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import { REPORT_REASONS } from "@/components/ReportSheet";
import { money, splitSizes } from "@/lib/businessShared";

export type BizPublic = {
  id?: string;
  name: string;
  category: string;
  about: string;
  logo_url: string | null;
  cover_url: string | null;
  hours: string;
  address: string;
  phone: string;
  email: string;
  site_url: string;
  quick_action: "buy" | "book";
  verified: boolean;
};

// Синяя галочка «Официальный партнёр VETOKS».
export function BlueCheck({ size = 18 }: { size?: number }) {
  return (
    <span
      title="Официальный партнёр VETOKS"
      className="inline-flex items-center justify-center rounded-full flex-none align-middle"
      style={{ width: size, height: size, background: "#1d9bf0", color: "#fff", fontSize: size * 0.62, fontWeight: 700 }}
    >
      ✓
    </span>
  );
}

export type BizProduct = { id: string; sku: string; name: string; description: string; price: number; photo_url: string | null; sizes: string; stock: number | null };
export type BizOffer = { id: string; title: string; description: string; promo_code: string; discount_percent: number | null; valid_until: string | null };

const ORDER_ERR: Record<string, string> = {
  need_phone: "Укажите телефон, чтобы партнёр мог связаться.",
  need_size: "Выберите размер.",
  no_stock: "Столько нет в наличии.",
  promo_invalid: "Промокод не подходит или закончился.",
  no_recipient: "Участница не найдена. Выберите из списка.",
  self_gift: "Подарок самой себе оформить нельзя, закажите его как обычную покупку.",
  teen_gift: "Подарки доступны только совершеннолетним участницам.",
  gifts_unavailable: "Подарки пока недоступны. Попробуйте позже.",
  own_business: "Нельзя заказывать у самого себя.",
  no_product: "Товар недоступен.",
};

// Страница партнёра: так её видят зрители в приложении. Один и тот же вид для зрителей, владельца и предпросмотра в CRM.
export default function BusinessPageView({ p, preview = false, products = [], offers = [], cur = "₴", canOrder = false, demo = false }: { p: BizPublic; preview?: boolean; products?: BizProduct[]; offers?: BizOffer[]; cur?: string; canOrder?: boolean; demo?: boolean }) {
  const [contact, setContact] = useState(false);
  const [sel, setSel] = useState<BizProduct | null>(null);
  const [book, setBook] = useState(false);
  const [o, setO] = useState({ size: "", qty: 1, promo: "", phone: "", note: "", whenText: "", service: "" });
  const [oBusy, setOBusy] = useState(false);
  const [oErr, setOErr] = useState("");
  const [oDone, setODone] = useState<{ id: string; total: number } | null>(null);
  const [gift, setGift] = useState(false);
  const [gq, setGq] = useState("");
  const [gFound, setGFound] = useState<{ id: string; name: string; photo_url: string | null }[]>([]);
  const [gPick, setGPick] = useState<{ id: string; name: string } | null>(null);
  const [anon, setAnon] = useState(false);
  const [gmsg, setGmsg] = useState("");
  const [report, setReport] = useState<"" | "pick" | "done">("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const quick = p.quick_action === "book" ? "📅 Забронировать" : "🛒 Купить";

  async function findGirl(q: string) {
    setGq(q);
    if (q.trim().length < 2) return setGFound([]);
    const r = await apiPost("/api/business/orders", { action: "gift_find", query: q });
    setGFound(r?.ok ? r.items : []);
  }

  function closeOrder() {
    setSel(null);
    setBook(false);
    setGift(false);
  }

  function openOrder(pr: BizProduct | null, asBook = false, asGift = false) {
    setGift(asGift);
    setGq("");
    setGFound([]);
    setGPick(null);
    setAnon(false);
    setGmsg("");
    setO({ size: "", qty: 1, promo: "", phone: "", note: "", whenText: "", service: "" });
    setOErr("");
    setODone(null);
    setSel(pr);
    setBook(asBook);
  }

  async function sendOrder() {
    if (gift && !gPick) return setOErr("Выберите участницу, которой дарите.");
    if (gift && !sel) return setOErr("Выберите подарок.");
    setOBusy(true);
    setOErr("");
    if (demo) {
      // Предпросмотр сотрудника: заказ не отправляется, только показываем, как это выглядит.
      const code = o.promo.trim().toUpperCase();
      const off = offers.find((x) => x.promo_code && x.promo_code.toUpperCase() === code);
      const pct = off?.discount_percent ?? 0;
      const total = sel ? Math.round(sel.price * o.qty * (1 - pct / 100) * 100) / 100 : 0;
      setTimeout(() => {
        setOBusy(false);
        setODone({ id: "", total });
      }, 400);
      return;
    }
    const r = await apiPost("/api/business/orders", {
      action: "create",
      businessId: p.id,
      kind: book ? "book" : gift ? "gift" : "buy",
      recipientId: gPick?.id,
      anon,
      message: gmsg,
      productId: sel?.id,
      size: o.size,
      qty: o.qty,
      promo: o.promo,
      phone: o.phone,
      note: o.note,
      whenText: o.whenText,
      service: o.service,
    });
    setOBusy(false);
    if (r?.ok) setODone({ id: r.id, total: r.total });
    else setOErr(ORDER_ERR[r?.error] ?? "Не получилось оформить. Попробуйте ещё раз.");
  }

  function quickAction() {
    if (preview || !(canOrder || demo)) return setContact(true);
    if (p.quick_action === "book") return openOrder(null, true);
    if (products.length === 1) return openOrder(products[0]);
    if (products.length > 1) {
      document.getElementById("biz-catalog")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setContact(true);
  }

  async function sendReport() {
    if (!reason) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/report", { id: p.id, reason, details });
    setBusy(false);
    if (r?.ok) setReport("done");
    else setErr("Не получилось отправить. Попробуйте ещё раз.");
  }

  return (
    <div className="pb-6">
      <div className="h-32 w-full overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(201,162,39,0.25))" }}>
        {p.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="px-5 -mt-8">
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-2xl bg-bgSurface border border-gold/40 overflow-hidden flex items-center justify-center flex-none">
            {p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gold text-2xl font-bold">{(p.name || "?").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          {!preview && !demo && p.id && (
            <button onClick={() => setReport("pick")} className="ml-auto text-muted text-xs border border-muted/60 rounded-full px-3 py-1.5">
              Пожаловаться
            </button>
          )}
        </div>

        <h1 className="text-offwhite text-xl font-semibold mt-3 flex items-center gap-2 flex-wrap">
          <span className="min-w-0 break-words">{p.name}</span>
          {p.verified && <BlueCheck />}
        </h1>
        {p.verified && <p className="text-[#1d9bf0] text-xs mt-0.5">Официальный партнёр VETOKS</p>}
        {p.category && <p className="text-muted text-sm mt-1">{p.category}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={quickAction} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">
            {quick}
          </button>
          {p.phone && (
            <a href={`tel:${p.phone}`} className="border border-gold text-gold font-semibold rounded-full px-5 py-3 text-sm">
              Позвонить
            </a>
          )}
        </div>

        <button onClick={() => (preview || !(canOrder || demo) ? undefined : openOrder(null, false, true))} className="w-full mt-2 border border-gold/70 text-gold font-semibold rounded-full py-2.5 text-sm">
          🎁 Подарить участнице шоу
        </button>

        {p.about && <p className="text-offwhite text-sm mt-4 whitespace-pre-line">{p.about}</p>}

        <div className="bg-bgSurface border border-muted rounded-xl p-4 mt-4 flex flex-col gap-2 text-sm">
          {p.hours && <Row k="🕒" v={p.hours} />}
          {p.address && <Row k="📍" v={p.address} />}
          {p.phone && <Row k="📞" v={p.phone} />}
          {p.email && <Row k="✉️" v={p.email} />}
          {p.site_url && (
            <div className="flex gap-3">
              <span>🌐</span>
              <a href={p.site_url} target="_blank" rel="noopener noreferrer" className="text-gold break-all">
                {p.site_url.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
          {!p.hours && !p.address && !p.phone && !p.email && !p.site_url && <p className="text-muted">Контакты пока не заполнены.</p>}
        </div>

        {offers.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-offwhite text-sm font-semibold">Для зрителей VETOKS</p>
            {offers.map((x) => (
              <div key={x.id} className="border border-gold/50 rounded-xl p-3 bg-gold/5">
                <p className="text-offwhite text-sm font-semibold">{x.title}{x.discount_percent ? ` · −${x.discount_percent}%` : ""}</p>
                {x.description && <p className="text-muted text-xs mt-0.5">{x.description}</p>}
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-gold text-sm font-semibold tracking-wide">{x.promo_code}</span>
                  {x.promo_code && (
                    <button
                      onClick={() => {
                        try {
                          navigator.clipboard?.writeText(x.promo_code);
                        } catch {}
                      }}
                      className="text-xs border border-gold text-gold rounded-full px-3 py-1"
                    >
                      Скопировать
                    </button>
                  )}
                </div>
                {x.valid_until && <p className="text-muted text-[11px] mt-1">до {new Date(x.valid_until).toLocaleDateString("ru-RU")}</p>}
              </div>
            ))}
          </div>
        )}

        <div id="biz-catalog" className="mt-4">
          <p className="text-offwhite text-sm font-semibold mb-2">{p.quick_action === "book" ? "Услуги" : "Товары"}</p>
          {products.length === 0 ? (
            <div className="bg-bgSurface border border-muted/60 rounded-xl p-4">
              <p className="text-muted text-xs">Каталог пока пуст.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((pr) => (
                <button key={pr.id} onClick={() => (preview || !(canOrder || demo) ? undefined : openOrder(pr))} className="text-left bg-bgSurface border border-muted rounded-xl overflow-hidden flex flex-col min-w-0">
                  <div className="aspect-square bg-bgPrimary flex items-center justify-center text-gold text-2xl font-bold overflow-hidden">
                    {pr.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pr.photo_url} alt={pr.name} className="w-full h-full object-cover" />
                    ) : (
                      (pr.name || "?").slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-offwhite text-sm font-semibold break-words">{pr.name}</p>
                    {pr.sku && <p className="text-muted text-[11px]">ID {pr.sku}</p>}
                    <p className="text-gold text-sm font-semibold">{money(pr.price, cur)}</p>
                    {pr.stock === 0 && <p className="text-danger text-[11px]">Нет в наличии</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {contact && (
        <div className="fixed inset-0 z-[120] bg-black/65 flex items-end justify-center" onClick={() => setContact(false)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-offwhite font-semibold mb-1">{quick.replace(/^\S+\s/, "")}: {p.name}</p>
            <p className="text-muted text-xs mb-3">Свяжитесь с партнёром напрямую.</p>
            {p.phone && <p className="text-offwhite text-sm">📞 {p.phone}</p>}
            {p.email && <p className="text-offwhite text-sm mt-1">✉️ {p.email}</p>}
            {!p.phone && !p.email && <p className="text-muted text-sm">Контакты не указаны.</p>}
            <button onClick={() => setContact(false)} className="w-full mt-4 border border-muted text-offwhite rounded-full py-2.5 text-sm">Закрыть</button>
          </div>
        </div>
      )}

      {(sel || book || gift) && (
        <div className="fixed inset-0 z-[120] bg-black/65 flex items-end justify-center" onClick={() => { if (!oBusy) closeOrder(); }}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5 max-h-[88dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            {oDone ? (
              <>
                <p className="text-offwhite font-semibold mb-1">{book ? "Запрос на бронь отправлен" : gift ? "Подарок оформлен" : "Заказ оформлен"}</p>
                <p className="text-muted text-sm mb-1">{book ? "Партнёр подтвердит бронь в чате." : gift ? `Сумма: ${money(oDone.total, cur)}. Договоритесь с магазином об оплате в чате. Когда магазин отметит оплату, подарок уйдёт участнице. Статус будет в «Заказы и подарки».` : `Сумма: ${money(oDone.total, cur)}. Партнёр свяжется с вами в чате и уточнит оплату и доставку.`}</p>
                <p className="text-muted text-xs mb-4">Оплата идёт напрямую партнёру. VETOKS в оплате не участвует.</p>
                {oDone.id ? <a href={`/my-orders?o=${oDone.id}`} className="block text-center bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Открыть заказ и чат</a> : <p className="text-gold text-xs text-center">Это предпросмотр: заказ никуда не отправлен.</p>}
                <button onClick={closeOrder} className="w-full mt-2 border border-muted text-offwhite rounded-full py-2.5 text-sm">Закрыть</button>
              </>
            ) : (
              <>
                <p className="text-offwhite font-semibold">{book ? "Забронировать" : gift ? "Подарить участнице" : sel?.name}</p>
                {sel && <p className="text-gold text-sm mb-3">{money(sel.price, cur)}{sel.sku ? ` · ID ${sel.sku}` : ""}</p>}
                {sel?.description && <p className="text-muted text-sm mb-3">{sel.description}</p>}
                <div className="flex flex-col gap-3">
                  {!book && (
                    <div className="flex gap-2">
                      {([[false, "Купить себе"], [true, "🎁 Подарить участнице"]] as const).map(([k, l]) => (
                        <button key={String(k)} onClick={() => setGift(k)} className={`flex-1 px-3 py-2 rounded-full text-sm border ${gift === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
                      ))}
                    </div>
                  )}
                  {gift && !sel && (
                    <label className="text-muted text-xs flex flex-col gap-1">Что дарим
                      <select value="" onChange={(e) => setSel(products.find((x) => x.id === e.target.value) ?? null)} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite">
                        <option value="">Выберите товар</option>
                        {products.filter((x) => x.stock !== 0).map((x) => <option key={x.id} value={x.id}>{x.name} · {money(x.price, cur)}</option>)}
                      </select>
                    </label>
                  )}
                  {gift && (
                    <div className="flex flex-col gap-2">
                      <label className="text-muted text-xs flex flex-col gap-1">Кому (найдите участницу по имени)
                        <input value={gq} onChange={(e) => findGirl(e.target.value)} placeholder="Имя участницы" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" />
                      </label>
                      {gPick && <p className="text-gold text-sm">Получательница: {gPick.name}</p>}
                      {gFound.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {gFound.map((x) => (
                            <button key={x.id} onClick={() => { setGPick({ id: x.id, name: x.name }); setGFound([]); setGq(x.name); }} className="flex items-center gap-2.5 text-left bg-bgPrimary rounded-lg p-2">
                              <span className="w-9 h-9 rounded-full overflow-hidden bg-bgSurface flex items-center justify-center text-gold text-sm flex-none">
                                {x.photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={x.photo_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (x.name || "?").slice(0, 1)
                                )}
                              </span>
                              <span className="text-offwhite text-sm">{x.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-offwhite text-sm"><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Подарить анонимно</label>
                      <p className="text-muted text-xs">{anon ? "Участница увидит: «подарок от тайного поклонника». Магазин знает, кто даритель." : "Участница увидит ваше имя."}</p>
                      <label className="text-muted text-xs flex flex-col gap-1">Открытка
                        <textarea value={gmsg} onChange={(e) => setGmsg(e.target.value)} rows={2} maxLength={300} placeholder="Пара тёплых слов" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" />
                      </label>
                      <p className="text-muted text-xs">Адрес вы не вводите. После вашей оплаты участница решит, принять ли подарок, и магазин сам уточнит у неё адрес. Адрес увидит только магазин.</p>
                    </div>
                  )}
                  {book && products.length > 0 && (
                    <label className="text-muted text-xs flex flex-col gap-1">Что бронируем
                      <select value={o.service} onChange={(e) => setO({ ...o, service: e.target.value })} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite">
                        <option value="">Выберите</option>
                        {products.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}
                      </select>
                    </label>
                  )}
                  {book && products.length === 0 && (
                    <label className="text-muted text-xs flex flex-col gap-1">Что бронируем<input value={o.service} onChange={(e) => setO({ ...o, service: e.target.value })} maxLength={120} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" /></label>
                  )}
                  {book && (
                    <label className="text-muted text-xs flex flex-col gap-1">Когда (дата и время)<input value={o.whenText} onChange={(e) => setO({ ...o, whenText: e.target.value })} placeholder="Например, 5 ноября, 15:00" maxLength={80} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" /></label>
                  )}
                  {sel && splitSizes(sel.sizes).length > 0 && (
                    <div>
                      <p className="text-muted text-xs mb-1">Размер</p>
                      <div className="flex gap-2 flex-wrap">
                        {splitSizes(sel.sizes).map((z) => (
                          <button key={z} onClick={() => setO({ ...o, size: z })} className={`px-3.5 py-1.5 rounded-full text-sm border ${o.size === z ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{z}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {sel && (
                    <div className="flex items-center gap-3">
                      <span className="text-muted text-xs">Количество</span>
                      <button onClick={() => setO({ ...o, qty: Math.max(1, o.qty - 1) })} className="w-8 h-8 rounded-full border border-muted text-offwhite">−</button>
                      <span className="text-offwhite w-6 text-center">{o.qty}</span>
                      <button onClick={() => setO({ ...o, qty: Math.min(99, o.qty + 1) })} className="w-8 h-8 rounded-full border border-muted text-offwhite">+</button>
                    </div>
                  )}
                  {sel && <label className="text-muted text-xs flex flex-col gap-1">Промокод (если есть)<input value={o.promo} onChange={(e) => setO({ ...o, promo: e.target.value })} maxLength={30} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite uppercase" /></label>}
                  <label className="text-muted text-xs flex flex-col gap-1">Ваш телефон{gift ? " (для связи магазина с вами)" : ""}<input value={o.phone} onChange={(e) => setO({ ...o, phone: e.target.value })} inputMode="tel" maxLength={40} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" /></label>
                  <label className="text-muted text-xs flex flex-col gap-1">Комментарий<textarea value={o.note} onChange={(e) => setO({ ...o, note: e.target.value })} rows={2} maxLength={500} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" /></label>
                </div>
                <p className="text-muted text-[11px] mt-3">Оплата идёт напрямую партнёру. VETOKS в оплате не участвует и комиссию не берёт.</p>
                {oErr && <p className="text-danger text-xs mt-2">{oErr}</p>}
                <button onClick={sendOrder} disabled={oBusy || (book && !o.whenText.trim())} className="w-full mt-3 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
                  {oBusy ? "Отправляем..." : book ? "Отправить запрос" : sel ? `${gift ? "Оформить подарок" : "Оформить"} · ${money(sel.price * o.qty, cur)}` : "Оформить"}
                </button>
                <button onClick={closeOrder} className="w-full mt-2 text-muted text-sm py-2">Отмена</button>
              </>
            )}
          </div>
        </div>
      )}

      {report && (
        <div className="fixed inset-0 z-[120] bg-black/65 flex items-end justify-center" onClick={() => !busy && setReport("")}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            {report === "done" ? (
              <>
                <p className="text-offwhite font-semibold mb-2">Спасибо, жалоба отправлена</p>
                <p className="text-muted text-sm mb-4">Мы проверим страницу и примем решение.</p>
                <button onClick={() => setReport("")} className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Готово</button>
              </>
            ) : (
              <>
                <p className="text-offwhite font-semibold mb-3">Пожаловаться на страницу</p>
                <div className="flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => (
                    <button key={r.key} onClick={() => setReason(r.key)} className={`text-left rounded-xl px-4 py-2.5 border ${reason === r.key ? "border-gold bg-gold/10" : "border-muted"}`}>
                      <span className="text-offwhite text-sm block">{r.title}</span>
                      <span className="text-muted text-xs">{r.hint}</span>
                    </button>
                  ))}
                </div>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Что не так (по желанию)" className="w-full bg-bgPrimary border border-muted rounded-xl px-3 py-2 text-sm mt-3" />
                {err && <p className="text-danger text-xs mt-2">{err}</p>}
                <button onClick={sendReport} disabled={!reason || busy} className="w-full mt-3 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">
                  {busy ? "Отправляем..." : "Отправить"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span>{k}</span>
      <span className="text-offwhite min-w-0 break-words">{v}</span>
    </div>
  );
}
