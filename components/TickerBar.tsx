"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TickerBar() {
  const [text, setText] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["ticker_text", "ticker_enabled"]);
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: { key: string; value: string }) => {
        map[r.key] = r.value;
      });
      setText(map.ticker_text ?? "");
      setEnabled(map.ticker_enabled === "true" && !!map.ticker_text);
    })();
  }, []);

  if (!enabled || !text) return null;

  return (
    <div
      className="fixed left-0 right-0 z-30 overflow-hidden bg-bgSurface border-t border-gold/30"
      style={{ bottom: "calc(64px + env(safe-area-inset-bottom))", height: 28 }}
    >
      <div
        className="whitespace-nowrap text-gold text-xs flex items-center h-full"
        style={{
          animation: "vetoks-ticker-scroll 22s linear infinite",
          width: "max-content",
        }}
      >
        <span className="px-6">{text}</span>
        <span className="px-6">{text}</span>
        <span className="px-6">{text}</span>
      </div>
      <style>{`
        @keyframes vetoks-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
