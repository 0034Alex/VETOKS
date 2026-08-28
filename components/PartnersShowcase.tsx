"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

type Partner = {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
};

export default function PartnersShowcase() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("partner_logos")
        .select("id, name, logo_url, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setPartners((data as Partner[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (partners.length <= 3) return;
    const el = scrollRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 5;
      el.scrollTo({
        left: atEnd ? 0 : el.scrollLeft + 140,
        behavior: "smooth",
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [partners.length]);

  if (partners.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="px-6 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-offwhite">Партнёры</h2>
        <Link href="/partner" className="text-gold text-sm flex items-center gap-1">
          Все <span>→</span>
        </Link>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto px-6 gap-3"
        style={{ scrollbarWidth: "none" }}
      >
        {partners.map((p) => {
          const card = (
            <div
              className="w-28 h-28 flex-shrink-0 rounded-xl flex items-center justify-center p-4"
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
  );
}
