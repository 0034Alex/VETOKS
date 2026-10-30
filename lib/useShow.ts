"use client";

import { useEffect, useState } from "react";

// Какое шоу сейчас активно (его сообщает components/ShowTheme.tsx после запроса к серверу).
export type ShowBanner = { image?: string; title?: string; subtitle?: string; stage_label?: string; countdown_to?: string | null; apply?: boolean; apply_until?: string | null; poll_question?: string };
export type ActiveShow = { id: string; key: string; title: string; contest: string; preview: boolean; banner?: ShowBanner; endsAt?: string | null; blocksOff?: string[]; blockOrder?: string[]; launch?: { stage: string; day: number; total: number; tips: string[]; tasks: string[]; stageEndsAt?: number | null } | null } | null;
const EVT = "vetoks-show";
let current: ActiveShow = null;
let loaded = false;

const STORE = "vt_show_info";

// Блок виден, если в CRM запуска он не выключен (нет запуска или блок не задан — показываем как раньше).
export const hasBlock = (s: ActiveShow | undefined | null, key: string) => !(s?.blocksOff ?? []).includes(key);

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

// «Между шоу»: в стране нет идущего шоу. off — выключенные блоки главной, question — вопрос недели.
export type Between = { on: boolean; off: string[]; question: string; prestart?: number | null; early?: number | null } | null;
let between: Between = null;
const BEVT = "vetoks-between";
const BSTORE = "vt_between";
export function publishBetween(b: Between) {
  between = b;
  try {
    localStorage.setItem(BSTORE, JSON.stringify(b));
  } catch {}
  try {
    window.dispatchEvent(new Event(BEVT));
  } catch {}
}
export function useBetween(): Between {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!between) {
      try {
        const raw = localStorage.getItem(BSTORE);
        if (raw) {
          between = JSON.parse(raw);
          tick((n) => n + 1);
        }
      } catch {}
    }
    const h = () => tick((n) => n + 1);
    window.addEventListener(BEVT, h);
    return () => window.removeEventListener(BEVT, h);
  }, []);
  return between;
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
