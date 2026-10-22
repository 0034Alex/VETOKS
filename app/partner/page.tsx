"use client";

import { useEffect, useState } from "react";
import { getMyCountry } from "@/lib/myCountry";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import PromoBannerCarousel from "@/components/PromoBannerCarousel";

export default function PartnerPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );
  const [regionId, setRegionId] = useState("");
  const [regionOpts, setRegionOpts] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const mc = await getMyCountry();
      const u = await getCurrentUser();
      if (mc.regionIds.length) {
        const { data } = await supabase.from("regions").select("id, name").in("id", mc.regionIds).order("name");
        setRegionOpts((data as any[]) ?? []);
      }
      if (u?.region_id) setRegionId(u.region_id);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const r = await apiPost("/api/partner/apply", { name, phone, email, message, regionId: regionId || null });
    const error = !r?.ok;
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
        <h1 className="text-2xl font-semibold text-gold mb-4">
          Заявка отправлена!
        </h1>
        <p className="text-muted">Мы свяжемся с вами по поводу партнёрства.</p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <PromoBannerCarousel placement="partner_page" />
      <div className="px-6 flex flex-col items-center">
        <div className="w-full max-w-sm bg-gradient-to-br from-[#7C3AED] to-[#EC4899] rounded-2xl p-6 mb-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            🤝 Стать партнёром VETOKS
          </h1>
          <p className="text-white/90 text-sm">
            Спонсируйте сезон, предложите свои услуги участницам или
            расскажите о своём бренде нашей аудитории.
          </p>
        </div>

        <p className="text-muted text-xs text-center max-w-sm mb-2">
          Оставьте заявку, и мы свяжемся с вами, чтобы обсудить условия:
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col gap-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Имя / название компании"
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон"
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Почта"
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
          />
          {regionOpts.length > 0 && (
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
              required
            >
              <option value="">Область, где вы работаете</option>
              {regionOpts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Расскажите, кто вы и что предлагаете"
            rows={5}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {status === "loading" ? "Отправляем..." : "Отправить заявку"}
          </button>
          {status === "error" && (
            <p className="text-danger text-sm text-center">
              Ошибка отправки, попробуйте ещё раз.
            </p>
          )}
        </form>
      </div>
      <BottomNav />
    </main>
  );
}
