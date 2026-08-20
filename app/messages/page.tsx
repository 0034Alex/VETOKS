"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Conversation = {
  userId: string;
  name: string;
  lastMessage: string;
  lastAt: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/messages");
        return;
      }

      const { data: p } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (!p) {
        setIsParticipant(false);
        setLoading(false);
        return;
      }
      setIsParticipant(true);
      setParticipantId(p.id);

      const { data: msgs } = await supabase
        .from("participant_messages")
        .select("id, sender_id, recipient_id, body, created_at")
        .eq("participant_id", p.id)
        .order("created_at", { ascending: false });

      const map = new Map<string, Conversation>();
      (msgs ?? []).forEach(
        (m: {
          sender_id: string;
          recipient_id: string | null;
          body: string;
          created_at: string;
        }) => {
          const otherId = m.sender_id === u.id ? m.recipient_id : m.sender_id;
          if (!otherId || map.has(otherId)) return;
          map.set(otherId, {
            userId: otherId,
            name: "",
            lastMessage: m.body,
            lastAt: m.created_at,
          });
        }
      );

      const ids = [...map.keys()];
      if (ids.length > 0) {
        const { data: senders } = await supabase
          .from("users")
          .select("id, first_name")
          .in("id", ids);
        (senders ?? []).forEach((s: { id: string; first_name: string }) => {
          const conv = map.get(s.id);
          if (conv) conv.name = s.first_name ?? "Гость";
        });
      }

      setConversations([...map.values()]);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!isParticipant) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Сообщения</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только участницам конкурса.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        Сообщения
      </h1>

      {conversations.length === 0 && (
        <p className="text-muted text-center px-6">Пока нет сообщений.</p>
      )}

      <div className="px-6 flex flex-col gap-2">
        {conversations.map((c) => (
          <Link
            key={c.userId}
            href={`/messages/${c.userId}`}
            className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col"
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-offwhite text-sm font-semibold">
                {c.name}
              </span>
              <span className="text-muted text-xs">
                {new Date(c.lastAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
            <p className="text-muted text-sm truncate">{c.lastMessage}</p>
          </Link>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
