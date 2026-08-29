"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
};

const CATEGORIES: { key: string; label: string }[] = [
  { key: "magazine", label: "Журнал" },
  { key: "homepage", label: "Главная (партнёры)" },
  { key: "banner_participants", label: "Баннер — Участницы" },
  { key: "banner_rating", label: "Баннер — Рейтинг" },
  { key: "jury", label: "Место в жюри" },
  { key: "grand_final", label: "Гранд-финал" },
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

export default function AdSpacePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ad_slots")
        .select(
          "id, category, slot_number, title, description, full_price, presale_price, presale_until, duration, status"
        )
        .order("category", { ascending: true })
        .order("slot_number", { ascending: true });
      setSlots((data as Slot[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function openSlot(slot: Slot) {
    if (slot.status === "sold") return;
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

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-2 px-6">
        Рекламный кабинет
      </h1>
      <p className="text-muted text-sm mb-6 px-6">
        Все разделы сразу — свободные места светятся золотым, занятые тёмные.
      </p>

      {loading && <p className="text-muted text-center">Загрузка...</p>}

      {!loading &&
        CATEGORIES.map((cat) => {
          const catSlots = slots.filter((s) => s.category === cat.key);
          if (catSlots.length === 0) return null;
          return (
            <div key={cat.key} className="mb-8">
              <h2 className="text-lg font-semibold text-gold mb-3 px-6">
                {cat.label}
              </h2>
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
            </div>
          );
        })}

      {!loading && slots.length === 0 && (
        <p className="text-muted text-center px-6">
          Мест пока не выставлено.
        </p>
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
            <p className="text-muted text-xs mb-3">
              {DURATION_LABELS[selected.duration] ?? selected.duration}
            </p>
            {selected.description && (
              <p className="text-muted text-sm mb-3">{selected.description}</p>
            )}

            <div className="mb-4">
              {isPresaleActive(selected) ? (
                <div>
                  <span className="text-muted text-sm line-through mr-2">
                    {Math.round(selected.full_price)} ₽
                  </span>
                  <span className="text-gold text-xl font-bold">
                    {Math.round(selected.presale_price!)} ₽
                  </span>
                  <p className="text-muted text-[11px] mt-1">
                    Предпродажа до{" "}
                    {new Date(selected.presale_until!).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              ) : (
                <span className="text-gold text-xl font-bold">
                  {Math.round(selected.full_price)} ₽
                </span>
              )}
            </div>

            {sent ? (
              <p className="text-success text-sm text-center py-4">
                Заявка отправлена! Мы свяжемся с вами для оплаты.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
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
