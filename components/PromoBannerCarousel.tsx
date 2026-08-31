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
    <div style={{ padding: "0 24px", marginBottom: 16 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "43.75%", // держит соотношение сторон 16:7 в любом браузере
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: "rgba(0,0,0,0.4)",
        }}
      >
        {banners.map((b, i) => {
          const content = (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.image_url}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: i === active ? 1 : 0,
                transition: "opacity 0.7s",
              }}
            />
          );
          return b.link_url ? (
            <a
              key={b.id}
              href={b.link_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                position: "absolute",
                inset: 0,
                zIndex: i === active ? 1 : 0,
                pointerEvents: i === active ? "auto" : "none",
              }}
            >
              {content}
            </a>
          ) : (
            <div
              key={b.id}
              style={{ position: "absolute", inset: 0, zIndex: i === active ? 1 : 0 }}
            >
              {content}
            </div>
          );
        })}

        {banners.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 6,
              zIndex: 10,
            }}
          >
            {banners.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: i === active ? "#C9A227" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
