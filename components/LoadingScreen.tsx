"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoadingScreen() {
  const [sponsorLogo, setSponsorLogo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "sponsor_logo_url")
        .maybeSingle();
      if (data?.value) setSponsorLogo(data.value);
    })();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bgPrimary">
      <svg
        width={90}
        height={54}
        viewBox="0 0 100 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="goldGradLoading" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8D48A" />
            <stop offset="100%" stopColor="#C9A227" />
          </linearGradient>
          <filter id="crownGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Базовый тусклый контур короны */}
        <path
          d="M10 50 L20 15 L35 35 L50 8 L65 35 L80 15 L90 50 Z"
          fill="none"
          stroke="#4a3f2a"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Бегущий золотой свет по контуру */}
        <path
          d="M10 50 L20 15 L35 35 L50 8 L65 35 L80 15 L90 50 Z"
          fill="none"
          stroke="url(#goldGradLoading)"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="40 220"
          filter="url(#crownGlow)"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="260"
            to="0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>

        <circle cx="50" cy="8" r="4" fill="url(#goldGradLoading)" filter="url(#crownGlow)" />
        <circle cx="20" cy="15" r="3" fill="url(#goldGradLoading)" filter="url(#crownGlow)" />
        <circle cx="80" cy="15" r="3" fill="url(#goldGradLoading)" filter="url(#crownGlow)" />
      </svg>
      <span className="text-gold font-semibold tracking-[0.25em] text-sm">
        VETOKS
      </span>

      {sponsorLogo && (
        <div className="flex flex-col items-center gap-1.5 mt-4">
          <span className="text-muted text-[9px] tracking-[0.2em]">
            ГЕНЕРАЛЬНЫЙ ПАРТНЁР
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sponsorLogo} alt="" className="h-8 object-contain opacity-90" />
        </div>
      )}
    </div>
  );
}
