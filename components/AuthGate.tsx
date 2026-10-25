"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Страницы, которые видно без входа. Всё остальное — только после
// регистрации/входа. Админка (/admin) проверяет доступ сама.
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/legal",
  "/r/",
  "/n/",
  "/v/",
  "/admin",
];

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  const [ready, setReady] = useState(isPublic);

  useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }
    let cancelled = false;
    // Страховка: если проверка входа зависла — один раз перезагружаем страницу
    const guard = setTimeout(() => {
      if (cancelled) return;
      try {
        if (sessionStorage.getItem("vt_gate_reload")) return;
        sessionStorage.setItem("vt_gate_reload", "1");
        window.location.reload();
      } catch {}
    }, 5000);
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      clearTimeout(guard);
      try { sessionStorage.removeItem("vt_gate_reload"); } catch {}
      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(guard);
    };
  }, [pathname, isPublic, router]);

  if (!ready) return <div className="min-h-screen bg-bgPrimary" />;
  return <>{children}</>;
}
