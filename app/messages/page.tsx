"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

type Message = {
  id: string;
  body: string;
  price: number;
  created_at: string;
  sender_id: string;
};

export default function MessagesPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);

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

      const { data: msgs } = await supabase
        .from("participant_messages")
        .select("id, body, price, created_at, sender_id")
        .eq("participant_id", p.id)
        .order("created_at", { ascending: false });

      setMessages((msgs as Message[]) ?? []);

      const senderIds = [
        ...new Set((msgs ?? []).map((m: Message) => m.sender_id)),
      ];
      if (senderIds.length > 0) {
        const { data: senders } = await supabase
          .from("users")
          .select("id, first_name")
          .in("id", senderIds);
        const map: Record<string, string> = {};
        (senders ?? []).forEach((s: { id: string; first_name: string }) => {
          map[s.id] = s.first_name;
        });
        setSenderNames(map);
      }

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
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>

      <h1 className="text-2xl font-semibold text-offwhite mb-6 px-6">
        Сообщения
      </h1>

      {messages.length === 0 && (
        <p className="text-muted text-center px-6">Пока нет сообщений.</p>
      )}

      <div className="px-6 flex flex-col gap-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className="bg-bgSurface border border-muted rounded-xl p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-offwhite text-sm font-semibold">
                {senderNames[m.sender_id] ?? "Гость"}
              </span>
              <span className="text-gold text-xs">
                {m.price.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            <p className="text-offwhite text-sm">{m.body}</p>
            <p className="text-muted text-xs mt-2">
              {new Date(m.created_at).toLocaleString("ru-RU")}
            </p>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
