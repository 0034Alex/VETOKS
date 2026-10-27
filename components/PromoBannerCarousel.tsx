"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";
import { adAllowed } from "@/lib/adAudience";
import { getCurrentUser } from "@/lib/currentUser";
import { AdWatch, withUtm } from "@/lib/track";

type Banner = {
  id: string;
  image_url: string;
  link_url: string | null;
};

export default function PromoBannerCarousel({
  placement = "main",
}: {
  placement?: string;
}) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const watches = useRef<Map<string, AdWatch>>(new Map());
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const mc = await getMyCountry();
      const sm = await loadScoped(["banners_enabled"], mc.countryId);
      setEnabled(sm.banners_enabled !== "false");

      const u = await getCurrentUser();
      const myRegionId = u?.region_id ?? null;

      // Общероссийские баннеры этого места показа — видны всем.
      // «Все регионы» означает все регионы СВОЕЙ страны (country_id), а не всех стран.
      let nq = supabase
        .from("promo_banners")
        .select("id, image_url, link_url, sort_order, country_id, audience")
        .eq("is_active", true)
        .eq("placement", placement)
        .eq("all_regions", true);
      if (mc.countryId) nq = nq.or(`country_id.is.null,country_id.eq.${mc.countryId}`);
      const { data: nationwide, error: nationwideError } = await nq;
      if (nationwideError) {
        console.error("[PromoBannerCarousel] nationwide error:", nationwideError);
      }

      // Региональные баннеры — только те, что отмечены для региона зрителя.
      let regional: any[] = [];
      if (myRegionId) {
        const { data: regionalRows, error: regionalError } = await supabase
          .from("promo_banner_regions")
          .select(
            "banner_id, promo_banners(id, image_url, link_url, sort_order, is_active, all_regions, placement, audience)"
          )
          .eq("region_id", myRegionId);
        if (regionalError) {
          console.error("[PromoBannerCarousel] regional error:", regionalError);
        }
        regional = (regionalRows ?? [])
          .map((r: any) => (Array.isArray(r.promo_banners) ? r.promo_banners[0] : r.promo_banners))
          .filter((b: any) => b && b.is_active && !b.all_regions && b.placement === placement);
      }

      const merged = [...(nationwide ?? []), ...regional]
        .filter((b: any) => adAllowed(b.audience, u?.age_category))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .slice(0, 5);

      setBanners(merged as Banner[]);
    })();
  }, [placement]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Карусель на экране (≥50%)?
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.5)), {
      threshold: [0, 0.5, 1],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, banners.length]);

  // Показ / время на экране считаем только у баннера, который сейчас активен и виден.
  useEffect(() => {
    if (!enabled || banners.length === 0) return;
    banners.forEach((b, i) => {
      let w = watches.current.get(b.id);
      if (!w && i === active) {
        w = new AdWatch({ type: "banner", id: b.id, placement, position: i });
        watches.current.set(b.id, w);
      }
      w?.setIntersecting(visible && i === active);
    });
  }, [active, banners, enabled, visible, placement]);

  useEffect(() => {
    const map = watches.current;
    return () => {
      map.forEach((w) => w.end());
      map.clear();
    };
  }, [banners]);

  function onTouchEnd(x: number) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null || banners.length <= 1) return;
    const dx = x - start;
    if (Math.abs(dx) < 40) return;
    watches.current.get(banners[active]?.id)?.swipe();
    setActive((prev) => (dx < 0 ? (prev + 1) % banners.length : (prev - 1 + banners.length) % banners.length));
  }

  if (!enabled || banners.length === 0) return null;

  return (
    <div style={{ padding: "0 24px", marginBottom: 16 }}>
      <div
        ref={boxRef}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "43.75%",
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
              href={withUtm(b.link_url, { type: "banner", id: b.id, placement })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => watches.current.get(b.id)?.click()}
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
                  backgroundColor: i === active ? "rgb(var(--c-gold))" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
