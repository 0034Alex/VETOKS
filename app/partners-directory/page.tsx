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
import { apiPost } from "@/lib/authClient";
import { BlueCheck } from "@/components/BusinessPageView";

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
  const [biz, setBiz] = useState<any[]>([]);
  const [tab, setTab] = useState<"partners" | "shops">("partners");

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("tab") === "shops") setTab("shops");
    } catch {}
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
      const br = await apiPost("/api/business/list");
      if (br?.ok) setBiz(br.items ?? []);
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

      <div className="px-6 mb-5 flex gap-2">
        {([["partners", "Партнёры"], ["shops", "Магазины"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2 rounded-full text-sm border ${tab === k ? "bg-gold text-bgPrimary border-gold font-semibold" : "border-muted text-offwhite"}`}>{l}</button>
        ))}
      </div>

      {tab === "partners" && loading && <LoadingScreen inline />}
      {tab === "partners" && !loading && partners.length === 0 && (
        <p className="text-muted text-center px-6">Пока нет партнёров.</p>
      )}

      {tab === "partners" && (
      <div className="px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {partners.map((p, i) => (
          <DirItem key={p.id} p={p} index={i} />
        ))}
      </div>
      )}

      {tab === "shops" && (
        <div className="px-6">
          {biz.length === 0 && <p className="text-muted text-center">Пока нет открытых магазинов.</p>}
          <div className="flex flex-col gap-3">
            {biz.map((b) => (
              <Link key={b.id} href={`/u/${b.user_id ?? ""}`} className="flex items-center gap-3 bg-bgSurface border border-muted rounded-xl p-3">
                <div className="w-12 h-12 rounded-xl bg-bgPrimary overflow-hidden flex items-center justify-center flex-none text-gold font-bold">
                  {b.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo_url} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    (b.name || "?").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-offwhite font-semibold text-sm flex items-center gap-1.5">
                    <span className="truncate">{b.name}</span>
                    {b.verified && <BlueCheck size={15} />}
                  </p>
                  <p className="text-muted text-xs truncate">{[b.category, b.address].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="text-gold">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      </div>
      <BottomNav />
    </main>
  );
}
