"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Banner = {
  id: string;
  image_url: string;
  link_url: string | null;
};

export default function PromoBannerCarousel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: settingRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "banners_enabled")
        .maybeSingle();
      setEnabled(settingRow?.value !== "false");

      const { data } = await supabase
        .from("promo_banners")
        .select("id, image_url, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(5);
      setBanners((data as Banner[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % banners.length;
        scrollRef.current?.scrollTo({
          left: next * scrollRef.current.clientWidth,
          behavior: "smooth",
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (!enabled || banners.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-hidden snap-x snap-mandatory px-6 mb-4 gap-3"
    >
      {banners.map((b) => {
        const content = (
          <div className="w-full aspect-[16/7] rounded-xl overflow-hidden bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image_url} alt="" className="w-full h-full object-cover" />
          </div>
        );
        return (
          <div key={b.id} className="snap-center flex-shrink-0 w-full">
            {b.link_url ? (
              <a href={b.link_url} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
