"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBetween } from "@/lib/useShow";

// Пока шоу в стране не началось, открыты только главная (с отсчётом), анкета, профиль и служебные страницы.
const OPEN = ["/", "/apply", "/my-application", "/profile", "/edit-profile", "/settings", "/support", "/documents", "/legal", "/login", "/register", "/forgot-password", "/reset-password", "/admin", "/parent-consent", "/welcome", "/install", "/invites", "/ad-space", "/partner-cabinet", "/partner", "/business", "/b"];

export default function PreStartGate() {
  const b = useBetween();
  const path = usePathname() || "/";
  const router = useRouter();
  const locked = !!b?.prestart && b.prestart > Date.now();
  useEffect(() => {
    if (!locked) return;
    const ok = OPEN.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
    if (!ok) router.replace("/");
  }, [locked, path, router]);
  return null;
}
