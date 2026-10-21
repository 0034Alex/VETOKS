"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/currentUser";
import type { AgeCategory } from "@/lib/ageCategory";

// Какую категорию человек сейчас просматривает (по умолчанию — свою).
// Хранится в браузере; страницы подписываются на событие и перезагружают списки.
const KEY = "vetoks_view_cat";
const EVT = "vetoks-viewcat";
const VALID = ["teen", "main", "adult"];

function readStored(): AgeCategory | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && VALID.includes(v) ? (v as AgeCategory) : null;
  } catch {
    return null;
  }
}

export function useViewCategory() {
  const [mine, setMine] = useState<AgeCategory>("main");
  const [stored, setStored] = useState<AgeCategory | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getCurrentUser();
      if (!alive) return;
      const m = (u?.age_category && VALID.includes(u.age_category) ? u.age_category : "main") as AgeCategory;
      setMine(m);
      setStored(readStored());
      setReady(true);
    })();
    const on = () => setStored(readStored());
    window.addEventListener(EVT, on);
    return () => {
      alive = false;
      window.removeEventListener(EVT, on);
    };
  }, []);

  const setView = useCallback((c: AgeCategory) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* без хранилища просто не запоминаем */
    }
    setStored(c);
    window.dispatchEvent(new Event(EVT));
  }, []);

  const view = (stored ?? mine) as AgeCategory;
  return { view, mine, setView, ready };
}
