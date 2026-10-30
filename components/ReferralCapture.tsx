"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

// Окончательные ответы сервера: после них код приглашения больше не нужен.
const FINAL = ["already", "too_old", "bad_code", "self", "limit", "disabled", "other_country", "no_code"];

// Запоминает код приглашения (из ссылки или Telegram) и привязывает его к новому аккаунту.
export default function ReferralCapture() {
  const [toast, setToast] = useState("");

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("ref");
      const sp = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param as string | undefined;
      const fromTg = sp && sp.startsWith("ref_") ? sp.slice(4) : null;
      const code = q || fromTg;
      if (code) localStorage.setItem("vt_ref", code);
      const a = new URLSearchParams(window.location.search).get("a") === "1" || (sp ? sp.startsWith("adv_") : false);
      const fromAdv = sp && sp.startsWith("adv_") ? sp.slice(4) : null;
      if (fromAdv) localStorage.setItem("vt_ref", fromAdv);
      if (a) localStorage.setItem("vt_ref_kind", "advertiser");
    } catch {}

    let stop = false;
    let busy = false;
    let tries = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const tryClaim = async () => {
      if (busy || stop) return;
      let code: string | null = null;
      try {
        code = localStorage.getItem("vt_ref");
      } catch {}
      if (!code) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      busy = true;
      let r: any = null;
      try {
        let kind = "friend";
        try {
          kind = localStorage.getItem("vt_ref_kind") === "advertiser" ? "advertiser" : "friend";
        } catch {}
        r = await apiPost("/api/referral/claim", { code, kind });
      } catch {}
      busy = false;
      if (stop) return;
      if (r?.ok) {
        try {
          localStorage.removeItem("vt_ref");
          localStorage.removeItem("vt_ref_kind");
        } catch {}
        
      } else if (r && FINAL.includes(r.error)) {
        try {
          localStorage.removeItem("vt_ref");
          localStorage.removeItem("vt_ref_kind");
        } catch {}
      } else if (tries < 5) {
        // профиль мог ещё не создаться (регистрация по почте) или сбой сети — пробуем ещё
        tries++;
        retry = setTimeout(tryClaim, 3000 * tries);
      }
    };
    tryClaim();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === "SIGNED_IN") {
        tries = 0;
        setTimeout(tryClaim, 800);
      }
    });
    return () => {
      stop = true;
      if (retry) clearTimeout(retry);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      className="fixed left-4 right-4 z-[90] bg-bgSurface border border-gold text-offwhite text-sm rounded-xl px-4 py-3 text-center"
      style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      {toast}
    </div>
  );
}
