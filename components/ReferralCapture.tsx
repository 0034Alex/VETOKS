"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

// Запоминает код приглашения (из ссылки или Telegram) и привязывает его к новому аккаунту.
export default function ReferralCapture() {
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("ref");
      const sp = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param as string | undefined;
      const fromTg = sp && sp.startsWith("ref_") ? sp.slice(4) : null;
      const code = q || fromTg;
      if (code) localStorage.setItem("vt_ref", code);
    } catch {}

    let stop = false;
    const tryClaim = async () => {
      let code: string | null = null;
      try {
        code = localStorage.getItem("vt_ref");
      } catch {}
      if (!code || stop) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const r = await apiPost("/api/referral/claim", { code });
      // при любом окончательном ответе код больше не нужен
      if (r && (r.ok || ["already", "too_old", "bad_code", "self", "limit", "disabled"].includes(r.error))) {
        try {
          localStorage.removeItem("vt_ref");
        } catch {}
      }
    };
    tryClaim();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN") setTimeout(tryClaim, 800);
    });
    return () => {
      stop = true;
      sub.subscription.unsubscribe();
    };
  }, []);
  return null;
}
