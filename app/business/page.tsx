"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import BusinessPageView, { BizPublic } from "@/components/BusinessPageView";
import { apiPost, openSession } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { cleanImage } from "@/lib/imageClean";
import BusinessCatalogTab from "@/components/BusinessCatalogTab";
import SocialLinksEditor from "@/components/SocialLinksEditor";
import BusinessOrdersTab from "@/components/BusinessOrdersTab";
import BusinessOffersTab from "@/components/BusinessOffersTab";

const ERR: Record<string, string> = {
  need_phone: "Сначала подтвердите номер телефона в личном аккаунте.",
  no_slot: "Нет свободного места: у вас уже 3 аккаунта. Освободите слот или напишите в поддержку.",
  not_partner: "Бизнес-аккаунт доступен только подтверждённым партнёрам.",
  need_contact: "Чтобы включить страницу, укажите телефон или почту.",
  empty_name: "Введите название.",
};

// Кабинет партнёра: здесь он заполняет и включает свою страницу.
export default function BusinessCabinetPage() {
  const [st, setSt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"buy" | "book">("buy");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<any>(null);
  const [view, setView] = useState(false);
  const [tab, setTab] = useState<"page" | "catalog" | "orders" | "offers">("page");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [pv, setPv] = useState<{ products: any[]; offers: any[] }>({ products: [], offers: [] });

  async function load() {
    const r = await apiPost("/api/business/state");
    if (r?.error === "auth") {
      window.location.href = "/login?redirect=/business";
      return;
    }
    if (r?.ok) {
      setSt(r);
      if (r.profile) setF(r.profile);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    try {
      const q = new URLSearchParams(window.location.search);
      const t = q.get("tab");
      if (t === "orders" || t === "catalog" || t === "offers") setTab(t);
      if (q.get("o")) setOpenOrder(q.get("o"));
    } catch {}
  }, []);

  async function loadPreview() {
    if (!st?.profile?.id) return;
    const r = await apiPost("/api/business/page", { id: st.profile.id });
    if (r?.ok) setPv({ products: r.products ?? [], offers: r.offers ?? [] });
  }

  async function enable() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/enable", { mode });
    if (r?.ok && (await openSession(r.token_hash))) {
      window.location.replace("/profile");
      return;
    }
    setBusy(false);
    setMsg(ERR[r?.error] ?? "Не получилось. Попробуйте ещё раз.");
  }

  async function goBusiness() {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/accounts/switch", { targetId: st.businessUserId });
    if (r?.status === "ok" && (await openSession(r.token_hash))) {
      window.location.replace("/profile");
      return;
    }
    setBusy(false);
    setMsg("Не удалось переключиться. Попробуйте ещё раз.");
  }

  async function save(extra: Record<string, any> = {}) {
    if (!f) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/business/save", {
      name: f.name,
      category: f.category,
      about: f.about,
      logo_url: f.logo_url,
      cover_url: f.cover_url,
      hours: f.hours,
      address: f.address,
      phone: f.phone,
      email: f.email,
      site_url: f.site_url,
      quick_action: f.quick_action,
      show_call: f.show_call !== false,
      ...extra,
    });
    setBusy(false);
    if (r?.ok) {
      setF(r.profile);
      setMsg(extra.is_active === true ? "Магазин включён. Его видят все: откройте свой профиль, там магазин." : extra.is_active === false ? "Страница выключена." : "Сохранено.");
    } else setMsg(ERR[r?.error] ?? "Не получилось сохранить.");
  }

  async function upload(file: File, key: "logo_url" | "cover_url") {
    setMsg("");
    try {
      const up = await cleanImage(file);
      const ext = up.name.split(".").pop();
      const path = `${st?.businessUserId ?? "x"}-${Date.now()}-${key === "logo_url" ? "logo" : "cover"}.${ext}`;
      const { error } = await supabase.storage.from("participant-photos").upload(path, up);
      if (error) {
        setMsg("Ошибка загрузки: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("participant-photos").getPublicUrl(path);
      setF((o: any) => ({ ...o, [key]: data.publicUrl }));
    } catch (e: any) {
      setMsg(e?.message || "Не удалось обработать фото.");
    }
  }

  const set = (k: string) => (e: any) => setF((o: any) => ({ ...o, [k]: e.target.value }));
  const input = "w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto px-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-semibold text-offwhite">{st?.isBusinessNow ? "Настройки магазина" : "Бизнес-аккаунт"}</h1>
          {st?.isBusinessNow && (
            <a href="/profile" className="text-gold text-sm border border-gold/60 rounded-full px-3.5 py-1.5">← В профиль</a>
          )}
        </div>

        {loading && <LoadingScreen inline />}

        {!loading && !st?.eligible && (
          <p className="text-muted text-sm">Бизнес-аккаунт доступен партнёрам после подтверждения заявки. Оставить заявку можно в разделе «Партнёры».</p>
        )}

        {!loading && st?.eligible && !st.isBusinessNow && (
          <div className="bg-bgSurface border border-gold/50 rounded-2xl p-5">
            <p className="text-offwhite font-semibold">{st.hasBusiness ? "Ваш бизнес-аккаунт уже создан" : "Включить бизнес-аккаунт"}</p>
            <p className="text-muted text-sm mt-2">
              Это отдельный аккаунт для вашего бизнеса: своя страница, синяя галочка «Официальный партнёр VETOKS», каталог, заказы и предложения для зрителей. Он занимает один из трёх мест на ваш номер. Личный аккаунт остаётся как есть, переключаться можно в любой момент через «Мои аккаунты» в профиле.
            </p>
            {st.hasBusiness ? (
              <button onClick={goBusiness} disabled={busy} className="w-full mt-4 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
                {busy ? "Переходим..." : "Перейти в бизнес-аккаунт"}
              </button>
            ) : (
              <>
                <p className="text-offwhite text-sm font-semibold mt-4">Что у вас?</p>
                <div className="flex flex-col gap-2 mt-2">
                  {([["buy", "🛍 Магазин", "Продаёте товары. Клиенты нажимают «Купить»."], ["book", "📅 Услуги", "Записываете или бронируете. Клиенты нажимают «Забронировать»."]] as const).map(([k, l, h]) => (
                    <button key={k} onClick={() => setMode(k)} className={`text-left rounded-xl px-4 py-2.5 border ${mode === k ? "border-gold bg-gold/10" : "border-muted"}`}>
                      <span className="text-offwhite text-sm font-semibold block">{l}</span>
                      <span className="text-muted text-xs">{h}</span>
                    </button>
                  ))}
                </div>
                <p className="text-muted text-xs mt-2">Выбор можно поменять позже в настройках.</p>
                <button onClick={enable} disabled={busy} className="w-full mt-4 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
                  {busy ? "Создаём..." : "Включить бизнес-аккаунт"}
                </button>
              </>
            )}
            {msg && <p className="text-danger text-sm mt-3">{msg}</p>}
          </div>
        )}

        {!loading && st?.isBusinessNow && f && (
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {([["page", "Страница"], ["catalog", "Каталог"], ["orders", "Заказы"], ["offers", "Предложения"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setOpenOrder(null); }} className={`px-4 py-2 rounded-full text-sm border whitespace-nowrap ${tab === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
            ))}
          </div>
        )}
        {!loading && st?.isBusinessNow && f && tab === "catalog" && <BusinessCatalogTab cur={st.cur ?? "₴"} userId={st.businessUserId} />}
        {!loading && st?.isBusinessNow && f && tab === "orders" && <BusinessOrdersTab key={openOrder ?? "list"} mode="biz" cur={st.cur ?? "₴"} openId={openOrder} />}
        {!loading && st?.isBusinessNow && f && tab === "offers" && <BusinessOffersTab />}

        {!loading && st?.isBusinessNow && f && tab === "page" && (
          <div className="flex flex-col gap-4">
            <div className={`rounded-xl border p-4 ${f.is_active ? "border-success/50 bg-success/10" : "border-gold/50 bg-bgSurface"}`}>
              <p className="text-offwhite text-sm font-semibold">{f.is_active ? "Страница включена, её видят все" : "Страница пока скрыта от зрителей"}</p>
              <p className="text-muted text-xs mt-1">
                {f.is_hidden ? "Страница скрыта администрацией VETOKS. Напишите в поддержку." : f.verified ? "Синяя галочка «Официальный партнёр VETOKS» у вас есть." : "Синяя галочка снята администрацией."}
              </p>
              {f.is_active && (
                <a href="/profile" className="inline-block mt-3 mr-2 px-5 py-2 rounded-full text-sm font-semibold bg-gold text-bgPrimary">Открыть мой магазин</a>
              )}
              <button
                onClick={() => save({ is_active: !f.is_active })}
                disabled={busy}
                className={`mt-3 px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-50 ${f.is_active ? "border border-muted text-offwhite" : "bg-gold text-bgPrimary"}`}
              >
                {f.is_active ? "Выключить страницу" : "Активировать страницу"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PhotoPick label="Логотип" url={f.logo_url} onFile={(x) => upload(x, "logo_url")} square />
              <PhotoPick label="Обложка" url={f.cover_url} onFile={(x) => upload(x, "cover_url")} />
            </div>

            <label className="text-muted text-xs flex flex-col gap-1">Название<input className={input} value={f.name ?? ""} onChange={set("name")} maxLength={80} /></label>
            <label className="text-muted text-xs flex flex-col gap-1">Чем занимаетесь (например, «Косметика» или «Кафе»)<input className={input} value={f.category ?? ""} onChange={set("category")} maxLength={60} /></label>
            <label className="text-muted text-xs flex flex-col gap-1">О вас<textarea className={input} rows={4} value={f.about ?? ""} onChange={set("about")} maxLength={1500} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-muted text-xs flex flex-col gap-1">Часы работы<input className={input} value={f.hours ?? ""} onChange={set("hours")} placeholder="10:00–20:00" /></label>
              <label className="text-muted text-xs flex flex-col gap-1">Телефон<input className={input} value={f.phone ?? ""} onChange={set("phone")} inputMode="tel" /></label>
            </div>
            <label className="text-muted text-xs flex flex-col gap-1">Адрес<input className={input} value={f.address ?? ""} onChange={set("address")} /></label>
            <label className="text-muted text-xs flex flex-col gap-1">Почта<input className={input} value={f.email ?? ""} onChange={set("email")} inputMode="email" /></label>
            <label className="text-muted text-xs flex flex-col gap-1">Сайт магазина (одна ссылка, покажется в контактах)<input className={input} value={f.site_url ?? ""} onChange={set("site_url")} /></label>
            <label className="flex items-start gap-2 text-offwhite text-sm"><input type="checkbox" className="mt-1" checked={f.show_call !== false} onChange={(e) => setF((o: any) => ({ ...o, show_call: e.target.checked }))} /><span>Показывать кнопку «Позвонить»<span className="block text-muted text-xs">Если выключить, телефон и кнопка не видны никому, клиенты смогут только написать вам в чат.</span></span></label>
            {st?.businessUserId && <SocialLinksEditor userId={st.businessUserId} />}

            <div>
              <p className="text-muted text-xs mb-1">Тип страницы (какая кнопка у клиентов)</p>
              <div className="flex gap-2">
                {[["buy", "🛍 Магазин · Купить"], ["book", "📅 Услуги · Забронировать"]].map(([k, l]) => (
                  <button key={k} onClick={() => setF((o: any) => ({ ...o, quick_action: k }))} className={`px-4 py-2 rounded-full text-sm border ${f.quick_action === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => save()} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm disabled:opacity-50">
              {busy ? "Сохраняем..." : "Сохранить"}
            </button>
            {msg && <p className="text-gold text-sm">{msg}</p>}

            <button onClick={() => { if (!view) loadPreview(); setView((v) => !v); }} className="border border-gold text-gold rounded-full py-2.5 text-sm">
              {view ? "Скрыть предпросмотр" : "Посмотреть как зритель"}
            </button>
            {view && (
              <div className="border border-muted rounded-2xl overflow-hidden bg-bgPrimary">
                <BusinessPageView preview products={pv.products} offers={pv.offers} cur={st.cur ?? "₴"} p={{ ...(f as BizPublic), category: f.category ?? "", about: f.about ?? "", hours: f.hours ?? "", address: f.address ?? "", phone: f.phone ?? "", email: f.email ?? "", site_url: f.site_url ?? "" }} />
              </div>
            )}

          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

function PhotoPick({ label, url, onFile, square }: { label: string; url: string | null; onFile: (f: File) => void; square?: boolean }) {
  return (
    <label className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer">
      <div className={`${square ? "w-20 h-20" : "w-full h-20"} rounded-xl bg-bgPrimary overflow-hidden flex items-center justify-center text-muted text-xs`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          "Нет фото"
        )}
      </div>
      <span className="text-gold text-xs">{url ? "Заменить" : "Загрузить"} {label.toLowerCase()}</span>
      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </label>
  );
}
