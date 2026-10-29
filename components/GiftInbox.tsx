"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { fireGiftFx, GiftFxEvent } from "@/lib/giftFx";

// Невидимый компонент в layout: показывает участнице подаренный ей подарок на весь экран.
// Онлайн — сразу; была не в сети — при входе самый дорогой из новых, остальные можно пересмотреть в «Подарки».
export default function GiftInbox() {
  useEffect(() => {
    let dead = false;
    let uid: string | null = null;
    let chans: any[] = [];
    let busy = false;
    let lastRun = 0;

    const run = async () => {
      if (dead || busy || !uid || Date.now() - lastRun < 4000) return;
      busy = true;
      lastRun = Date.now();
      try {
        const r: any = await apiPost("/api/gifts/fx", { action: "unseen" });
        if (dead || !r?.ok) return;
        if (r.pids?.length && !chans.length) listen(r.pids);
        const items: any[] = r.items ?? [];
        if (!items.length) return;
        const top = items.reduce((a, b) => (b.total > a.total ? b : a), items[0]);
        const e: GiftFxEvent = {
          name: top.name, art: top.art, category: top.category, usd: top.usd,
          fx: top.fx === "off" ? "off" : "full", qty: top.qty, from: top.from, avatar: top.avatar,
        };
        fireGiftFx(e);
        await apiPost("/api/gifts/fx", { action: "ack", seen: items.map((i) => i.id), played: [top.id] });
      } catch {} finally { busy = false; }
    };

    const listen = (pids: string[]) => {
      pids.forEach((pid) => {
        const ch = supabase.channel("gfx:" + pid);
        ch.on("broadcast", { event: "gift" }, (m: any) => {
          if (m?.payload?.to_uid === uid) setTimeout(run, 700);
        }).subscribe();
        chans.push(ch);
      });
    };

    const onVis = () => { if (document.visibilityState === "visible") run(); };
    (async () => {
      const { data } = await supabase.auth.getSession();
      uid = data.session?.user.id ?? null;
      if (!uid || dead) return;
      setTimeout(run, 1500);
    })();
    document.addEventListener("visibilitychange", onVis);
    const poll = setInterval(run, 60000);
    return () => {
      dead = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      chans.forEach((c) => supabase.removeChannel(c));
    };
  }, []);
  return null;
}
