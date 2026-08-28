"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type DocRow = { id: string; title: string; content: string };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();

      let isParticipant = false;
      if (u) {
        const { data: p } = await supabase
          .from("participants")
          .select("id")
          .eq("user_id", u.id)
          .maybeSingle();
        isParticipant = !!p;
      }

      const audiences = isParticipant ? ["all", "participants"] : ["all"];

      const { data } = await supabase
        .from("documents")
        .select("id, title, content")
        .eq("is_active", true)
        .in("audience", audiences)
        .order("sort_order", { ascending: true });

      setDocs((data as DocRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        Документы
      </h1>

      {loading && <p className="text-muted text-center">Загрузка...</p>}
      {!loading && docs.length === 0 && (
        <p className="text-muted text-center px-6">Документов пока нет.</p>
      )}

      <div className="px-6 flex flex-col gap-2">
        {docs.map((d) => (
          <div key={d.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenId(openId === d.id ? null : d.id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-offwhite text-sm font-semibold">{d.title}</span>
              <span className="text-gold text-sm">{openId === d.id ? "▲" : "▼"}</span>
            </button>
            {openId === d.id && (
              <div className="px-4 pb-4 text-muted text-sm whitespace-pre-wrap">
                {d.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
