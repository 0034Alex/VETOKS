"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyCountry, orCountry } from "@/lib/myCountry";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { adAllowed } from "@/lib/adAudience";
import { getCurrentUser } from "@/lib/currentUser";
import { visibleInRegion } from "@/lib/regionFilter";
import { useAdWatch, withUtm } from "@/lib/track";

type Partner = {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
};

function DirItem({ p, index }: { p: Partner; index: number }) {
  const meta = { type: "logo" as const, id: p.id, placement: "directory", position: index };
  const { ref, watch } = useAdWatch<HTMLDivElement>(meta);
  const card = (
    <div
      ref={ref}
      className="aspect-square rounded-xl flex items-center justify-center p-5"
      style={{
        background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(11,11,13,0.9))",
        border: "1px solid rgba(201,162,39,0.3)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.logo_url} alt={p.name} className="max-w-full max-h-full object-contain" />
    </div>
  );
  return p.link_url ? (
    <a href={withUtm(p.link_url, meta)} target="_blank" rel="noopener noreferrer" onClick={() => watch.current?.click()}>
      {card}
    </a>
  ) : (
    <div>{card}</div>
  );
}

export default function PartnersDirectoryPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const mc = await getMyCountry();
      const { data } = await orCountry(
        supabase
          .from("partner_logos")
          .select("id, name, logo_url, link_url, all_regions, audience, partner_logo_regions(region_id)")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        mc.countryId
      );
      const me = await getCurrentUser();
      setPartners(visibleInRegion(((data as any[]) ?? []).filter((x: any) => adAllowed(x.audience, me?.age_category)), me?.region_id ?? null, "partner_logo_regions") as Partner[]);
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

      {loading && <LoadingScreen inline />}
      {!loading && partners.length === 0 && (
        <p className="text-muted text-center px-6">Пока нет партнёров.</p>
      )}

      <div className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {partners.map((p, i) => (
          <DirItem key={p.id} p={p} index={i} />
        ))}
      </div>

      </div>
      <BottomNav />
    </main>
  );
}
