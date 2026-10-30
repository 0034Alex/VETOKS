"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyCountry, orCountry } from "@/lib/myCountry";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/authClient";
import { cleanImage } from "@/lib/imageClean";
import { payAdRequest } from "@/lib/adPayClient";
import { adHintFor } from "@/lib/adHints";

type Slot = {
  id: string;
  category: string;
  slot_number: number;
  title: string;
  description: string | null;
  full_price: number;
  presale_price: number | null;
  presale_until: string | null;
  duration: string;
  status: string;
  capacity: number | null;
  sold_count: number;
  all_regions: boolean;
  region_names: string[];
  region_ids?: string[];
};

type Mode = "tiers" | "capacity" | "seats";

const CATEGORIES: { key: string; label: string; mode: Mode }[] = [
  { key: "magazine", label: "Журнал", mode: "tiers" },
  { key: "homepage", label: "Главная (партнёры)", mode: "capacity" },
  { key: "banner_participants", label: "Баннер — Участницы", mode: "capacity" },
  { key: "banner_rating", label: "Баннер — Рейтинг", mode: "capacity" },
  { key: "banner_partner_page", label: "Баннер — Страница «Стать партнёром»", mode: "capacity" },
  { key: "jury", label: "Жюри от спонсоров", mode: "seats" },
  { key: "magazine_gf", label: "Гранд-финал · Журнал", mode: "tiers" },
  { key: "homepage_gf", label: "Гранд-финал · Главная", mode: "capacity" },
  { key: "banner_participants_gf", label: "Гранд-финал · Баннер Участницы", mode: "capacity" },
  { key: "banner_rating_gf", label: "Гранд-финал · Баннер Рейтинг", mode: "capacity" },
  { key: "jury_gf", label: "Гранд-финал · Жюри от спонсоров", mode: "seats" },
];

const DURATION_LABELS: Record<string, string> = {
  week: "на неделю",
  season: "на весь сезон",
};

let CUR = "₴";

function isPresaleActive(slot: Slot) {
  return (
    slot.presale_price != null &&
    slot.presale_until != null &&
    new Date(slot.presale_until) > new Date()
  );
}

function PriceBlock({ slot }: { slot: Slot }) {
  if (isPresaleActive(slot)) {
    return (
      <div>
        <span className="text-muted text-sm line-through mr-2">
          {Math.round(slot.full_price)} {CUR}
        </span>
        <span className="text-gold text-xl font-bold">
          {Math.round(slot.presale_price!)} {CUR}
        </span>
        <p className="text-muted text-[11px] mt-1">
          Предпродажа до {new Date(slot.presale_until!).toLocaleDateString("ru-RU")}
        </p>
      </div>
    );
  }
  return <span className="text-gold text-xl font-bold">{Math.round(slot.full_price)} {CUR}</span>;
}

