"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/authClient";

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
  const [err, setErr] = useState("");
  const [reported, setReported] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load(regionId: string) {
    const { data } = await supabase
      .from("region_clan_messages")
      .select("id, user_id, body, created_at, users(first_name)")
      .eq("region_id", regionId)
      .eq("is_hidden", false)
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

  const ERRORS: Record<string, string> = {
    empty: "Напишите сообщение.",
    long: "Слишком длинное — до 500 символов.",
    links: "В клане нельзя отправлять ссылки и адреса. Только текст.",
    verify: "Писать в клан можно после подтверждения номера в Telegram.",
    muted: "Вам временно запрещено писать в клан.",
    rate_10s: "Не так быстро — одно сообщение в 10 секунд.",
    rate_hour: "Достигнут лимит: 30 сообщений в час.",
    no_region: "Укажите регион в профиле.",
  };

  async function send() {
    if (!me?.region_id || !text.trim()) return;
    setSending(true);
    setErr("");
    const r = await apiPost("/api/clan/send", { text });
    if (r?.ok) {
      setText("");
      await load(me.region_id);
    } else {
      setErr(ERRORS[r?.error] ?? "Не удалось отправить, попробуйте ещё раз.");
      if (r?.error === "verify") window.dispatchEvent(new Event("vetoks:verify-phone"));
    }
    setSending(false);
  }

  async function report(id: string) {
    if (!confirm("Пожаловаться на это сообщение?")) return;
    await apiPost("/api/clan/report", { messageId: id });
    setReported((s) => new Set(s).add(id));
  }

  if (loading) {
    return (
      <LoadingScreen />
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
                {!isMine && (
                  <button
                    onClick={() => report(m.id)}
                    disabled={reported.has(m.id)}
                    className="block text-muted text-[10px] mt-1 underline disabled:no-underline"
                  >
                    {reported.has(m.id) ? "Жалоба отправлена" : "Пожаловаться"}
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {err && <p className="px-6 mt-3 text-danger text-xs">{err}</p>}
        <p className="px-6 mt-2 text-muted text-[10px]">Только текст, без ссылок. Лимит: 1 сообщение в 10 секунд.</p>
        <div className="px-6 mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
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
