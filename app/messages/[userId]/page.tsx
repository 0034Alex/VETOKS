"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export default function ThreadPage() {
  const params = useParams();
  const router = useRouter();
  const otherUserId = params.userId as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const u = await getCurrentUser();
    if (!u) {
      router.push(`/login?redirect=/messages/${otherUserId}`);
      return;
    }
    setUserId(u.id);

    const { data: p } = await supabase
      .from("participants")
      .select("id")
      .eq("user_id", u.id)
      .maybeSingle();

    if (!p) {
      setLoading(false);
      return;
    }
    setParticipantId(p.id);

    const { data: otherUser } = await supabase
      .from("users")
      .select("first_name")
      .eq("id", otherUserId)
      .maybeSingle();
    setOtherName(otherUser?.first_name ?? "Гость");

    const { data: msgs } = await supabase
      .from("participant_messages")
      .select("id, sender_id, body, created_at")
      .eq("participant_id", p.id)
      .or(
        `and(sender_id.eq.${u.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${u.id})`
      )
      .order("created_at", { ascending: true });

    setMessages((msgs as Message[]) ?? []);

    await supabase
      .from("participant_messages")
      .update({ is_read: true })
      .eq("participant_id", p.id)
      .eq("recipient_id", u.id)
      .eq("sender_id", otherUserId)
      .eq("is_read", false);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  async function sendReply() {
    if (!userId || !participantId || !reply.trim()) return;
    setBusy(true);
    await supabase.from("participant_messages").insert({
      sender_id: userId,
      recipient_id: otherUserId,
      participant_id: participantId,
      body: reply,
      price: 0,
    });
    setReply("");
    await load();
    setBusy(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 flex flex-col">
      <PageHeader />
      <h1 className="text-xl font-semibold text-offwhite mb-4 px-6">
        {otherName}
      </h1>

      <div className="flex-1 px-6 flex flex-col gap-2 overflow-y-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.sender_id === userId
                ? "self-end bg-gold text-bgPrimary"
                : "self-start bg-bgSurface text-offwhite border border-muted"
            }`}
          >
            {m.body}
          </div>
        ))}
      </div>

      <div className="px-6 mt-4 flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Ваш ответ..."
          className="flex-1 bg-bgSurface text-offwhite border border-muted rounded-full px-4 py-2 text-sm"
        />
        <button
          onClick={sendReply}
          disabled={busy || !reply.trim()}
          className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40"
        >
          Отправить
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
