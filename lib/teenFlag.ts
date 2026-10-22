"use client";

import { useEffect, useState } from "react";

// Открыта ли категория TEEN (переключатель в CRM). Пока ответ не пришёл — считаем закрытой,
// чтобы подростковый раздел не мелькал у тех, кому он не нужен.
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

export function loadTeenOpen(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/categories/open", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (cached = !!d?.teen_open))
      .catch(() => false)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useTeenOpen(): boolean {
  const [v, setV] = useState<boolean>(cached ?? false);
  useEffect(() => {
    let alive = true;
    loadTeenOpen().then((x) => alive && setV(x));
    return () => {
      alive = false;
    };
  }, []);
  return v;
}
