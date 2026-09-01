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
      style={{
        overflow: "hidden",
        backgroundColor: "#151517",
        borderTop: "1px solid rgba(201,162,39,0.3)",
        borderBottom: "1px solid rgba(201,162,39,0.3)",
        height: 28,
        marginTop: 16,
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          color: "#C9A227",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          height: "100%",
          width: "max-content",
          animation: "vetoks-ticker-scroll 22s linear infinite",
        }}
      >
        <span style={{ padding: "0 24px" }}>{text}</span>
        <span style={{ padding: "0 24px" }}>{text}</span>
        <span style={{ padding: "0 24px" }}>{text}</span>
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
