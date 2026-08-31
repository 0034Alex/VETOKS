"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Partner = {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
};

export default function PartnersDirectoryPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("partner_logos")
        .select("id, name, logo_url, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setPartners((data as Partner[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-offwhite mb-3 px-6">
        Партнёры
      </h1>

      <Link
        href="/partner"
        className="mx-6 mb-6 flex items-center justify-center gap-2 bg-bgSurface border border-gold text-gold font-semibold text-sm py-3 rounded-full"
      >
        🤝 Хотите стать партнёром? Оставить заявку
      </Link>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && partners.length === 0 && (
        <p className="text-muted text-center px-6">Пока нет партнёров.</p>
      )}

      <div className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {partners.map((p) => {
          const card = (
            <div
              className="aspect-square rounded-xl flex items-center justify-center p-5"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(11,11,13,0.9))",
                border: "1px solid rgba(201,162,39,0.3)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.logo_url}
                alt={p.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          );
          return p.link_url ? (
            <a key={p.id} href={p.link_url} target="_blank" rel="noopener noreferrer">
              {card}
            </a>
          ) : (
            <div key={p.id}>{card}</div>
          );
        })}
      </div>

      </div>
      <BottomNav />
    </main>
  );
}
