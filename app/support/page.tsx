"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
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

  const [userId, setUserId] = useState<string | null>(null);
  const [mine, setMine] = useState<any[]>([]);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("topic") === "locked") {
        const id = (q.get("id") || "").slice(0, 80);
        setMessage(`Мой вход заблокирован после неверных попыток.${id ? " Логин: " + id + "." : ""} Прошу помочь восстановить доступ.`);
      }
    } catch {
      /* ignore */
    }
    (async () => {
      const u = await getCurrentUser();
      if (!u) return;
      setUserId(u.id);
      setName((n) => n || (u as any).first_name || "");
      const { data } = await supabase
        .from("support_requests")
        .select("id, message, status, reply, replied_at, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setMine(data ?? []);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const { error } = await supabase.from("support_requests").insert({
      name,
      phone,
      email,
      message,
      user_id: userId,
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

        {mine.length > 0 && (
          <div className="w-full max-w-sm mt-8">
            <h2 className="text-offwhite font-semibold mb-3">Ваши обращения</h2>
            <div className="flex flex-col gap-3">
              {mine.map((m) => (
                <div key={m.id} className="bg-bgSurface border border-muted rounded-xl p-3">
                  <p className="text-muted text-[10px] mb-1">
                    {new Date(m.created_at).toLocaleDateString("ru-RU")} ·{" "}
                    {m.status === "done" ? "закрыто" : m.status === "in_progress" ? "в работе" : "отправлено"}
                  </p>
                  <p className="text-offwhite text-sm whitespace-pre-wrap">{m.message}</p>
                  {m.reply && (
                    <div className="border-l-2 border-gold pl-3 mt-2">
                      <p className="text-gold text-[10px]">Ответ поддержки</p>
                      <p className="text-offwhite text-sm whitespace-pre-wrap">{m.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
