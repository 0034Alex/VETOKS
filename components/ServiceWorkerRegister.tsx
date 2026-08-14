"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Тихо игнорируем — не критично, если не зарегистрировался.
      });
    }
  }, []);

  return null;
}
