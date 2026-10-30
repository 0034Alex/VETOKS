"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import LoadingScreen from "@/components/LoadingScreen";
import { apiPost } from "@/lib/authClient";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";

// Заявка на бизнес-страницу партнёра. Это не реклама: после одобрения в CRM открывается «Личный | Бизнес».
export default function BusinessApplyPage() {
  const [loading, setLoading] = useState(true);
  const [st, setSt] = useState<"none" | "lead" | "approved">("none");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [kind, setKind] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        window.location.href = "/login?redirect=/business-apply";
        return;
      }
      const { data } = await supabase.from("sponsors").select("status").eq("user_id", u.id).in("status", ["lead", "approved"]).limit(1);
      const s = (data as any[])?.[0]?.status;
      if (s === "approved") setSt("approved");
      else if (s === "lead") setSt("lead");
      setLoading(false);
    })();
  }, []);

  async function send() {
    if (busy) return;
    if (!name.trim() || !contact.trim()) return setErr("Укажите название и контакт.");
    setErr("");
    setBusy(true);
    const isMail = contact.includes("@");
    const text = `[Бизнес-страница] ${kind.trim() ? kind.trim() + ". " : ""}${msg.trim()}`;
    const r = await apiPost("/api/partner/apply", { name, phone: isMail ? "" : contact, email: isMail ? contact : "", message: text });
    setBusy(false);
    if (r?.ok) setSent(true);
    else if (r?.error === "already") setSt("lead");
    else setErr("Не получилось отправить. Попробуйте позже.");
  }

  const inp = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-base text-offwhite w-full";
  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-2">Бизнес-страница</h1>
        <p className="text-muted text-sm mb-5">
          Своя страница в VETOKS с синей галочкой «Официальный партнёр», каталогом, заказами, предложениями для зрителей и подарками участницам. Платить за это не нужно: заявку рассматривает команда VETOKS.
        </p>
        {loading && <LoadingScreen inline />}
        {!loading && st === "approved" && (
          <div className="bg-bgSurface border border-gold/50 rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm">Вы уже партнёр</p>
            <a href="/business" className="block mt-3 text-center bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Открыть бизнес-кабинет</a>
          </div>
        )}
        {!loading && st === "lead" && !sent && (
          <div className="bg-bgSurface border border-gold/50 rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm">Заявка на рассмотрении</p>
            <p className="text-muted text-xs mt-1">Когда мы её одобрим, вы получите уведомление, и в профиле появится переключатель «Личный | Бизнес».</p>
          </div>
        )}
        {!loading && sent && (
          <div className="bg-bgSurface border border-gold/50 rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm">Заявка отправлена</p>
            <p className="text-muted text-xs mt-1">Мы рассмотрим её и напишем вам уведомлением.</p>
          </div>
        )}
        {!loading && st === "none" && !sent && (
          <div className="flex flex-col gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название бизнеса *" maxLength={120} className={inp} />
            <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Телефон или почта *" maxLength={120} className={inp} />
            <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Чем занимаетесь (например, кафе, косметика)" maxLength={80} className={inp} />
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Расскажите о бизнесе (необязательно)" maxLength={1200} rows={4} className={inp} />
            {err && <p className="text-danger text-xs">{err}</p>}
            <button onClick={send} disabled={busy} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm disabled:opacity-40 mt-1">
              {busy ? "Отправляем..." : "Отправить заявку"}
            </button>
            <p className="text-muted text-[11px]">Для бизнес-аккаунта нужен подтверждённый номер телефона в вашем личном аккаунте.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
