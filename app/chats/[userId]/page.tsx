"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import SharedPost from "@/components/SharedPost";
import ReportSheet from "@/components/ReportSheet";
import { apiPost } from "@/lib/authClient";
import { chatGiftEmoji } from "@/lib/chatGifts";

type Msg = { id: string; sender_id: string; body: string; kind: string; meta: any; created_at: string };

const ERRORS: Record<string, string> = {
  dm_closed: "Этот человек закрыл личные сообщения.",
  cant_send: "Написать этому человеку нельзя.",
  you_blocked: "Вы заблокировали этого человека. Сначала разблокируйте.",
  request_limit: "Пока человек не принял запрос, можно отправить только 3 сообщения.",
  banned: "Аккаунт заблокирован.",
  too_many_requests: "Сегодня вы уже отправили много запросов. Попробуйте завтра.",
  no_contacts_in_request: "Пока человек не принял запрос, нельзя отправлять ссылки, телефоны и ники соцсетей.",
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const other = params.userId as string;

  const [me, setMe] = useState("");
  const [name, setName] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isRequestForMe, setIsRequestForMe] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [dmClosed, setDmClosed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [reported, setReported] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [hasThread, setHasThread] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [gifts, setGifts] = useState<{ id: string; name: string; price: number }[]>([]);
  const [balance, setBalance] = useState(0);
  const [giftMsg, setGiftMsg] = useState("");
  const [giftBusy, setGiftBusy] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    const r = await apiPost("/api/dm/thread", { withUserId: other });
    if (!r?.ok) return;
    setMe(r.me);
    setName(r.name);
    setMessages(r.messages);
    setIsRequestForMe(r.isRequestForMe);
    setBlockedByMe(r.blockedByMe);
    setBlockedMe(r.blockedMe);
    setDmClosed(r.dmClosed);
    setAccepted(!!r.accepted);
    setHasThread(!!r.hasThread);
  }, [other]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push(`/login?redirect=/chats/${other}`);
        return;
      }
      await load();
      timer = setInterval(load, 4000);
    })();
    return () => clearInterval(timer);
  }, [load, other, router]);

  useEffect(() => {
    if (messages.length !== count.current) {
      count.current = messages.length;
      bottom.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/dm/send", { toUserId: other, body: text.trim() });
    if (r?.ok) {
      setText("");
      await load();
    } else setErr(ERRORS[r?.error] ?? "Не удалось отправить. Попробуйте ещё раз.");
    setBusy(false);
  }

  async function openGifts() {
    setGiftMsg("");
    setGiftOpen(true);
    const r = await apiPost("/api/dm/gift-catalog");
    if (r?.ok) {
      setGifts(r.items);
      setBalance(r.balance);
    }
  }

  async function sendGift(id: string) {
    setGiftBusy(id);
    setGiftMsg("");
    const r = await apiPost("/api/dm/gift", { toUserId: other, giftId: id, qty: 1 });
    setGiftBusy("");
    if (r?.ok) {
      setBalance(r.balance);
      setGiftOpen(false);
      await load();
    } else if (r?.error === "not_enough") {
      setGiftMsg("Недостаточно средств. Пополните баланс в разделе «Подарки».");
    } else {
      setGiftMsg(ERRORS[r?.error] ?? "Не удалось отправить подарок.");
    }
  }

  async function act(action: string, extra: object = {}) {
    await apiPost("/api/dm/action", { action, userId: other, ...extra });
    setMenu(false);
    if (action === "decline") {
      router.push("/chats");
      return;
    }
    await load();
  }

  const canWrite = !blockedByMe && !blockedMe && !dmClosed;

  return (
    <main className="min-h-screen flex flex-col" style={{ paddingBottom: 0 }}>
      <div
        className="sticky top-0 z-20 bg-bgPrimary border-b border-muted px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button onClick={() => router.push("/chats")} className="text-offwhite text-xl">←</button>
        <button onClick={() => router.push(`/u/${other}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center font-semibold flex-none">
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-offwhite font-semibold flex-1 truncate">{name}</p>
        </button>
        <button onClick={() => setMenu((v) => !v)} className="text-offwhite text-2xl leading-none px-2">⋯</button>
        {menu && (
          <div className="absolute right-4 top-full mt-1 bg-bgSurface border border-muted rounded-xl overflow-hidden z-30 w-56">
            <button
              onClick={() => {
                setMenu(false);
                setReported(false);
                setReport(true);
              }}
              className="w-full text-left px-4 py-3 text-offwhite text-sm border-b border-muted"
            >
              ⚑ Пожаловаться
            </button>
            {blockedByMe ? (
              <button onClick={() => act("unblock")} className="w-full text-left px-4 py-3 text-offwhite text-sm">
                Разблокировать
              </button>
            ) : (
              <button
                onClick={() => confirm("Заблокировать? Этот человек больше не сможет вам писать.") && act("block")}
                className="w-full text-left px-4 py-3 text-danger text-sm"
              >
                Заблокировать
              </button>
            )}
          </div>
        )}
      </div>

      {isRequestForMe && (
        <div className="px-4 py-3 bg-bgSurface border-b border-muted">
          <p className="text-offwhite text-sm mb-2">
            {name} хочет вам написать. Вы не подписаны на этого человека, поэтому это запрос.
          </p>
          <div className="flex gap-2">
            <button onClick={() => act("accept")} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-2 text-sm">
              Принять
            </button>
            <button onClick={() => act("decline")} className="flex-1 border border-muted text-offwhite rounded-full py-2 text-sm">
              Удалить
            </button>
            <button
              onClick={async () => {
                await act("block");
                router.push("/chats");
              }}
              className="flex-1 border border-danger text-danger rounded-full py-2 text-sm"
            >
              Блок
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 py-4 flex flex-col gap-2 overflow-y-auto" style={{ paddingBottom: "170px" }}>
        {messages.length === 0 && <p className="text-muted text-sm text-center mt-8">Напишите первое сообщение.</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm break-words ${
              m.sender_id === me ? "self-end bg-gold text-bgPrimary" : "self-start bg-bgSurface text-offwhite border border-muted"
            }`}
          >
            {m.kind === "gift" ? <span className="text-lg">{m.body}</span> : m.kind === "post" && m.meta?.postId ? <SharedPost postId={String(m.meta.postId)} /> : m.body}
            <span className={`block text-[10px] mt-0.5 ${m.sender_id === me ? "text-bgPrimary/60" : "text-muted"}`}>
              {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <div
        className="fixed left-0 right-0 bottom-0 z-40 bg-bgPrimary border-t border-muted px-4 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {blockedByMe ? (
          <p className="text-muted text-sm text-center py-2">Вы заблокировали этого человека.</p>
        ) : blockedMe ? (
          <p className="text-muted text-sm text-center py-2">Написать этому человеку нельзя.</p>
        ) : dmClosed ? (
          <p className="text-muted text-sm text-center py-2">Этот человек закрыл личные сообщения.</p>
        ) : (
          <>
            {err && <p className="text-danger text-xs mb-2">{err}</p>}
            <div className="flex gap-2 max-w-3xl mx-auto">
              {hasThread && accepted && !isRequestForMe && (
                <button
                  onClick={openGifts}
                  aria-label="Подарок"
                  className="border border-gold text-xl rounded-full w-11 flex-shrink-0"
                >
                  🎁
                </button>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Сообщение..."
                maxLength={2000}
                className="flex-1 bg-bgSurface text-offwhite border border-muted rounded-full px-4 py-2.5 text-sm"
              />
              <button
                onClick={send}
                disabled={busy || !text.trim() || !canWrite}
                className="bg-gold text-bgPrimary font-semibold px-5 rounded-full text-sm disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>

      {giftOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center" onClick={() => setGiftOpen(false)}>
          <div
            className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-offwhite font-semibold">Подарок для {name}</p>
              <button onClick={() => setGiftOpen(false)} className="text-muted text-xl">✕</button>
            </div>
            <p className="text-muted text-xs mb-3">Ваш баланс: {balance} ₴</p>
            <div className="grid grid-cols-3 gap-2">
              {gifts.map((g) => (
                <button
                  key={g.id}
                  disabled={!!giftBusy}
                  onClick={() => sendGift(g.id)}
                  className="bg-bgPrimary border border-muted rounded-xl py-3 flex flex-col items-center gap-1 disabled:opacity-50"
                >
                  <span className="text-3xl">{chatGiftEmoji(g.name)}</span>
                  <span className="text-offwhite text-xs">{g.name}</span>
                  <span className="text-gold text-xs font-semibold">{giftBusy === g.id ? "..." : `${g.price} ₴`}</span>
                </button>
              ))}
            </div>
            {gifts.length === 0 && <p className="text-muted text-sm text-center py-4">Подарков пока нет.</p>}
            {giftMsg && <p className="text-danger text-xs mt-3">{giftMsg}</p>}
          </div>
        </div>
      )}

      <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "dm", userId: other }} />
    </main>
  );
}
