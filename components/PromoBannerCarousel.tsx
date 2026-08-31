"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    (async () => {
      const { data: settingRow, error: settingError } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "banners_enabled")
        .maybeSingle();
      if (settingError) {
        console.error("[PromoBannerCarousel] platform_settings error:", settingError);
      }
      setEnabled(settingRow?.value !== "false");

      const { data, error } = await supabase
        .from("promo_banners")
        .select("id, image_url, link_url")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(5);

      if (error) {
        console.error("[PromoBannerCarousel] promo_banners error:", error);
      }
      console.log("[PromoBannerCarousel] fetched banners:", data);

      setBanners((data as Banner[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  if (!enabled || banners.length === 0) return null;

  return (
    <div className="px-6 mb-4">
      <div className="relative w-full aspect-[16/7] rounded-xl overflow-hidden bg-black/40">
        {banners.map((b, i) => {
          const content = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
              style={{ opacity: i === active ? 1 : 0 }}
            />
          );
          return b.link_url ? (
            <a
              key={b.id}
              href={b.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0"
              style={{ zIndex: i === active ? 1 : 0, pointerEvents: i === active ? "auto" : "none" }}
            >
              {content}
            </a>
          ) : (
            <div
              key={b.id}
              className="absolute inset-0"
              style={{ zIndex: i === active ? 1 : 0 }}
            >
              {content}
            </div>
          );
        })}

        {banners.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
            {banners.map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: i === active ? "#C9A227" : "rgba(255,255,255,0.4)" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
