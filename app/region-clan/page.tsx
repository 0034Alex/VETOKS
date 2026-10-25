"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { apiPost } from "@/lib/authClient";
import ReportSheet from "@/components/ReportSheet";
import OwnTextActions from "@/components/OwnTextActions";
import { useViewCategory } from "@/lib/viewCategory";
import { viewInfo } from "@/lib/viewCategory";
import { CategoryStrip } from "@/components/CategorySwitch";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  users: { first_name: string | null } | { first_name: string | null }[] | null;
};

export default function RegionClanPage() {
  const router = useRouter();
  const vc = useViewCategory();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [reportFor, setReportFor] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load(_regionId: string, cat: string = vc.view) {
    const r = await apiPost("/api/clan/list", { cat });
    if (r?.ok) {
      setMessages(((r.messages ?? []) as any[]).map((m) => ({ ...m, users: { first_name: m.name } })) as unknown as Message[]);
      setMemberCount(r.memberCount ?? 0);
      setLoadErr("");
    } else {
      setLoadErr(String(r?.detail || r?.error || "нет ответа"));
    }
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
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (me?.region_id && vc.ready) load(me.region_id, vc.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.region_id, vc.ready, vc.view]);

  useEffect(() => {
    if (!me?.region_id) return;
    const interval = setInterval(() => load(me.region_id!, vc.view), 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.region_id, vc.view]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const ERRORS: Record<string, string> = {
    empty: "Напишите сообщение.",
    long: "Слишком длинное — до 500 символов.",
    links: "В клане нельзя отправлять ссылки и адреса. Только текст.",
    bad_words: "В сообщении есть недопустимые слова. Пожалуйста, перепишите его без грубостей.",
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
      await load(me.region_id, vc.view);
    } else {
      setErr(ERRORS[r?.error] ?? "Не удалось отправить, попробуйте ещё раз.");
      if (r?.error === "verify") window.dispatchEvent(new Event("vetoks:verify-phone"));
    }
    setSending(false);
  }

  function report(id: string) {
    setReportFor(id);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (!me?.region_id) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <h1 className="text-2xl font-semibold text-gold mb-4">Клан региона</h1>
        <p className="text-muted max-w-sm">
          Сначала укажите свой регион в «Редактировать профиль» — клан
          определяется автоматически по нему.
        </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28 flex flex-col">
      <PageHeader />
      <div className="max-w-3xl mx-auto w-full flex flex-col flex-1">
        <CategoryStrip />
        <div className="px-6 mb-4">
          <h1 className="text-xl font-semibold text-offwhite">
            Клан «{me.regions?.name ?? "Мой регион"}» · {viewInfo(vc.view).label}
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
                data-notranslate="1"
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isMine
                    ? "self-end bg-gold text-bgPrimary"
                    : "self-start bg-bgSurface text-offwhite border border-muted"
                }`}
              >
                {!isMine && (
                  <button
                    type="button"
                    onClick={() => router.push(`/u/${m.user_id}`)}
                    className="block text-gold text-[10px] font-semibold mb-0.5 underline-offset-2 hover:underline"
                  >
                    {senderName ?? "Гость"}
                  </button>
                )}
                {isMine ? (
                  <OwnTextActions api="/api/clan/manage" id={m.id} body={m.body} light onDone={() => me.region_id && load(me.region_id, vc.view)}>
                    {m.body}
                    {(m as any).edited_at && <span className="opacity-60 text-[10px] ml-1">изменено</span>}
                  </OwnTextActions>
                ) : (
                  m.body
                )}
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
        {loadErr && <p data-notranslate="1" className="px-6 mt-3 text-muted text-[10px]">Ошибка загрузки: {loadErr}</p>}
        {vc.view !== vc.mine && (
          <p className="px-6 mt-2 text-muted text-xs text-center">Чужая категория: читать можно, писать — только в своей.</p>
        )}
        <div className={`px-6 mt-2 flex gap-2 ${vc.view !== vc.mine ? "hidden" : ""}`}>
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
      <ReportSheet
        open={!!reportFor}
        onClose={() => {
          if (reportFor) setReported((x) => new Set(x).add(reportFor));
          setReportFor(null);
        }}
        target={{ type: "clan", messageId: reportFor ?? "" }}
      />
      <BottomNav />
    </main>
  );
}
