"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const captchaOn = !!SITE_KEY;

declare global {
  interface Window {
    turnstile?: any;
  }
}

// Капча Cloudflare («я не робот»). Если ключ не задан — ничего не показываем.
export default function TurnstileBox({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) {
      cb.current("");
      return;
    }
    let widget: any = null;
    let dead = false;
    function draw() {
      if (dead || !box.current || !window.turnstile) return;
      widget = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: (t: string) => cb.current(t),
        "expired-callback": () => cb.current(""),
        "error-callback": () => cb.current(""),
      });
    }
    if (window.turnstile) {
      draw();
    } else {
      let s = document.querySelector("script[data-turnstile]") as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        s.defer = true;
        s.setAttribute("data-turnstile", "1");
        document.head.appendChild(s);
      }
      s.addEventListener("load", draw);
    }
    return () => {
      dead = true;
      try {
        if (widget !== null) window.turnstile?.remove(widget);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return SITE_KEY ? <div ref={box} className="flex justify-center min-h-[65px]" /> : null;
}
