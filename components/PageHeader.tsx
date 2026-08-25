"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";
import Logo from "./Logo";

export default function PageHeader() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", u.id)
        .eq("is_read", false);
      setUnread(count ?? 0);
    })();
  }, []);

  return (
    <div
      className="flex items-center justify-between px-4 py-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Link
        href="/seasons"
        className="text-gold text-xs font-semibold border border-gold/50 rounded-full px-3 py-1.5 whitespace-nowrap"
      >
        📅 Сезоны
      </Link>
      <Logo size={26} />
      <Link href="/notifications" className="relative text-xl">
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
