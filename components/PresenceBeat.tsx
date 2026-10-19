"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

// Раз в 2,5 минуты, пока приложение открыто и видно, отмечаем «в сети».
export default function PresenceBeat() {
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let last = 0;

    async function beat() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < 120000) return;
      last = Date.now();
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await apiPost("/api/presence/ping", {});
      } catch {
        /* не критично */
      }
    }

    beat();
    timer = setInterval(beat, 150000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
