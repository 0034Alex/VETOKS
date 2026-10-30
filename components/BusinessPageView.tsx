"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import { REPORT_REASONS } from "@/components/ReportSheet";
import { money, splitSizes, ShopProduct, stockInfo, sizeInfo, productTotal } from "@/lib/businessShared";
import { shareLink } from "@/components/ProfileHero";

export type BizPublic = {
  id?: string;
  user_id?: string | null;
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

export type BizProduct = ShopProduct;
export type BizOffer = { id: string; title: string; description: string; promo_code: string; discount_percent: number | null; valid_until: string | null };

const ORDER_ERR: Record<string, string> = {
  need_phone: "Укажите телефон, чтобы партнёр мог связаться.",
  need_size: "Выберите размер.",
  no_stock: "Столько нет в наличии.",
  promo_invalid: "Промокод не подходит или закончился.",
  no_recipient: "Получатель не найден. Выберите из списка.",
  self_gift: "Подарок самой себе оформить нельзя, закажите его как обычную покупку.",
  teen_gift: "Подарки пока доступны только совершеннолетним.",
  gifts_unavailable: "Подарки пока недоступны. Попробуйте позже.",
  own_business: "Нельзя заказывать у самого себя.",
  no_product: "Товар недоступен.",
};

// Страница партнёра: так её видят зрители в приложении. Один и тот же вид для зрителей, владельца и предпросмотра в CRM.
export default function BusinessPageView({ p, preview = false, products = [], offers = [], cur = "₴", canOrder = false, demo = false, bare = false, owner = false, onEdit }: { p: BizPublic; preview?: boolean; products?: BizProduct[]; offers?: BizOffer[]; cur?: string; canOrder?: boolean; demo?: boolean; bare?: boolean; owner?: boolean; onEdit?: (p: BizProduct) => void }) {
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
  const [shared, setShared] = useState(false);
  const [tab, setTab] = useState<"shop" | "feed" | "about">("shop");
  const [sheetP, setSheetP] = useState<BizProduct | null>(null);
  const [gi, setGi] = useState(0);
  const [sheetSize, setSheetSize] = useState("");
  const quick = p.quick_action === "book" ? "📅 Забронировать" : "🛒 Купить";

  async function findGirl(q: string) {
    setGq(q);
    if (q.trim().length < 2) return setGFound([]);
    const r = await apiPost("/api/business/orders", { action: "gift_find", query: q });
    setGFound(r?.ok ? r.items : []);
  }

  async function shareShop() {
    const url = window.location.origin + (p.user_id ? `/u/${p.user_id}` : `/b/${p.id}`);
    const r = await shareLink(url, p.name);
    if (r === "copied") {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  function closeOrder() {
    setSel(null);
    setBook(false);
    setGift(false);
  }

  function openOrder(pr: BizProduct | null, asBook = false, asGift = false, presetSize = "") {
    setSheetP(null);
    setGift(asGift);
    setGq("");
    setGFound([]);
    setGPick(null);
    setAnon(false);
    setGmsg("");
    setO({ size: presetSize, qty: 1, promo: "", phone: "", note: "", whenText: "", service: "" });
    setOErr("");
    setODone(null);
    setSel(pr);
    setBook(asBook);
  }

  async function sendOrder() {
    if (gift && !gPick) return setOErr("Выберите, кому дарите.");
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

  const can = !(preview || !(canOrder || demo));
  const statusPill = (pr: BizProduct) => {
    const st = stockInfo(productTotal(pr));
    const cls = st.state === "ok" ? "text-success border-success/70" : st.state === "low" ? "text-gold border-gold/70" : "text-danger border-danger/70";
    return <span className={`absolute left-2 top-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 border ${cls}`}>{st.label}</span>;
  };
  const cover = (pr: BizProduct, big = false) =>
    pr.photos[0] ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pr.photos[0]} alt={pr.name} className="w-full h-full object-cover" />
    ) : (
      <span className={`text-gold font-bold ${big ? "text-4xl" : "text-2xl"}`}>{(pr.name || "?").slice(0, 2).toUpperCase()}</span>
    );

  function productButtons(pr: BizProduct) {
    const out = stockInfo(productTotal(pr)).state === "out";
    if (out) return <button disabled className="w-full border border-muted text-muted rounded-full py-2 text-xs opacity-60">Нет в наличии</button>;
    return (
      <>
        <button onClick={() => openProduct(pr)} className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-2 text-xs">
          {p.quick_action === "book" ? "Выбрать" : "Купить"}
        </button>
        <button onClick={() => (can ? openOrder(pr, false, true) : openProduct(pr))} className="w-full border border-gold/70 text-gold font-semibold rounded-full py-2 text-xs">
          🎁 Подарить
        </button>
      </>
    );
  }

  function openProduct(pr: BizProduct) {
    setGi(0);
    setSheetSize("");
    setSheetP(pr);
  }

  return (
    <div className="pb-6">
      {!bare && (
      <div className="h-32 w-full overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(201,162,39,0.25))" }}>
        {p.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      )}
      <div className={bare ? "px-5 pt-1" : "px-5 -mt-8"}>
        {!bare && (
          <>
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-2xl bg-bgSurface border border-gold/40 overflow-hidden flex items-center justify-center flex-none">
            {p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gold text-2xl font-bold">{(p.name || "?").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {p.id && (
              <button onClick={shareShop} className="text-gold text-xs border border-gold/60 rounded-full px-3 py-1.5">
                {shared ? "Ссылка скопирована" : "Поделиться"}
              </button>
            )}
            {!preview && !demo && p.id && (
              <button onClick={() => setReport("pick")} className="text-muted text-xs border border-muted/60 rounded-full px-3 py-1.5">
                Пожаловаться
              </button>
            )}
          </div>
        </div>
        <h1 className="text-offwhite text-xl font-semibold mt-3 flex items-center gap-2 flex-wrap">
          <span className="min-w-0 break-words">{p.name}</span>
          {p.verified && <BlueCheck />}
        </h1>
        {p.verified && <p className="text-[#1d9bf0] text-xs mt-0.5">Официальный партнёр VETOKS</p>}
        {p.category && <p className="text-muted text-sm mt-1">{p.category}</p>}
        {p.about && <p className="text-offwhite text-sm mt-3 whitespace-pre-line">{p.about}</p>}
          </>
        )}

        <div className="bg-bgSurface border border-gold/30 rounded-2xl p-4 mt-4 flex flex-col gap-2 text-sm">
          {p.phone && <Row k="📞" v={p.phone} />}
          {p.address && <Row k="📍" v={p.address} />}
          {p.hours && <Row k="🕒" v={p.hours} />}
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
          {(p.phone || p.email) && (
            <div className="flex gap-2 mt-1">
              {p.phone && <a href={`tel:${p.phone}`} className="flex-1 text-center border border-gold text-gold font-semibold rounded-full py-2 text-xs">Позвонить</a>}
              <button onClick={quickAction} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-2 text-xs">{quick}</button>
            </div>
          )}
        </div>

        <div className="flex gap-1 mt-4 border border-gold/30 rounded-full p-1 bg-bgSurface">
          {([["shop", "🛍 Магазин"], ["feed", "Лента"], ["about", "О магазине"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-full text-[13px] ${tab === k ? "bg-gold/20 text-gold font-bold ring-1 ring-gold" : "text-offwhite"}`}>{l}</button>
          ))}
        </div>

        {tab === "shop" && (
          <>
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
              {products.length === 0 ? (
                <div className="bg-bgSurface border border-muted/60 rounded-xl p-4">
                  <p className="text-muted text-xs">{owner ? "Пока нет товаров. Нажмите «＋ Выставить товар»." : "Товаров пока нет."}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((pr) => {
                    const out = stockInfo(productTotal(pr)).state === "out";
                    return (
                      <div key={pr.id} className="bg-bgSurface border border-gold/25 rounded-2xl overflow-hidden flex flex-col min-w-0">
                        <button onClick={() => openProduct(pr)} className="text-left flex flex-col min-w-0">
                          <div className={`aspect-square bg-bgPrimary flex items-center justify-center overflow-hidden relative ${out ? "grayscale opacity-70" : ""}`}>
                            {cover(pr)}
                            {statusPill(pr)}
                          </div>
                          <div className="p-2.5 flex flex-col gap-0.5">
                            <p className="text-offwhite text-sm font-semibold break-words">{pr.name}</p>
                            <p className="text-gold text-sm font-bold">{money(pr.price, cur)}</p>
                          </div>
                        </button>
                        <div className="px-2.5 pb-2.5 mt-auto flex flex-col gap-1.5">{productButtons(pr)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "feed" && (
          <div className="mt-4 flex flex-col gap-4">
            {products.length === 0 && <p className="text-muted text-sm">Пока ничего не выставлено.</p>}
            {products.map((pr) => (
              <div key={pr.id} className="bg-bgSurface border border-gold/25 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="w-7 h-7 rounded-full overflow-hidden bg-bgPrimary border border-gold/50 flex items-center justify-center text-gold text-[11px] font-bold flex-none">
                    {p.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (p.name || "?").slice(0, 1)
                    )}
                  </span>
                  <span className="text-offwhite text-sm font-semibold truncate">{p.name}</span>
                </div>
                <button onClick={() => openProduct(pr)} className="block w-full aspect-[4/3] bg-bgPrimary relative overflow-hidden flex items-center justify-center">
                  {cover(pr, true)}
                  {statusPill(pr)}
                  {pr.photos.length > 1 && <span className="absolute right-2 top-2 text-[10px] bg-black/70 text-muted rounded-full px-2 py-0.5">1/{pr.photos.length}</span>}
                </button>
                <div className="p-3 flex flex-col gap-1.5">
                  <p className="text-offwhite text-sm font-semibold">{pr.name} · <span className="text-gold">{money(pr.price, cur)}</span></p>
                  {pr.description && <p className="text-muted text-xs line-clamp-2">{pr.description}</p>}
                  <div className="flex gap-2 mt-1">{productButtons(pr)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "about" && (
          <div className="mt-4 bg-bgSurface border border-muted rounded-2xl p-4 text-sm flex flex-col gap-2">
            <p className="text-gold font-semibold">О магазине</p>
            {p.category && <p className="text-muted">{p.category}</p>}
            {p.about ? <p className="text-offwhite whitespace-pre-line">{p.about}</p> : <p className="text-muted">Описание пока не заполнено.</p>}
            <p className="text-muted text-xs mt-1">Оплата идёт напрямую магазину. VETOKS в оплате не участвует и комиссию не берёт.</p>
          </div>
        )}
      </div>

      {sheetP && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-end justify-center" onClick={() => setSheetP(null)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl max-h-[92dvh] overflow-y-auto border-t border-gold/50" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            {(() => {
              const pr = sheetP;
              const total = productTotal(pr);
              const st = stockInfo(total);
              const tone = st.state === "ok" ? "text-success border-success/70" : st.state === "low" ? "text-gold border-gold/70" : "text-danger border-danger/70";
              const ss = pr.size_stock;
              const sizes = ss ? Object.entries(ss) : splitSizes(pr.sizes).map((z) => [z, 99] as [string, number]);
              const photo = pr.photos[Math.min(gi, Math.max(0, pr.photos.length - 1))];
              const needSize = sizes.length > 0 && !sheetSize;
              return (
                <>
                  <div className="relative aspect-square bg-bgPrimary flex items-center justify-center overflow-hidden">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={pr.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gold text-5xl font-bold">{(pr.name || "?").slice(0, 2).toUpperCase()}</span>
                    )}
                    <button onClick={() => setSheetP(null)} className="absolute right-3 top-3 w-9 h-9 rounded-full bg-black/60 text-white">✕</button>
                    {pr.photos.length > 1 && (
                      <>
                        <button onClick={() => setGi((i) => (i - 1 + pr.photos.length) % pr.photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white">‹</button>
                        <button onClick={() => setGi((i) => (i + 1) % pr.photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white">›</button>
                        <span className="absolute right-3 bottom-3 text-[11px] bg-black/60 text-white rounded-full px-2 py-0.5">{gi + 1}/{pr.photos.length}</span>
                      </>
                    )}
                  </div>
                  {pr.photos.length > 1 && (
                    <div className="flex gap-2 px-5 pt-3 overflow-x-auto">
                      {pr.photos.map((u, i) => (
                        <button key={u + i} onClick={() => setGi(i)} className={`w-14 h-14 rounded-xl overflow-hidden flex-none border-2 ${i === gi ? "border-gold" : "border-transparent"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="px-5 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-offwhite text-lg font-semibold break-words min-w-0">{pr.name}</h2>
                      <span className={`flex-none text-[11px] font-bold px-2.5 py-1 rounded-full border ${tone}`}>{st.label}</span>
                    </div>
                    <p className="text-gold text-xl font-bold mt-1">{money(pr.price, cur)}</p>
                    {pr.description && <p className="text-offwhite text-sm mt-2 whitespace-pre-line">{pr.description}</p>}
                    {sizes.length > 0 && (
                      <>
                        <p className="text-muted text-xs mt-3">Размер</p>
                        <div className="flex gap-2 flex-wrap mt-1.5">
                          {sizes.map(([k, n]) => {
                            const si = sizeInfo(n);
                            const out = si.state === "out";
                            return (
                              <button key={k} disabled={out} onClick={() => setSheetSize(k)} className={`min-w-[52px] px-3 py-1.5 rounded-xl border text-center ${sheetSize === k ? "border-gold bg-gold/15 text-gold" : "border-muted text-offwhite"} ${out ? "opacity-40 line-through" : ""}`}>
                                <span className="text-sm block">{k}</span>
                                {ss && <span className={`text-[10px] block ${si.state === "low" ? "text-gold" : "text-muted"}`}>{si.hint}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm mt-3">
                      {pr.sku && (<><span className="text-muted">Артикул</span><span className="text-offwhite">{pr.sku}</span></>)}
                      {pr.details && (<><span className="text-muted">Характеристики</span><span className="text-offwhite break-words">{pr.details}</span></>)}
                      <span className="text-muted">Наличие</span>
                      <span className="text-offwhite">{st.label}{total !== null && total > 0 && st.state === "low" ? `, осталось ${total}` : ""}</span>
                    </div>
                    {st.state !== "out" && (
                      <div className="flex gap-2 mt-4">
                        <button
                          disabled={!can || needSize}
                          onClick={() => openOrder(pr, false, false, sheetSize)}
                          className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50"
                        >
                          {needSize ? "Выберите размер" : p.quick_action === "book" ? "Выбрать" : "Купить"}
                        </button>
                        <button
                          disabled={!can || needSize}
                          onClick={() => openOrder(pr, false, true, sheetSize)}
                          className="flex-1 border border-gold text-gold font-semibold rounded-full py-3 text-sm disabled:opacity-50"
                        >
                          🎁 Подарить
                        </button>
                      </div>
                    )}
                    {!can && !owner && <p className="text-muted text-xs mt-2 text-center">{demo ? "" : "Заказать можно из аккаунта зрителя."}</p>}
                    {owner && onEdit && (
                      <button onClick={() => { setSheetP(null); onEdit(pr); }} className="w-full mt-3 border border-muted text-offwhite rounded-full py-2.5 text-sm">✎ Изменить товар и остатки</button>
                    )}
                    <p className="text-muted text-[11px] mt-3 text-center">Оплата идёт напрямую магазину. VETOKS в оплате не участвует.</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {bare && !preview && !demo && p.id && (
        <div className="px-5 mt-4">
          <button onClick={() => setReport("pick")} className="text-muted text-xs underline">Пожаловаться на магазин</button>
        </div>
      )}

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
                <p className="text-muted text-sm mb-1">{book ? "Партнёр подтвердит бронь в чате." : gift ? `Сумма: ${money(oDone.total, cur)}. Договоритесь с магазином об оплате в чате. Когда магазин отметит оплату, подарок уйдёт получателю. Статус будет в «Заказы и подарки».` : `Сумма: ${money(oDone.total, cur)}. Партнёр свяжется с вами в чате и уточнит оплату и доставку.`}</p>
                <p className="text-muted text-xs mb-4">Оплата идёт напрямую партнёру. VETOKS в оплате не участвует.</p>
                {oDone.id ? <a href={`/my-orders?o=${oDone.id}`} className="block text-center bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Открыть заказ и чат</a> : <p className="text-gold text-xs text-center">Это предпросмотр: заказ никуда не отправлен.</p>}
                <button onClick={closeOrder} className="w-full mt-2 border border-muted text-offwhite rounded-full py-2.5 text-sm">Закрыть</button>
              </>
            ) : (
              <>
                <p className="text-offwhite font-semibold">{book ? "Забронировать" : gift ? "Подарить" : sel?.name}</p>
                {sel && <p className="text-gold text-sm mb-3">{money(sel.price, cur)}{sel.sku ? ` · ID ${sel.sku}` : ""}</p>}
                {sel?.description && <p className="text-muted text-sm mb-3">{sel.description}</p>}
                <div className="flex flex-col gap-3">
                  {!book && (
                    <div className="flex gap-2">
                      {([[false, "Купить себе"], [true, "🎁 Подарить"]] as const).map(([k, l]) => (
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
                      <label className="text-muted text-xs flex flex-col gap-1">Кому (любой пользователь VETOKS, найдите по имени)
                        <input value={gq} onChange={(e) => findGirl(e.target.value)} placeholder="Имя получателя" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" />
                      </label>
                      {gPick && <p className="text-gold text-sm">Получатель: {gPick.name}</p>}
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
                      <p className="text-muted text-xs">{anon ? "Получатель увидит: «подарок от тайного поклонника». Магазин знает, кто даритель." : "Получатель увидит ваше имя."}</p>
                      <label className="text-muted text-xs flex flex-col gap-1">Открытка
                        <textarea value={gmsg} onChange={(e) => setGmsg(e.target.value)} rows={2} maxLength={300} placeholder="Пара тёплых слов" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite" />
                      </label>
                      <p className="text-muted text-xs">Адрес вы не вводите. После вашей оплаты получатель решит, принять ли подарок, и магазин сам уточнит у него адрес. Адрес увидит только магазин.</p>
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
                        {splitSizes(sel.sizes).map((z) => {
                          const left = sel.size_stock ? sel.size_stock[z] ?? 0 : 99;
                          return (
                            <button key={z} disabled={left <= 0} onClick={() => setO({ ...o, size: z })} className={`px-3.5 py-1.5 rounded-full text-sm border ${o.size === z ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"} ${left <= 0 ? "opacity-40 line-through" : ""}`}>{z}{sel.size_stock && left > 0 && left <= 3 ? ` · ${left}` : ""}</button>
                          );
                        })}
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
