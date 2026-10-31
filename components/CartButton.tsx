"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { TopBtn } from "@/components/ProfileHero";

// Кнопка корзины с числом товаров.
export default function CartButton() {
  const [n, setN] = useState(0);
  async function load() {
    const r = await apiPost("/api/business/cart", { action: "count" });
    if (r?.ok) setN(Number(r.count) || 0);
  }
  useEffect(() => {
    load();
    window.addEventListener("vetoks:cart", load);
    return () => window.removeEventListener("vetoks:cart", load);
  }, []);
  return (
    <TopBtn href="/cart" label="Корзина" badge={n}>
      <span className="text-base leading-none">🛒</span>
    </TopBtn>
  );
}
