"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Ссылка друга: запоминаем код и отправляем на регистрацию.
export default function RefLanding() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    try {
      localStorage.setItem("vt_ref", String(code));
    } catch {}
    router.replace("/register");
  }, [code, router]);
  return <main className="min-h-screen" />;
}
