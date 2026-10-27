"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { applyTheme } from "@/lib/showTheme";
import { publishShow } from "@/lib/useShow";

const K_THEME = "vt_show_theme";
const K_THEME_PV = "vt_show_theme_pv";
const K_TOKEN = "vt_preview_token";
const K_ID = "vt_preview_id";

function ls(k: string, v?: string | null): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
  return null;
}

// Подставляет цвета активного шоу. В CRM цвета не меняются.
// Предпросмотр: сотрудник (из CRM) или человек по секретной ссылке ?show_preview=…
export default function ShowTheme() {
  const pathname = usePathname() || "/";
  const isAdmin = pathname.startsWith("/admin");
  const [pv, setPv] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      applyTheme(null);
      publishShow(null);
      return;
    }
    let dead = false;
    try {
      const q = new URLSearchParams(window.location.search).get("show_preview");
      if (q) {
        ls(K_TOKEN, q);
        ls(K_ID, null);
      }
    } catch {}
    const token = ls(K_TOKEN) || "";
    const previewId = ls(K_ID) || "";
    (async () => {
      let bearer: string | undefined;
      try {
        const { data } = await supabase.auth.getSession();
        bearer = data.session?.access_token;
      } catch {}
      try {
        const res = await fetch("/api/show/active", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
          body: JSON.stringify({ token, previewId }),
        });
        const r = await res.json();
        if (dead || !r?.ok) return;
        const theme = r.show?.theme ?? null;
        applyTheme(theme);
        const preview = !!r.preview;
        publishShow(r.show ? { id: r.show.id, key: r.show.key, title: r.show.title, contest: r.show.contest, preview } : null);
        ls(preview ? K_THEME_PV : K_THEME, JSON.stringify(theme ?? {}));
        setPv(preview ? r.show?.title ?? "шоу" : null);
        if (!preview && (token || previewId)) {
          // ссылка устарела или предпросмотр выключен — возвращаем обычный вид
          ls(K_TOKEN, null);
          ls(K_ID, null);
        }
      } catch {}
    })();
    return () => {
      dead = true;
    };
  }, [isAdmin, pathname]);

  if (!pv || isAdmin) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[500] flex justify-center pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="pointer-events-auto mt-1 flex items-center gap-2 bg-black/85 border border-gold/60 text-gold text-[11px] rounded-full px-3 py-1">
        <span>Предпросмотр: {pv}</span>
        <button
          onClick={() => {
            const fromCrm = !!ls(K_ID);
            ls(K_TOKEN, null);
            ls(K_ID, null);
            ls(K_THEME_PV, null);
            window.location.href = fromCrm ? "/admin" : "/";
          }}
          className="underline"
        >
          выйти
        </button>
      </div>
    </div>
  );
}
