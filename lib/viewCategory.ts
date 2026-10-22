"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/currentUser";
import { categoryInfo, type AgeCategory } from "@/lib/ageCategory";
import { useTeenOpen } from "@/lib/teenFlag";

// «all» — только для сотрудников и официальной страницы VETOKS: видят все категории сразу.
export type ViewCat = AgeCategory | "all";
const STAFF = ["moderator", "finance_admin", "super_admin"];

export function viewInfo(v: ViewCat) {
  return v === "all" ? { key: "all", label: "ВСЕ", ages: "все", title: "VETOKS" } : categoryInfo(v);
}
// Для рейтинга и Топ-25 (считаются по категориям): «все» → своя категория.
export function rankCat(v: ViewCat, mine: AgeCategory): AgeCategory {
  return v === "all" ? mine : v;
}
export function inView(v: ViewCat, c: string | null | undefined) {
  return v === "all" || (c ?? "main") === v;
}

// Какую категорию человек сейчас просматривает (по умолчанию — свою).
// Хранится в браузере; страницы подписываются на событие и перезагружают списки.
const KEY = "vetoks_view_cat";
const EVT = "vetoks-viewcat";
const VALID = ["teen", "main", "adult"];

function readStored(): ViewCat | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && (VALID.includes(v) || v === "all") ? (v as ViewCat) : null;
  } catch {
    return null;
  }
}

export function useViewCategory() {
  const [mine, setMine] = useState<AgeCategory>("main");
  const [stored, setStored] = useState<ViewCat | null>(null);
  const [canAll, setCanAll] = useState(false);
  const [ready, setReady] = useState(false);
  const teenOpen = useTeenOpen();

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getCurrentUser();
      if (!alive) return;
      const m = (u?.age_category && VALID.includes(u.age_category) ? u.age_category : "main") as AgeCategory;
      setMine(m);
      setCanAll(STAFF.includes(String(u?.role)) || !!u?.is_official);
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

  const setView = useCallback((c: ViewCat) => {
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* без хранилища просто не запоминаем */
    }
    setStored(c);
    window.dispatchEvent(new Event(EVT));
  }, []);

  // TEEN выключен в CRM: чужую TEEN-ленту не показываем (свою — только если человек уже в ней)
  const teenHidden = !teenOpen && mine !== "teen";
  const ok = stored && (stored !== "all" || canAll) && !(stored === "teen" && teenHidden);
  const view: ViewCat = ok ? (stored as ViewCat) : mine;
  return { view, mine, setView, ready, canAll, teenHidden };
}
