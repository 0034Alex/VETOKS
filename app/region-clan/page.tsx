"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  users: { first_name: string | null } | { first_name: string | null }[] | null;
};

export default function RegionClanPage() {
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load(regionId: string) {
    const { data } = await supabase
      .from("region_clan_messages")
      .select("id, user_id, body, created_at, users(first_name)")
      .eq("region_id", regionId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data as unknown as Message[]) ?? []);

    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("region_id", regionId);
    setMemberCount(count ?? 0);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/region-clan");
        return;
      }
      if (!u.region_id) {
        setLoading(false);
        return;
      }
      setMe(u);
      await load(u.region_id);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!me?.region_id) return;
    const interval = setInterval(() => load(me.region_id!), 6000);
    return () => clearInterval(interval);
  }, [me?.region_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!me?.region_id || !text.trim()) return;
    setSending(true);
    await supabase.from("region_clan_messages").insert({
      region_id: me.region_id,
      user_id: me.id,
      body: text.trim(),
    });
    setText("");
    await load(me.region_id);
    setSending(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!me?.region_id) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Клан региона</h1>
        <p className="text-muted max-w-sm">
          Сначала укажите свой регион в «Редактировать профиль» — клан
          определяется автоматически по нему.
        </p>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 flex flex-col">
      <PageHeader />
      <div className="max-w-3xl mx-auto w-full flex flex-col flex-1">
        <div className="px-6 mb-4">
          <h1 className="text-xl font-semibold text-offwhite">
            Клан «{me.regions?.name ?? "Мой регион"}»
          </h1>
          <p className="text-muted text-xs mt-1">
            {memberCount} {memberCount === 1 ? "участник" : "участников"} региона
          </p>
        </div>

        <div className="flex-1 px-6 flex flex-col gap-2 overflow-y-auto">
          {messages.length === 0 && (
            <p className="text-muted text-sm text-center py-8">
              Пока никто не писал — начните обсуждение первым!
            </p>
          )}
          {messages.map((m) => {
            const senderName = Array.isArray(m.users)
              ? m.users[0]?.first_name
              : m.users?.first_name;
            const isMine = m.user_id === me.id;
            return (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isMine
                    ? "self-end bg-gold text-bgPrimary"
                    : "self-start bg-bgSurface text-offwhite border border-muted"
                }`}
              >
                {!isMine && (
                  <p className="text-gold text-[10px] font-semibold mb-0.5">
                    {senderName ?? "Гость"}
                  </p>
                )}
                {m.body}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="px-6 mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Написать в клан..."
            className="flex-1 bg-bgSurface text-offwhite border border-muted rounded-full px-4 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40"
          >
            Отправить
          </button>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
