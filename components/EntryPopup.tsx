"use client";

import { useEffect, useState } from "react";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import { useAdWatch, withUtm } from "@/lib/track";

type Settings = {
  enabled: boolean;
  image_url: string | null;
  text: string | null;
  button_text: string | null;
  button_link: string | null;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function EntryPopup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      let data: any = null;
      const cid = (await getMyCountry()).countryId;
      const me0 = await getCurrentUser();
      const pj = await loadScoped(["popup_json"], cid, me0?.region_id ?? null);
      if (pj.popup_json) {
        try { data = JSON.parse(pj.popup_json); } catch { data = null; }
      } else {
        const r = await supabase
          .from("popup_settings")
          .select("enabled, image_url, text, button_text, button_link")
          .eq("id", 1)
          .maybeSingle();
        data = r.data;
      }

      if (!data || !data.enabled) return;
      setSettings(data as Settings);

      const u = await getCurrentUser();
      if (!u) return;

      const { data: lastShow } = await supabase
        .from("popup_shows")
        .select("shown_at")
        .eq("user_id", u.id)
        .maybeSingle();

      const lastShownTime = lastShow ? new Date(lastShow.shown_at).getTime() : 0;
      const dueAgain = Date.now() - lastShownTime > THREE_DAYS_MS;

      if (dueAgain) {
        setShow(true);
        await supabase
          .from("popup_shows")
          .upsert({ user_id: u.id, shown_at: new Date().toISOString() });
      }
    })();
  }, []);

  const meta = { type: "popup" as const, id: "entry", placement: "entry" };
  const { ref: cardRef, watch } = useAdWatch<HTMLDivElement>(show && settings ? meta : null, [show]);

  if (!show || !settings) return null;

  function closePopup() {
    watch.current?.close();
    setShow(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
      }}
      onClick={closePopup}
    >
      <div
        ref={cardRef}
        style={{
          backgroundColor: "#151517",
          border: "1px solid rgba(201,162,39,0.4)",
          borderRadius: 16,
          overflow: "hidden",
          width: "100%",
          maxWidth: 384,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {settings.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={settings.image_url}
            alt=""
            style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
          />
        )}
        <div style={{ padding: 20 }}>
          {settings.text && (
            <p style={{ color: "#F5F5F2", fontSize: 14, marginBottom: 16 }}>
              {settings.text}
            </p>
          )}
          {settings.button_text && settings.button_link && (
            <a
              href={withUtm(settings.button_link, meta)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => watch.current?.click()}
              style={{
                display: "block",
                width: "100%",
                backgroundColor: "#C9A227",
                color: "#0B0B0D",
                fontWeight: 600,
                textAlign: "center",
                padding: "12px 0",
                borderRadius: 999,
                fontSize: 14,
                marginBottom: 8,
                textDecoration: "none",
              }}
            >
              {settings.button_text}
            </a>
          )}
          <button
            onClick={closePopup}
            style={{
              width: "100%",
              color: "#8A8A8E",
              fontSize: 12,
              padding: "8px 0",
              background: "none",
              border: "none",
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
