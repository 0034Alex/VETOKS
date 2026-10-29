"use client";

import PresenceLine from "@/components/PresenceLine";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import SharedPost from "@/components/SharedPost";
import OwnTextActions from "@/components/OwnTextActions";
import ReportSheet from "@/components/ReportSheet";
import { apiPost } from "@/lib/authClient";
import { chatGiftEmoji } from "@/lib/chatGifts";
import { getCurrencySymbol } from "@/lib/currency";

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
  const [photo, setPhoto] = useState<string | null>(null);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
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
  const [, setReported] = useState(false);
  const [, setAccepted] = useState(false);
  const [, setHasThread] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [gifts, setGifts] = useState<{ id: string; name: string; art?: string | null; price: number }[]>([]);
  const [balance, setBalance] = useState(0);
  const [cur, setCur] = useState("\uE000");
  const [giftMsg, setGiftMsg] = useState("");
  const [giftBusy, setGiftBusy] = useState("");
  const [giftSel, setGiftSel] = useState("");
  const [giftQty, setGiftQty] = useState(1);
  const [showcase, setShowcase] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const load = useCallback(async () => {
    const r = await apiPost("/api/dm/thread", { withUserId: other });
    if (!r?.ok) return;
    setMe(r.me);
    setName(r.name);
    setPhoto(r.photo ?? null);
    setMyPhoto(r.myPhoto ?? null);
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
    getCurrencySymbol().then(setCur).catch(() => {});
    const r = await apiPost("/api/dm/gift-catalog");
    if (r?.ok) {
      setGifts(r.items);
      setBalance(r.balance);
    }
  }

  // Назад — туда, откуда пришли (страница участницы, список чатов), а не по кругу.
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/chats");
  }

  async function sendGift(id: string) {
    if (!id) return;
    setGiftBusy(id);
    setGiftMsg("");
    const r = await apiPost("/api/dm/gift", { toUserId: other, giftId: id, qty: giftQty });
    setGiftBusy("");
    if (r?.ok) {
      setBalance(r.balance);
      setGiftOpen(false);
      setGiftSel("");
      setGiftQty(1);
      await load();
    } else if (r?.error === "not_enough") {
      setGiftMsg("Недостаточно средств на балансе.");
    } else {
      setGiftMsg(ERRORS[r?.error] ?? "Не удалось отправить подарок.");
    }
  }

  async function act(action: string, extra: object = {}) {
    await apiPost("/api/dm/action", { action, userId: other, ...extra });
    setMenu(false);
    if (action === "decline") {
      router.replace("/chats");
      return;
    }
    await load();
  }

  const giftPrice = gifts.find((g) => g.id === giftSel)?.price ?? 0;
  const needMore = giftSel ? Math.max(0, Math.ceil(giftPrice * giftQty - balance)) : 0;
  const canWrite = !blockedByMe && !blockedMe && !dmClosed;

  // Витрина подарков этого чата: что подарили вы и что подарили вам.
  const giftLog = messages.filter((m) => m.kind === "gift");
  const gTotals: Record<string, { name: string; icon: string; mine: number; theirs: number }> = {};
  giftLog.forEach((m) => {
    const nm: string = m.meta?.name || String(m.body || "").replace(/^\S+\s/, "").replace(/\s×\d+$/, "");
    const q = Number(m.meta?.qty) || 1;
    const g = (gTotals[nm] = gTotals[nm] ?? { name: nm, icon: String(m.body || "").split(" ")[0] || chatGiftEmoji(nm), mine: 0, theirs: 0 });
    if (m.sender_id === me) g.mine += q;
    else g.theirs += q;
  });
  const gList = Object.values(gTotals).sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs));

  return (
    <main className="min-h-screen flex flex-col" style={{ paddingBottom: 0 }}>
      <div
        className="sticky top-0 z-20 bg-bgPrimary border-b border-muted px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <button onClick={goBack} className="text-offwhite text-xl">←</button>
        <button onClick={() => router.push(`/u/${other}`)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-sec to-sec2 bg-cover bg-center text-white flex items-center justify-center font-semibold flex-none"
            style={photo ? { backgroundImage: `url(${photo})` } : undefined}
          >
            {!photo && (name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-offwhite font-semibold truncate">{name}</p>
            <PresenceLine userId={other} />
          </div>
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

      {gList.length > 0 && (
        <div className="flex items-center gap-2 pl-4 pr-2 py-2 bg-bgSurface/70 border-b border-muted">
          <div className="flex gap-1.5 flex-1 min-w-0 overflow-x-auto" style={{ scrollbarWidth: "none", touchAction: "pan-x" }}>
            {gList.map((g) => (
              <button key={g.name} onClick={() => setShowcase(true)} className="flex items-center gap-1 bg-bgPrimary border border-gold/40 rounded-full px-2.5 py-1 text-sm flex-none">
                <span className="text-xl leading-none">{g.icon}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowcase(true)} className="text-gold text-xs flex-none px-2 py-1">
            Все ›
          </button>
        </div>
      )}

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
                router.replace("/chats");
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
        {messages.map((m) => {
          const mine = m.sender_id === me;
          const ph = mine ? myPhoto : photo;
          const nm = mine ? "Я" : name;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <span
                className="w-7 h-7 rounded-full bg-gradient-to-br from-sec to-sec2 bg-cover bg-center text-white text-xs font-semibold flex items-center justify-center flex-none"
                style={ph ? { backgroundImage: `url(${ph})` } : undefined}
              >
                {!ph && (nm || "?").slice(0, 1).toUpperCase()}
              </span>
              <div
                className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm break-words ${
                  mine ? "bg-gold text-bgPrimary" : "bg-bgSurface text-offwhite border border-muted"
                }`}
              >
                {m.kind === "gift" ? (
                  <span className="text-lg">{m.body}</span>
                ) : m.kind === "post" && m.meta?.postId ? (
                  <SharedPost postId={String(m.meta.postId)} />
                ) : m.meta?.deleted ? (
                  <span className="italic opacity-60">{m.body}</span>
                ) : mine && (!m.kind || m.kind === "text") ? (
                  <OwnTextActions api="/api/dm/manage" id={m.id} body={m.body} light onDone={() => load()}>
                    {m.body}
                    {m.meta?.edited && <span className="opacity-60 text-[10px] ml-1">изменено</span>}
                  </OwnTextActions>
                ) : (
                  <>
                    {m.body}
                    {m.meta?.edited && <span className="opacity-60 text-[10px] ml-1">изменено</span>}
                  </>
                )}
                <span className={`block text-[10px] mt-0.5 ${mine ? "text-bgPrimary/60" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          );
        })}
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
              {!isRequestForMe && (
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
            className="w-full max-w-md bg-bgSurface rounded-t-2xl p-5 flex flex-col max-h-[85dvh]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-offwhite font-semibold">Подарок для {name}</p>
              <button onClick={() => setGiftOpen(false)} className="text-muted text-xl">✕</button>
            </div>
            <p className="text-muted text-xs mb-3">Ваш баланс: {balance} {cur}</p>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto min-h-0 flex-1" style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}>
              {gifts.map((g) => (
                <button
                  key={g.id}
                  disabled={!!giftBusy}
                  onClick={() => {
                    if (giftSel === g.id) setGiftQty((q) => Math.min(1000, q + 1));
                    else {
                      setGiftSel(g.id);
                      setGiftQty(1);
                    }
                  }}
                  className={`relative rounded-xl py-3 flex flex-col items-center gap-1 disabled:opacity-50 border ${giftSel === g.id ? "border-gold bg-gold/10" : "border-muted bg-bgPrimary"}`}
                >
                  {giftSel === g.id && (
                    <span className="absolute -top-1.5 -right-1 min-w-[24px] h-6 px-1.5 rounded-full bg-gold text-bgPrimary text-xs font-bold flex items-center justify-center">+{giftQty}</span>
                  )}
                  <span className="text-4xl leading-none">{chatGiftEmoji(g.name, g.art)}</span>
                  <span className="text-offwhite text-xs">{g.name}</span>
                  <span className="text-gold text-xs font-semibold">{g.price} {cur}</span>
                </button>
              ))}
            </div>
            {giftSel && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <button onClick={() => setGiftQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-full border border-muted text-offwhite text-xl" aria-label="Меньше">−</button>
                <input
                  value={giftQty}
                  inputMode="numeric"
                  onChange={(e) => setGiftQty(Math.min(1000, Math.max(1, parseInt(e.target.value.replace(/\D/g, "") || "1", 10))))}
                  className="w-20 h-10 text-center bg-bgPrimary border border-muted rounded-full text-offwhite"
                />
                <button onClick={() => setGiftQty((q) => Math.min(1000, q + 1))} className="w-10 h-10 rounded-full border border-muted text-offwhite text-xl" aria-label="Больше">+</button>
                <button onClick={() => setGiftQty((q) => Math.min(1000, q + 10))} className="h-10 px-3 rounded-full border border-gold/60 text-gold text-sm">+10</button>
                <button onClick={() => setGiftQty((q) => Math.min(1000, q + 100))} className="h-10 px-3 rounded-full border border-gold/60 text-gold text-sm">+100</button>
              </div>
            )}
            {giftSel && needMore > 0 && (
              <p className="text-danger text-xs text-center mt-3">Не хватает {needMore} {cur} (баланс {balance} {cur})</p>
            )}
            {gifts.length > 0 && giftSel && needMore > 0 ? (
              <button onClick={() => router.push("/balance")} className="mt-3 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full">
                Пополнить баланс
              </button>
            ) : null}
            {gifts.length > 0 && !(giftSel && needMore > 0) && (
              <button
                onClick={() => sendGift(giftSel)}
                disabled={!giftSel || !!giftBusy}
                className="mt-4 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-40"
              >
                {giftBusy ? "Отправляем…" : giftSel ? `Подарить ${giftQty > 1 ? `×${giftQty} ` : ""}· ${(gifts.find((g) => g.id === giftSel)?.price ?? 0) * giftQty} ${cur}` : "Выберите подарок"}
              </button>
            )}
            {gifts.length === 0 && <p className="text-muted text-sm text-center py-4">Подарков пока нет.</p>}
            {giftMsg && <p className="text-danger text-xs mt-3">{giftMsg}</p>}
            {giftMsg && (
              <button onClick={() => router.push("/balance")} className="mt-2 w-full border border-gold text-gold font-semibold py-2.5 rounded-full text-sm">
                Пополнить баланс
              </button>
            )}
          </div>
        </div>
      )}

      {showcase && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-end justify-center" onClick={() => setShowcase(false)}>
          <div
            className="w-full max-w-md max-h-[80dvh] overflow-y-auto bg-bgSurface rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-offwhite font-semibold">Подарки в этом чате</p>
              <button onClick={() => setShowcase(false)} className="text-muted text-xl">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {gList.map((g) => (
                <div key={g.name} className="bg-bgPrimary border border-gold/40 rounded-xl py-3 flex flex-col items-center gap-1">
                  <span className="text-4xl leading-none">{g.icon}</span>
                  <span className="text-offwhite text-xs">{g.name}</span>
                  <span className="text-gold text-sm font-semibold">×{g.mine + g.theirs}</span>
                </div>
              ))}
            </div>
            <p className="text-muted text-xs mt-4 mb-1">История</p>
            {[...giftLog].reverse().map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 border-b border-muted/30 text-sm">
                <span className="text-offwhite">{m.body}</span>
                <span className="text-muted text-xs">{new Date(m.created_at).toLocaleDateString("ru-RU")}</span>
              </div>
            ))}
            <button
              onClick={() => {
                setShowcase(false);
                openGifts();
              }}
              className="mt-4 w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full"
            >
              🎁 Подарить ещё
            </button>
          </div>
        </div>
      )}

      <ReportSheet open={report} onClose={() => setReport(false)} target={{ type: "dm", userId: other }} />
    </main>
  );
}
