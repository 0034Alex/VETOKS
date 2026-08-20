"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function SupportPage() {
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

    const { error } = await supabase.from("support_requests").insert({
      name,
      phone,
      email,
      message,
    });

    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-28">
        <h1 className="text-2xl font-semibold text-gold mb-4">
          Заявка отправлена!
        </h1>
        <p className="text-muted">Мы свяжемся с вами в ближайшее время.</p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-offwhite mb-6 text-center">
          Помощь и поддержка
        </h1>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm flex flex-col gap-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
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
            placeholder="Опишите вопрос или нужную помощь"
            rows={5}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3"
            required
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50"
          >
            {status === "loading" ? "Отправляем..." : "Отправить"}
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
