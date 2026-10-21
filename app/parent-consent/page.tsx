"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/authClient";

// Для категории TEEN: родитель даёт согласие через Telegram-бота.
export default function ParentConsentPage() {
  const [loading, setLoading] = useState(true);
  const [needed, setNeeded] = useState(false);
  const [approved, setApproved] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const r = await apiPost("/api/parent/start", { action: "status" });
    if (r?.ok) {
      setNeeded(!!r.needed);
      setApproved(!!r.approved);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  async function getLink() {
    setBusy(true);
    const r = await apiPost("/api/parent/start", { action: "link" });
    if (r?.link) setLink(r.link);
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ссылку можно выделить вручную */
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-md mx-auto px-6">
        <h1 className="text-xl font-semibold text-gold mb-3">Согласие родителей</h1>
        {!needed ? (
          <p className="text-muted text-sm">Для вашей категории согласие родителей не требуется.</p>
        ) : approved ? (
          <div className="bg-bgSurface border border-success rounded-xl p-4">
            <p className="text-success font-semibold mb-1">✅ Согласие получено</p>
            <p className="text-muted text-sm">Все функции TEEN доступны. Родитель может отозвать согласие в боте командой /stop.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-offwhite text-sm">
              Для участия в категории TEEN (15–17) нужно согласие одного из родителей или опекунов. Пока его нет, платные функции и участие недоступны.
            </p>
            <ol className="text-muted text-sm list-decimal pl-5 flex flex-col gap-1">
              <li>Нажмите «Получить ссылку для родителя».</li>
              <li>Отправьте ссылку маме, папе или опекуну.</li>
              <li>Родитель откроет её в Telegram, нажмёт «Даю согласие» и поделится своим номером.</li>
            </ol>
            {!link ? (
              <button onClick={getLink} disabled={busy} className="bg-gold text-bgPrimary font-semibold rounded-full py-3 disabled:opacity-50">
                Получить ссылку для родителя
              </button>
            ) : (
              <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-offwhite text-xs break-all select-all">{link}</p>
                <div className="flex gap-2">
                  <button onClick={copy} className="flex-1 border border-gold text-gold rounded-full py-2 text-sm">
                    {copied ? "Скопировано" : "Скопировать"}
                  </button>
                  <a href={link} target="_blank" rel="noreferrer" className="flex-1 bg-gold text-bgPrimary rounded-full py-2 text-sm text-center font-semibold">
                    Открыть в Telegram
                  </a>
                </div>
                <p className="text-muted text-xs">Ссылка действует 3 дня. Страница сама обновится, когда родитель подтвердит.</p>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
