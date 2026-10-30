"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import BottomNav from "@/components/BottomNav";
import BusinessOrdersTab from "@/components/BusinessOrdersTab";

// Мои заказы у партнёров (покупатель).
export default function MyOrdersPage() {
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      setOpenId(new URLSearchParams(window.location.search).get("o"));
    } catch {
      setOpenId(null);
    }
  }, []);
  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto px-5">
        <h1 className="text-xl font-semibold text-offwhite mb-4">Мои заказы</h1>
        {openId !== undefined && <BusinessOrdersTab key={openId ?? "list"} mode="my" cur="₴" openId={openId} />}
      </div>
      <BottomNav />
    </main>
  );
}
