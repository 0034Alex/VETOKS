"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useBetween } from "@/lib/useShow";
import { apiPost } from "@/lib/authClient";

// Пока шоу в стране не началось, открыты только главная (с отсчётом), анкета, реклама, профиль и служебные страницы.
// Бизнес-страницы, магазины, корзина и заказы до старта закрыты.
const OPEN = ["/", "/apply", "/my-application", "/profile", "/edit-profile", "/settings", "/support", "/documents", "/legal", "/login", "/register", "/forgot-password", "/reset-password", "/admin", "/parent-consent", "/welcome", "/install", "/invites", "/ad-space", "/partner-cabinet", "/partner"];

// Бизнес-страница до старта открыта только одобренным рекламодателям (чтобы заполнить её заранее).
const BIZ = ["/business", "/b"];

export default function PreStartGate() {
  const b = useBetween();
  const path = usePathname() || "/";
  const router = useRouter();
  const locked = !!b?.prestart && b.prestart > Date.now();
  useEffect(() => {
    if (!locked) return undefined;
    const ok = OPEN.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));
    if (ok) return undefined;
    if (BIZ.some((p) => path === p || path.startsWith(p + "/"))) {
      let off = false;
      apiPost("/api/business/state")
        .then((r: any) => {
          if (!off && !r?.eligible) router.replace("/");
        })
        .catch(() => {
          if (!off) router.replace("/");
        });
      return () => {
        off = true;
      };
    }
    router.replace("/");
    return undefined;
  }, [locked, path, router]);
  return null;
}
