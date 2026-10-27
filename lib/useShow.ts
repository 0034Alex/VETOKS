"use client";

import { useEffect, useState } from "react";

// Какое шоу сейчас активно (его сообщает components/ShowTheme.tsx после запроса к серверу).
export type ShowBanner = { image?: string; title?: string; subtitle?: string; stage_label?: string; countdown_to?: string | null; apply?: boolean };
export type ActiveShow = { id: string; key: string; title: string; contest: string; preview: boolean; banner?: ShowBanner; endsAt?: string | null } | null;
const EVT = "vetoks-show";
let current: ActiveShow = null;
let loaded = false;

const STORE = "vt_show_info";

export function publishShow(s: ActiveShow) {
  current = s;
  loaded = true;
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {}
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {}
}

export function useShow(): { show: ActiveShow; ready: boolean } {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!loaded && !current) {
      try {
        const raw = localStorage.getItem(STORE);
        if (raw) {
          current = JSON.parse(raw);
          tick((n) => n + 1);
        }
      } catch {}
    }
    const h = () => tick((n) => n + 1);
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return { show: current, ready: loaded };
}
