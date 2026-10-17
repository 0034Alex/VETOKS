"use client";

import { useEffect, useState } from "react";

// Если страница упала — показываем причину текстом (её можно сфотографировать) и даём выйти из зависшей сессии.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [info, setInfo] = useState("");

  useEffect(() => {
    // Устаревшие файлы после обновления — один раз перезагружаем страницу.
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(String(error?.message))) {
      try {
        if (!sessionStorage.getItem("vt_chunk_reload")) {
          sessionStorage.setItem("vt_chunk_reload", "1");
          window.location.reload();
        }
      } catch {}
    }
    setInfo(`${error?.name ?? "Error"}: ${error?.message ?? ""}\n${window.location.pathname}`);
  }, [error]);

  async function clearAndLogin() {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ("caches" in window) (await caches.keys()).forEach((k) => caches.delete(k));
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      regs?.forEach((r) => r.unregister());
    } catch {}
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-4 bg-bgPrimary text-offwhite">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="text-muted text-sm">Попробуйте ещё раз. Если не помогает, нажмите «Выйти и войти заново».</p>
      <button onClick={reset} className="bg-gold text-bgPrimary font-semibold rounded-full px-6 py-2.5">
        Повторить
      </button>
      <button onClick={clearAndLogin} className="border border-gold text-gold rounded-full px-6 py-2.5">
        Выйти и войти заново
      </button>
      {info && <pre className="text-muted text-[11px] whitespace-pre-wrap break-words max-w-full mt-2">{info}</pre>}
    </main>
  );
}
