"use client";

import { useEffect, useState } from "react";
import { getMyCountry } from "@/lib/myCountry";
import { loadScoped } from "@/lib/scopedSettings";
import { getCurrentUser } from "@/lib/currentUser";

export default function TickerBar() {
  const [text, setText] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      const map = await loadScoped(["ticker_text", "ticker_enabled"], (await getMyCountry()).countryId, me?.region_id ?? null);
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
