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
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        router.replace("/login");
      } else {
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, isPublic, router]);

  if (!ready) return <div className="min-h-screen bg-bgPrimary" />;
  return <>{children}</>;
}
