"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function PartnerPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const { error } = await supabase.from("sponsors").insert({
      name,
      status: "lead",
      contact_info: { phone, email, message },
    });

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
