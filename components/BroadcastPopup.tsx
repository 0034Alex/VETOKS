"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

const HIDE_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/admin", "/legal", "/welcome"];

// Сообщение от команды VETOKS (рассылка из CRM) всплывает у человека сразу.
export default function BroadcastPopup() {
  const pathname = usePathname() || "/";
  const [item, setItem] = useState<{ id: string; message: string } | null>(null);
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    let stop = false;
    async function check() {
      if (stop || document.hidden) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const r = await apiPost("/api/notifications/popup", {});
      if (!stop && r?.ok && r.item) setItem((cur) => cur ?? r.item);
    }
    check();
    const t = setInterval(check, 45000);
    const onVis = () => check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hidden]);

  async function close() {
    const cur = item;
    setItem(null);
    if (cur) await apiPost("/api/notifications/popup", { action: "seen", id: cur.id });
  }

  if (!item || hidden) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center px-6">
      <div className="bg-bgSurface border border-gold/50 rounded-2xl p-6 w-full max-w-sm text-center">
        <p className="text-gold text-xs tracking-widest mb-3">VETOKS</p>
        <p className="text-offwhite text-sm whitespace-pre-wrap mb-5">{item.message}</p>
        <button onClick={close} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">
          Понятно
        </button>
      </div>
    </div>
  );
}
