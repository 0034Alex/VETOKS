"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import BusinessOrdersTab from "@/components/BusinessOrdersTab";

// Мои заказы и подарки у партнёров. Вкладка «Мне подарили» для участниц.
export default function MyOrdersPage() {
  const [tab, setTab] = useState<"my" | "incoming">("my");
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("tab") === "incoming") setTab("incoming");
      setOpenId(q.get("o"));
    } catch {}
    setReady(true);
  }, []);
  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto px-5">
        <h1 className="text-xl font-semibold text-offwhite mb-4">Заказы и подарки</h1>
        <div className="flex gap-2 mb-4">
          {([["my", "Мои заказы и подарки"], ["incoming", "Мне подарили"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setOpenId(null); }} className={`px-4 py-2 rounded-full text-sm border ${tab === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
          ))}
        </div>
        {ready && <BusinessOrdersTab key={tab + (openId ?? "")} mode={tab} cur="₴" openId={openId} />}
      </div>
      <BottomNav />
    </main>
  );
}
