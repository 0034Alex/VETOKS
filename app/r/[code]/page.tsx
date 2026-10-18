"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Ссылка друга: запоминаем код. Новому человеку — регистрация, уже вошедшему — на главную
// (код привяжется сам, если аккаунт ещё свежий).
export default function RefLanding() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    try {
      localStorage.setItem("vt_ref", String(code));
    } catch {}
    (async () => {
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/" : "/register");
    })();
  }, [code, router]);
  return <main className="min-h-screen" />;
}
