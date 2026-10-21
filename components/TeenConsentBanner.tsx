"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { getCurrentUser } from "@/lib/currentUser";

// Для TEEN без согласия родителей — напоминание на главной.
export default function TeenConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (u?.age_category !== "teen") return;
      const r = await apiPost("/api/parent/start", { action: "status" });
      setShow(!!(r?.ok && r.needed && !r.approved));
    })();
  }, []);
  if (!show) return null;
  return (
    <Link
      href="/parent-consent"
      className="mx-6 mb-3 flex items-center justify-between gap-2 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-xs text-goldSoft"
    >
      <span>Нужно согласие родителей — без него платные функции и участие закрыты.</span>
      <span className="font-bold text-gold whitespace-nowrap">Открыть →</span>
    </Link>
  );
}