export default function AdSpacePage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadContact, setLeadContact] = useState("");
  const [leadMsg, setLeadMsg] = useState("");
  const [leadErr, setLeadErr] = useState("");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  async function sendLead() {
    if (leadBusy) return;
    if (!leadName.trim() || !leadContact.trim()) return setLeadErr("Укажите название и контакт.");
    setLeadErr("");
    setLeadBusy(true);
    const isMail = leadContact.includes("@");
    const r = await apiPost("/api/partner/apply", { name: leadName, phone: isMail ? "" : leadContact, email: isMail ? leadContact : "", message: "[Реклама] " + leadMsg });
    setLeadBusy(false);
    if (r?.ok) setLeadSent(true);
    else setLeadErr("Не получилось отправить. Попробуйте позже.");
  }

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [myShopUserId, setMyShopUserId] = useState<string | null>(null);
  useEffect(() => {
    apiPost("/api/business/state").then((r: any) => r?.ok && r.hasBusiness && setMyShopUserId(r.businessUserId ?? null));
  }, []);
  const [adText, setAdText] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formErr, setFormErr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<{ id: string; status: string; title: string; price: number | null; note: string | null; created_at: string }[]>([]);
  const [cur, setCur] = useState("₴");
  const [payMsg, setPayMsg] = useState("");
  const [paying, setPaying] = useState<string | null>(null);

  async function loadMine() {
    const r = await apiPost("/api/ad/mine");
    if (r?.ok) {
      setMine(r.items ?? []);
      if (r.currency) setCur(r.currency);
    }
  }

  async function cancelRequest(id: string) {
    if (!window.confirm("Отменить эту заявку?")) return;
    setPayMsg("");
    const r = await apiPost("/api/ad/cancel", { id });
    setPayMsg(r?.ok ? "Заявка отменена." : "Не получилось отменить заявку.");
    await loadMine();
  }

  async function payRequest(id: string) {
    setPaying(id);
    setPayMsg("");
    const r = await payAdRequest(id);
    setPayMsg(r.message + (r.test ? " (тест: баланс пополнен на 1000)" : ""));
    setPaying(null);
    await loadMine();
  }

  const [reserved, setReserved] = useState<Record<string, "mine" | "other">>({});
  async function loadReserved() {
    const r = await apiPost("/api/ad/reserved");
    if (r?.ok) setReserved(r.reserved ?? {});
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/ad-space");
        return;
      }

      // Места и цены видят только рекламодатели: пришедшие по ссылке участницы, одобренные партнёры и те, у кого уже есть заявка.
      let ok = !!u.is_advertiser;
      if (!ok) {
        const { data: sp0 } = await supabase.from("sponsors").select("id").eq("user_id", u.id).eq("status", "approved").maybeSingle();
        ok = !!sp0;
      }
      if (!ok) {
        const mine0 = await apiPost("/api/ad/mine");
        ok = !!mine0?.ok && (mine0.items ?? []).length > 0;
      }
      setAllowed(ok);
      if (!ok) {
        setLoading(false);
        return;
      }
      loadMine();
      loadReserved();

      const mc = await getMyCountry();
      if (mc.countryId) {
        const { data: cy } = await supabase.from("countries").select("currency_symbol").eq("id", mc.countryId).maybeSingle();
        if (cy?.currency_symbol) CUR = cy.currency_symbol as string;
      }
      // Область рекламодателя: из его карточки партнёра, иначе из профиля.
      const { data: spRow } = await supabase.from("sponsors").select("region_id").eq("user_id", u.id).eq("status", "approved").maybeSingle();
      const myRegion: string | null = (spRow as any)?.region_id ?? u.region_id ?? null;
      const { data } = await orCountry(
        supabase
          .from("ad_slots")
          .select(
            "id, category, slot_number, title, description, full_price, presale_price, presale_until, duration, status, capacity, sold_count, all_regions, ad_slot_regions(region_id, regions(name))"
          )
          .order("category", { ascending: true })
          .order("slot_number", { ascending: true }),
        mc.countryId
      );

      // Обычные места — только своей области. Баннеры (в том числе гранд-финал) —
      // своей области и «вся страна». Если область не известна — показываем всё по стране.
      const visible = ((data as any[]) ?? []).filter((s) => {
        if (!myRegion) return true;
        const mine = (s.ad_slot_regions ?? []).some((r: any) => r.region_id === myRegion);
        if (!s.all_regions) return mine;
        return String(s.category).startsWith("banner_");
      });

      const mapped = visible.map((s) => ({
        ...s,
        region_names: (s.ad_slot_regions ?? [])
          .map((r: any) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
          .filter(Boolean),
      }));
      setSlots(mapped);
      setLoading(false);
    })();
  }, [router]);

  function isSeat(s: Slot) {
    return ["magazine", "magazine_gf", "jury", "jury_gf"].includes(String(s.category));
  }

  function isFull(s: Slot) {
    return s.capacity != null && s.sold_count >= s.capacity;
  }

  function openSlot(slot: Slot) {
    if (slot.status === "sold" || isFull(slot)) return;
    if (reserved[slot.id] && isSeat(slot)) return;
    setSelected(slot);
    setName("");
    setPhone("");
    setEmail("");
    setLinkUrl("");
    setAdText("");
    setMessage("");
    setFile(null);
    setFormErr("");
    setSent(false);
  }

  async function submitRequest() {
    if (!selected || !name.trim()) return;
    if (!phone.trim() && !email.trim()) {
      setFormErr("Укажите телефон или почту для связи.");
      return;
    }
    const isJury = String(selected.category).replace(/_gf$/, "") === "jury";
    if (!isJury && !file) {
      setFormErr("Загрузите картинку — она пойдёт в рекламу после одобрения и оплаты.");
      return;
    }
    if (!isJury && !linkUrl.trim()) {
      setFormErr("Укажите ссылку, куда вести клиентов.");
      return;
    }
    setSending(true);
    setFormErr("");
    try {
      const fd = new FormData();
      fd.set("slotId", selected.id);
      fd.set("company", name);
      fd.set("phone", phone);
      fd.set("email", email);
      fd.set("linkUrl", linkUrl);
      fd.set("adText", adText);
      fd.set("comment", message);
      if (file) fd.set("file", await cleanImage(file, 1600));
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/ad/request", {
        method: "POST",
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
        body: fd,
      });
      const r = await res.json().catch(() => ({}));
      if (r?.ok) {
        setSent(true);
        loadMine();
      } else {
        const m: Record<string, string> = {
          already: "Вы уже отправили заявку на это место.",
          slot_full: "Это место уже занято.",
          image_big: "Картинка слишком большая — не больше 3 МБ.",
          bad_image: "Файл должен быть картинкой.",
          empty_contact: "Укажите телефон или почту для связи.",
          need_image: "Загрузите картинку для рекламы.",
          need_link: "Укажите ссылку, куда вести клиентов.",
        };
        setFormErr(m[r?.error] ?? "Не получилось отправить. Попробуйте ещё раз.");
      }
    } catch (e: any) {
      setFormErr(e?.message || "Не получилось отправить. Попробуйте ещё раз.");
    }
    setSending(false);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <h1 className="text-2xl font-semibold text-gold mb-4">Рекламный кабинет</h1>
        <p className="text-muted max-w-sm mb-5">
          Реклама в VETOKS доступна по приглашению. Если хотите разместить рекламу, оставьте заявку, и мы откроем вам доступ.
        </p>
        {leadSent ? (
          <p className="text-gold text-sm">Заявка отправлена. Мы свяжемся с вами.</p>
        ) : (
          <div className="w-full max-w-sm flex flex-col gap-2 text-left">
            <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Название бизнеса или имя" maxLength={120} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-base text-offwhite" />
            <input value={leadContact} onChange={(e) => setLeadContact(e.target.value)} placeholder="Телефон или почта" maxLength={120} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-base text-offwhite" />
            <textarea value={leadMsg} onChange={(e) => setLeadMsg(e.target.value)} placeholder="Что хотите рекламировать" maxLength={1500} rows={3} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-base text-offwhite" />
            {leadErr && <p className="text-danger text-xs">{leadErr}</p>}
            <button onClick={sendLead} disabled={leadBusy} className="bg-gold text-bgPrimary font-semibold py-2.5 rounded-full text-sm disabled:opacity-40">
              {leadBusy ? "..." : "Отправить заявку"}
            </button>
          </div>
        )}
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-2 px-6">
        Рекламный кабинет
      </h1>
      <p className="text-muted text-sm mb-6 px-6">
        Выберите место, заполните данные и отправьте заявку. После одобрения вы получите уведомление и оплатите с баланса.
      </p>

      <a href="/business-apply" className="mx-6 mb-6 flex items-center justify-between gap-3 rounded-xl border border-gold bg-gold/10 p-4">
        <span>
          <span className="block text-offwhite font-semibold text-sm">🏪 Открыть бизнес-страницу</span>
          <span className="block text-muted text-xs mt-0.5">Своя страница, синяя галочка, каталог, заказы. Это не реклама и платить не нужно.</span>
        </span>
        <span className="text-gold text-lg">›</span>
      </a>

      {mine.length > 0 && (
        <div className="mx-6 mb-6 rounded-xl border border-gold/50 bg-bgSurface p-4">
          <p className="text-gold font-semibold text-sm mb-2">Мои заявки</p>
          {mine.map((m) => (
            <div key={m.id} className="border-t border-muted/40 py-2 first:border-t-0">
              <p className="text-offwhite text-sm">{m.title}</p>
              {m.status === "new" && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-muted text-xs">⏳ На рассмотрении</p>
                  <button onClick={() => cancelRequest(m.id)} className="text-danger text-xs underline">Отменить заявку</button>
                </div>
              )}
              {m.status === "approved" && (
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-success text-xs">✅ Одобрено · к оплате {Math.round(Number(m.price ?? 0))} {cur}</p>
                  <button
                    onClick={() => payRequest(m.id)}
                    disabled={paying === m.id}
                    className="bg-gold text-bgPrimary font-semibold px-4 py-1.5 rounded-full text-xs disabled:opacity-50"
                  >
                    {paying === m.id ? "Оплата..." : "Оплатить"}
                  </button>
                </div>
              )}
              {m.status === "approved" && (
                <button onClick={() => cancelRequest(m.id)} className="text-danger text-xs underline mt-1">Отменить заявку</button>
              )}
              {m.status === "paying" && <p className="text-muted text-xs">Идёт оплата…</p>}
              {m.status === "paid" && <p className="text-success text-xs">💳 Оплачено — место за вами</p>}
              {m.status === "rejected" && <p className="text-danger text-xs">✖ Отклонено{m.note ? `: ${m.note}` : ""}</p>}
              {(m.status === "contacted" || m.status === "closed") && <p className="text-muted text-xs">Обрабатывается менеджером</p>}
            </div>
          ))}
          {payMsg && <p className="text-gold text-xs mt-2">{payMsg}</p>}
        </div>
      )}

      {!loading &&
        CATEGORIES.map((cat) => {
          const catSlots = slots.filter((s) => s.category === cat.key);
          if (catSlots.length === 0) return null;

          const firstGf = cat.key === "magazine_gf" || (!slots.some((x) => x.category === "magazine_gf") && cat.key.endsWith("_gf") && CATEGORIES.filter((c) => c.key.endsWith("_gf") && slots.some((x) => x.category === c.key))[0]?.key === cat.key);
          return (
            <div key={cat.key} className="mb-8">
              {firstGf && (
                <div className="mx-6 mb-5 rounded-xl border border-gold/60 bg-gold/10 p-3">
                  <p className="text-gold font-semibold text-sm">🏆 Гранд-финал</p>
                  <p className="text-muted text-xs">Отдельные места на финал сезона — цена другая, чем в обычные недели. Можно выбрать свою область или всю страну.</p>
                </div>
              )}
              <h2 className="text-lg font-semibold text-gold mb-3 px-6">
                {cat.label}
              </h2>

              {cat.mode === "seats" && (
                <div className="px-6 grid grid-cols-3 md:grid-cols-4 gap-3">
                  {catSlots.map((s) => {
                    const sold = s.status === "sold";
                    const rv = !sold ? reserved[s.id] : undefined;
                    return (
                      <button
                        key={s.id}
                        onClick={() => openSlot(s)}
                        disabled={sold || !!rv}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold p-2 ${
                          sold
                            ? "bg-danger/20 border border-danger/40 text-danger/70 cursor-not-allowed"
                            : rv
                            ? "bg-bgSurface border border-dashed border-gold/60 text-gold/70 cursor-not-allowed"
                            : "bg-bgSurface border border-gold text-gold"
                        }`}
                      >
                        <span className="text-lg mb-1">{sold ? "✕" : rv ? "⏳" : "✦"}</span>
                        <span className="text-center leading-tight">Место {s.slot_number}</span>
                        {sold && <span className="text-[10px] mt-1">Занято</span>}
                        {rv && <span className="text-[10px] mt-1">{rv === "mine" ? "Ваша бронь" : "Бронь места"}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {cat.mode === "tiers" && (
                <div className="px-6 flex gap-3 overflow-x-auto">
                  {catSlots.map((s) => {
                    const sold = s.status === "sold";
                    return (
                      <button
                        key={s.id}
                        onClick={() => openSlot(s)}
                        disabled={sold}
                        className={`flex-shrink-0 w-40 rounded-xl p-4 text-left ${
                          sold
                            ? "bg-danger/10 border border-danger/30"
                            : "bg-bgSurface border border-gold"
                        }`}
                      >
                        <p className="text-offwhite text-sm font-semibold mb-1">
                          Показ {s.slot_number} раз{s.slot_number === 1 ? "" : "а"}
                        </p>
                        <p className="text-gold text-[10px] mb-1">
                          📍 {s.all_regions ? "Все регионы" : (s.region_names ?? [])[0] ?? "—"}
                          {!s.all_regions && (s.region_names ?? []).length > 1 && " +ещё"}
                        </p>
                        {sold ? (
                          <p className="text-danger text-xs">Занято</p>
                        ) : (
                          <PriceBlock slot={s} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {cat.mode === "capacity" &&
                catSlots.map((s) => {
                  const full = isFull(s);
                  const cap = s.capacity ?? 0;
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSlot(s)}
                      disabled={full}
                      className={`mx-6 w-[calc(100%-3rem)] rounded-xl p-4 text-left ${
                        full
                          ? "bg-danger/10 border border-danger/30"
                          : "bg-bgSurface border border-gold"
                      }`}
                    >
                      <p className="text-offwhite text-sm font-semibold mb-1">{s.title}</p>
                      <p className="text-gold text-[10px] mb-1">
                        📍 {s.all_regions ? "Все регионы" : (s.region_names ?? [])[0] ?? "—"}
                        {!s.all_regions && (s.region_names ?? []).length > 1 && " +ещё"}
                      </p>
                      {s.description && (
                        <p className="text-muted text-xs mb-2">{s.description}</p>
                      )}
                      {full ? (
                        <p className="text-danger text-xs mb-2">
                          Все места выкуплены ({s.sold_count} из {cap})
                        </p>
                      ) : (
                        <>
                          <div className="mb-2">
                            <PriceBlock slot={s} />
                          </div>
                          <div className="w-full bg-black/40 rounded-full h-1.5 mb-1">
                            <div
                              className="bg-gold rounded-full h-1.5"
                              style={{ width: `${cap ? (s.sold_count / cap) * 100 : 0}%` }}
                            />
                          </div>
                          <p className="text-muted text-[11px]">
                            Занято {s.sold_count} из {cap}
                          </p>
                        </>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}

      {!loading && slots.length === 0 && (
        <p className="text-muted text-center px-6">Мест пока не выставлено.</p>
      )}

      {selected && (
        <div
          className="fixed inset-0 bg-black/80 overflow-y-auto overscroll-contain z-[110]"
          style={{ WebkitOverflowScrolling: "touch", paddingBottom: 0 }}
          onClick={() => setSelected(null)}
        >
         <div className="min-h-full flex items-start justify-center px-6 pt-8" style={{ paddingBottom: "calc(48px + env(safe-area-inset-bottom, 0px))" }}>
          <div
            className="bg-bgSurface border border-gold/40 rounded-2xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gold text-xs tracking-widest mb-1">
              {CATEGORIES.find((c) => c.key === selected.category)?.label}
            </p>
            <h3 className="text-offwhite text-lg font-semibold mb-1">
              {selected.title}
            </h3>
            <p className="text-muted text-xs mb-1">
              {DURATION_LABELS[selected.duration] ?? selected.duration}
            </p>
            <p className="text-gold text-xs mb-3">
              📍{" "}
              {selected.all_regions
                ? "Все регионы"
                : (selected.region_names ?? []).join(", ") || "регион не указан"}
            </p>
            {selected.description && (
              <p className="text-muted text-sm mb-3">{selected.description}</p>
            )}

            <div className="mb-4">
              <PriceBlock slot={selected} />
            </div>

            {sent ? (
              <p className="text-success text-sm text-center py-4">
                Заявка отправлена на рассмотрение! Когда мы её одобрим, вы получите уведомление и сможете оплатить в «Мои заявки».
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-muted text-[11px] mb-1">
                  Оформляете размещение{" "}
                  {selected.all_regions
                    ? "на всю страну"
                    : `только в: ${(selected.region_names ?? []).join(", ") || "—"}`}
                  .
                </p>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Компания или имя *"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Телефон *"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Почта"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Ссылка, куда вести клиентов *"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                {myShopUserId && (
                  <button
                    type="button"
                    onClick={() => setLinkUrl(`${window.location.origin}/u/${myShopUserId}`)}
                    className="text-left text-gold text-xs border border-gold/60 rounded-lg px-3 py-2"
                  >
                    🏪 Вести баннер в мой магазин на платформе
                  </button>
                )}
                <textarea
                  value={adText}
                  onChange={(e) => setAdText(e.target.value)}
                  rows={3}
                  placeholder="Текст рекламы"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                {(() => {
                  const h = adHintFor(selected.category);
                  return h ? (
                    <div className="bg-bgPrimary border border-gold/40 rounded-lg p-3 text-[11px]">
                      <p className="text-gold font-semibold mb-1">Какой материал нужен</p>
                      <p className="text-offwhite mb-1">📐 {h.size}</p>
                      <p className="text-muted mb-1">📍 {h.where}</p>
                      <p className="text-muted">💡 {h.tips}</p>
                    </div>
                  ) : null;
                })()}
                <label className="text-muted text-xs">
                  Картинка или логотип * (до 3 МБ)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block mt-1 text-xs text-offwhite"
                  />
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Комментарий (необязательно)"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                {formErr && <p className="text-danger text-xs">{formErr}</p>}
                <button
                  onClick={submitRequest}
                  disabled={!name || sending}
                  className="bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm disabled:opacity-40 mt-1"
                >
                  {sending ? "Отправляем..." : "Отправить на рассмотрение"}
                </button>
              </div>
            )}

            <button
              onClick={() => setSelected(null)}
              className="w-full text-muted text-xs mt-3"
            >
              Закрыть
            </button>
          </div>
         </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
