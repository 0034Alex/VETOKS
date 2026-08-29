"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SocialLinksBar() {
  const [links, setLinks] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("social_links").select("key, url");
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((row: { key: string; url: string | null }) => {
        map[row.key] = row.url;
      });
      setLinks(map);
    })();
  }, []);

  const items = [
    {
      key: "telegram",
      url: links.telegram,
      svg: (
        <svg viewBox="0 0 240 240" width="24" height="24">
          <circle cx="120" cy="120" r="120" fill="#29A9EB" />
          <path
            fill="#fff"
            d="M167 72l-23 109c-1.7 7.7-6.4 9.6-13 6l-36-26-17.4 16.8c-1.9 1.9-3.5 3.5-7.2 3.5l2.6-36.6L154 84.2c3-2.7-.6-4.2-4.7-1.5l-84.5 53.2-36.4-11.4c-7.9-2.5-8.1-7.9 1.7-11.7l142.3-54.9c6.6-2.4 12.4 1.6 10.6 13.1z"
          />
        </svg>
      ),
    },
    {
      key: "instagram",
      url: links.instagram,
      svg: (
        <svg viewBox="0 0 240 240" width="24" height="24">
          <defs>
            <radialGradient id="igGrad" cx="30%" cy="107%" r="150%">
              <stop offset="0%" stopColor="#fdf497" />
              <stop offset="5%" stopColor="#fdf497" />
              <stop offset="45%" stopColor="#fd5949" />
              <stop offset="60%" stopColor="#d6249f" />
              <stop offset="90%" stopColor="#285AEB" />
            </radialGradient>
          </defs>
          <rect width="240" height="240" rx="60" fill="url(#igGrad)" />
          <rect
            x="60"
            y="60"
            width="120"
            height="120"
            rx="32"
            fill="none"
            stroke="#fff"
            strokeWidth="14"
          />
          <circle cx="120" cy="120" r="32" fill="none" stroke="#fff" strokeWidth="14" />
          <circle cx="163" cy="77" r="8" fill="#fff" />
        </svg>
      ),
    },
    {
      key: "tiktok",
      url: links.tiktok,
      svg: (
        <svg viewBox="0 0 240 240" width="24" height="24">
          <rect width="240" height="240" rx="60" fill="#010101" />
          <path
            fill="#25F4EE"
            transform="translate(-4,-4)"
            d="M141 52c6 17 18 28 39 30v22c-14 1-27-4-39-13v55c0 33-24 54-53 54-13 0-25-4-34-12-15-13-19-35-11-53 9-19 30-30 51-27v23c-9-2-19 2-24 11-4 8-3 18 3 25 6 8 17 10 26 6 8-4 13-12 13-21V52h29z"
          />
          <path
            fill="#FE2C55"
            transform="translate(4,4)"
            d="M141 52c6 17 18 28 39 30v22c-14 1-27-4-39-13v55c0 33-24 54-53 54-13 0-25-4-34-12-15-13-19-35-11-53 9-19 30-30 51-27v23c-9-2-19 2-24 11-4 8-3 18 3 25 6 8 17 10 26 6 8-4 13-12 13-21V52h29z"
          />
          <path
            fill="#fff"
            d="M141 52c6 17 18 28 39 30v22c-14 1-27-4-39-13v55c0 33-24 54-53 54-13 0-25-4-34-12-15-13-19-35-11-53 9-19 30-30 51-27v23c-9-2-19 2-24 11-4 8-3 18 3 25 6 8 17 10 26 6 8-4 13-12 13-21V52h29z"
          />
        </svg>
      ),
    },
  ];

  const active = items.filter((i) => i.url);
  if (active.length === 0) return null;

  return (
    <div className="flex justify-center gap-4 mt-4">
      {active.map((i) => (
        <a
          key={i.key}
          href={i.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center bg-bgSurface"
        >
          {i.svg}
        </a>
      ))}
    </div>
  );
}
