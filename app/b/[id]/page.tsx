"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import BusinessPageView, { BizPublic } from "@/components/BusinessPageView";
import { apiPost } from "@/lib/authClient";

// Публичная страница партнёра.
export default function BusinessPublicPage() {
  const params = useParams();
  const id = String((params as any)?.id ?? "");
  const [p, setP] = useState<BizPublic | null>(null);
  const [state, setState] = useState<"load" | "ok" | "none">("load");

  useEffect(() => {
    (async () => {
      const r = await apiPost("/api/business/page", { id });
      if (r?.ok) {
        setP(r.profile);
        setState("ok");
      } else if (r?.error === "auth") {
        window.location.href = `/login?redirect=/b/${id}`;
      } else setState("none");
    })();
  }, [id]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto">
        {state === "load" && <LoadingScreen inline />}
        {state === "none" && <p className="text-muted text-center px-6 py-10">Страница не найдена или пока недоступна.</p>}
        {state === "ok" && p && <BusinessPageView p={{ ...p, id }} />}
      </div>
      <BottomNav />
    </main>
  );
}
