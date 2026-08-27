"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Тихо игнорируем — не критично, если не зарегистрировался.
      });
    }

    async function handleInstalled() {
      const u = await getCurrentUser();
      await supabase.from("pwa_installs").insert({ user_id: u?.id ?? null });
    }

    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  return null;
}
