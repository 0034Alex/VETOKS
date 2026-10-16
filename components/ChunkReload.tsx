"use client";

import { useEffect } from "react";

// Если после обновления сайта открытое окно (PWA, Telegram) просит файл,
// которого уже нет, один раз перезагружаем страницу. Без этого человек
// видит ошибку 404 или белый экран, а со второго раза всё открывается.
export default function ChunkReload() {
  useEffect(() => {
    const KEY = "vt_chunk_reload_at";
    function recover(text: string) {
      if (!/ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|_next\/static/i.test(text)) return;
      try {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < 30000) return;
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {}
      window.location.reload();
    }
    const onError = (e: ErrorEvent) => recover(String(e.message || "") + " " + String((e.target as any)?.src || ""));
    const onRej = (e: PromiseRejectionEvent) => recover(String((e.reason && (e.reason.message || e.reason)) || ""));
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}
