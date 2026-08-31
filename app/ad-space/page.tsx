"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

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
};

type Mode = "tiers" | "capacity" | "seats";

const CATEGORIES: { key: string; label: string; mode: Mode }[] = [
  { key: "magazine", label: "Журнал", mode: "tiers" },
  { key: "homepage", label: "Главная (партнёры)", mode: "capacity" },
  { key: "banner_participants", label: "Баннер — Участницы", mode: "capacity" },
  { key: "banner_rating", label: "Баннер — Рейтинг", mode: "capacity" },
  { key: "jury", label: "Место в жюри", mode: "seats" },
  { key: "magazine_gf", label: "Гранд-финал · Журнал", mode: "tiers" },
  { key: "homepage_gf", label: "Гранд-финал · Главная", mode: "capacity" },
  { key: "banner_participants_gf", label: "Гранд-финал · Баннер Участницы", mode: "capacity" },
  { key: "banner_rating_gf", label: "Гранд-финал · Баннер Рейтинг", mode: "capacity" },
  { key: "jury_gf", label: "Гранд-финал · Жюри", mode: "seats" },
];

const DURATION_LABELS: Record<string, string> = {
  week: "на неделю",
  season: "на весь сезон",
};

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
          {Math.round(slot.full_price)} ₽
        </span>
        <span className="text-gold text-xl font-bold">
          {Math.round(slot.presale_price!)} ₽
        </span>
        <p className="text-muted text-[11px] mt-1">
          Предпродажа до {new Date(slot.presale_until!).toLocaleDateString("ru-RU")}
        </p>
      </div>
    );
  }
  return <span className="text-gold text-xl font-bold">{Math.round(slot.full_price)} ₽</span>;
}

export default function AdSpacePage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [allowed, setAllowed] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/ad-space");
        return;
      }

      const { data: sponsor } = await supabase
        .from("sponsors")
        .select("id")
        .eq("user_id", u.id)
        .eq("status", "approved")
        .maybeSingle();

      if (!sponsor) {
        setLoading(false);
        return;
      }
      setAllowed(true);

      const { data } = await supabase
        .from("ad_slots")
        .select(
          "id, category, slot_number, title, description, full_price, presale_price, presale_until, duration, status, capacity, sold_count, all_regions, ad_slot_regions(regions(name))"
        )
        .order("category", { ascending: true })
        .order("slot_number", { ascending: true });

      const mapped = (data as any[] ?? []).map((s) => ({
        ...s,
        region_names: (s.ad_slot_regions ?? [])
          .map((r: any) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
          .filter(Boolean),
      }));
      setSlots(mapped);
      setLoading(false);
    })();
  }, [router]);

  function isFull(s: Slot) {
    return s.capacity != null && s.sold_count >= s.capacity;
  }

  function openSlot(slot: Slot) {
    if (slot.status === "sold" || isFull(slot)) return;
    setSelected(slot);
    setName("");
    setPhone("");
    setMessage("");
    setSent(false);
  }

  async function submitRequest() {
    if (!selected || !name) return;
    setSending(true);
    await supabase.from("ad_slot_requests").insert({
      slot_id: selected.id,
      name,
      phone,
      message,
    });
    setSent(true);
    setSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Рекламный кабинет</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только одобренным партнёрам VETOKS. Если вы
          хотите разместить рекламу — оставьте заявку на странице «Стать
          партнёром», и мы откроем вам доступ.
        </p>
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
        Все разделы сразу — выберите подходящее место или формат.
      </p>

      {!loading &&
        CATEGORIES.map((cat) => {
          const catSlots = slots.filter((s) => s.category === cat.key);
          if (catSlots.length === 0) return null;

          return (
            <div key={cat.key} className="mb-8">
              <h2 className="text-lg font-semibold text-gold mb-3 px-6">
                {cat.label}
              </h2>

              {cat.mode === "seats" && (
                <div className="px-6 grid grid-cols-3 md:grid-cols-4 gap-3">
                  {catSlots.map((s) => {
                    const sold = s.status === "sold";
                    return (
                      <button
                        key={s.id}
                        onClick={() => openSlot(s)}
                        disabled={sold}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-semibold p-2 ${
                          sold
                            ? "bg-danger/20 border border-danger/40 text-danger/70 cursor-not-allowed"
                            : "bg-bgSurface border border-gold text-gold"
                        }`}
                      >
                        <span className="text-lg mb-1">{sold ? "✕" : "✦"}</span>
                        <span className="text-center leading-tight">Место {s.slot_number}</span>
                        {sold && <span className="text-[10px] mt-1">Занято</span>}
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
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-6"
          onClick={() => setSelected(null)}
        >
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
                Заявка отправлена! Мы свяжемся с вами для оплаты.
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
                  placeholder="Ваше имя / компания"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Телефон"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="Комментарий (необязательно)"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={submitRequest}
                  disabled={!name || sending}
                  className="bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm disabled:opacity-40 mt-1"
                >
                  {sending ? "Отправляем..." : "Оставить заявку на покупку"}
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
      )}

      <BottomNav />
    </main>
  );
}
