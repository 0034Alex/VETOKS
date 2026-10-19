"use client";

import { useEffect } from "react";
import { apiPost } from "@/lib/authClient";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Тихо игнорируем — не критично, если не зарегистрировался.
      });
    }

    function ping(event: "install" | "open") {
      apiPost("/api/pwa/ping", { event }).catch(() => {});
    }

    // Запуск с экрана «Домой»: не чаще раза в сутки на устройство.
    try {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (standalone) {
        const k = "vt_pwa_ping";
        const last = Number(localStorage.getItem(k) ?? 0);
        if (Date.now() - last > 86400000) {
          localStorage.setItem(k, String(Date.now()));
          ping("open");
        }
      }
    } catch {
      /* без localStorage просто не считаем */
    }

    const handleInstalled = () => ping("install");
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  return null;
}
