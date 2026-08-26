"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Notification = {
  id: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/notifications");
        return;
      }

      const { data } = await supabase
        .from("notifications")
        .select("id, message, link, is_read, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data as Notification[]) ?? []);

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", u.id)
        .eq("is_read", false);

      setLoading(false);
    })();
  }, [router]);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        Уведомления
      </h1>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p className="text-muted text-center px-6">Уведомлений пока нет.</p>
      )}

      <div className="px-6 flex flex-col gap-2">
        {items.map((n) => {
          const content = (
            <div
              className={`bg-bgSurface border rounded-xl p-4 ${
                n.is_read ? "border-muted" : "border-gold"
              }`}
            >
              <p className="text-offwhite text-sm">{n.message}</p>
              <p className="text-muted text-xs mt-1">
                {new Date(n.created_at).toLocaleString("ru-RU")}
              </p>
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link}>
              {content}
            </Link>
          ) : (
            <div key={n.id}>{content}</div>
          );
        })}
      </div>

      <BottomNav />
    </main>
  );
}
