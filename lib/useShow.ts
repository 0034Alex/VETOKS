"use client";

import { useEffect, useState } from "react";

// Какое шоу сейчас активно (его сообщает components/ShowTheme.tsx после запроса к серверу).
export type ShowBanner = { image?: string; title?: string; subtitle?: string; stage_label?: string; countdown_to?: string | null; apply?: boolean; apply_until?: string | null; poll_question?: string };
export type ActiveShow = { id: string; key: string; title: string; contest: string; preview: boolean; banner?: ShowBanner; endsAt?: string | null; blocks?: string[] | null; launch?: { stage: string; day: number; total: number; tips: string[]; tasks: string[] } | null } | null;
const EVT = "vetoks-show";
let current: ActiveShow = null;
let loaded = false;

const STORE = "vt_show_info";

// Блок включён в CRM (null — запусков нет, показываем всё как раньше).
export const hasBlock = (s: ActiveShow | undefined | null, key: string) => !s?.blocks || s.blocks.includes(key);

// Кнопка «Подать анкету» видна, пока приём открыт: галочка в CRM и срок «приём анкет до».
export const applyOpen = (b?: ShowBanner | null) => b?.apply !== false && (!b?.apply_until || Date.now() < new Date(b.apply_until).getTime());

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

// Шоу, на которое сейчас идёт набор анкет (приходит вместе с активным шоу).
export type Recruit = { id: string; key: string; title: string; contest: string; banner: ShowBanner; startsAt?: string | null } | null;
let recruit: Recruit = null;
const REVT = "vetoks-recruit";
export function publishRecruit(r: Recruit) {
  recruit = r;
  try {
    window.dispatchEvent(new Event(REVT));
  } catch {}
}
export function useRecruit(): Recruit {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = () => tick((n) => n + 1);
    window.addEventListener(REVT, h);
    return () => window.removeEventListener(REVT, h);
  }, []);
  return recruit;
}
