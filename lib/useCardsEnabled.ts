"use client";
import { useEffect, useState } from "react";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";

// Включены ли коллекционные карточки (переключатель в CRM → «Главная», по странам).
let cached: boolean | null = null;

export function useCardsEnabled(): boolean {
  const [on, setOn] = useState(cached ?? true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await getMyCountry();
        const m = await loadScoped(["cards_enabled"], c.countryId);
        cached = m.cards_enabled !== "false";
        if (alive) setOn(cached);
      } catch {
        /* остаётся значение по умолчанию */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return on;
}
