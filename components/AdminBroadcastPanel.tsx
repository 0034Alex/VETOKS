"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";
import { getCrmCountry } from "@/lib/crmCountry";

type Hit = { id: string; name: string; nick: string | null; tg: boolean; cat: string };
const CATS: [string, string][] = [["teen", "TEEN 15–17"], ["main", "MISS 18–29"], ["adult", "LADY 30+"]];

// CRM → «Рассылка»: сообщение во всплывающем окне приложения и от бота в Telegram.
export default function AdminBroadcastPanel() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"all" | "category" | "users">("all");
  const [cats, setCats] = useState<string[]>(["main", "adult"]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit[]>([]);
  const [popup, setPopup] = useState(true);
  const [tg, setTg] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [countryName, setCountryName] = useState("");
  const countryId = typeof window !== "undefined" ? getCrmCountry() : "";
  useEffect(() => {
    (async () => {
      if (!countryId) return setCountryName("");
      const { data } = await supabase.from("countries").select("name").eq("id", countryId).maybeSingle();
      setCountryName((data as any)?.name ?? "");
    })();
  }, [countryId]);
  const payload = () => ({ mode, categories: cats, userIds: picked.map((p) => p.id), countryId });

  useEffect(() => {
    setConfirmed(false);
    apiPost("/api/admin/broadcast", { action: "count", ...payload() }).then((r) => setTotal(r?.ok ? r.total : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, cats, picked]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode !== "users" || q.trim().length < 2) return setHits([]);
      const r = await apiPost("/api/admin/broadcast", { action: "search", q, countryId });
      setHits(r?.items ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMsg("Отправляю…");
    let offset = 0;
    let sent = 0;
    let tgSent = 0;
    for (let i = 0; i < 200; i++) {
      const r = await apiPost("/api/admin/broadcast", { action: "send", text, offset, popup, telegram: tg, ...payload() });
      if (!r?.ok) {
        setMsg(`Остановилось на ${sent} получателях. Ошибка отправки.`);
        setBusy(false);
        return;
      }
      sent += r.sent;
      tgSent += r.tg;
      setMsg(`Отправлено: ${sent}${tg ? ` · в Telegram: ${tgSent}` : ""}…`);
      if (r.done) break;
      offset = r.next;
    }
    setMsg(`Готово. Получили в приложении: ${sent}${tg ? ` · в Telegram от бота: ${tgSent} (у кого привязан Telegram)` : ""}.`);
    setText("");
    setConfirmed(false);
    setBusy(false);
  }

  const toggleCat = (c: string) => setCats((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <div className="max-w-lg flex flex-col gap-4">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-2">📣 Сообщение от VETOKS</p>
        <p className={`text-xs mb-2 ${countryId ? "text-gold" : "text-orange-300"}`}>
          {countryId ? `Страна: ${countryName || "…"}. Получат только люди этой страны, от бота этой страны.` : "Выбрано «Общие»: сообщение уйдёт людям ВСЕХ стран. Выберите страну вверху CRM, чтобы писать одной стране."}
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder="Текст сообщения"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-muted text-xs text-right">{text.length}/1000</p>

        <p className="text-offwhite text-sm font-semibold mt-3 mb-1">Кому</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {([["all", "Всем"], ["category", "По категориям"], ["users", "Выбранным людям"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-full text-xs ${mode === k ? "bg-gold text-bgPrimary font-semibold" : "border border-muted text-offwhite"}`}>
              {l}
            </button>
          ))}
        </div>

        {mode === "category" && (
          <div className="flex flex-wrap gap-3 mb-2">
            {CATS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-1 text-offwhite text-sm">
                <input type="checkbox" checked={cats.includes(k)} onChange={() => toggleCat(k)} /> {l}
              </label>
            ))}
          </div>
        )}

        {mode === "users" && (
          <div className="mb-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по имени или нику" className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
            {hits.length > 0 && (
              <div className="border border-muted rounded-lg mt-1 overflow-hidden">
                {hits.filter((h) => !picked.some((p) => p.id === h.id)).map((h) => (
                  <button key={h.id} onClick={() => { setPicked((p) => [...p, h]); setQ(""); setHits([]); }} className="w-full text-left px-3 py-2 text-sm text-offwhite border-b border-muted/40 last:border-0">
                    {h.name} {h.nick ? <span className="text-muted">@{h.nick}</span> : null} {!h.tg && <span className="text-muted text-[10px]">· без Telegram</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {picked.map((p) => (
                <span key={p.id} className="bg-gold/20 text-gold text-xs rounded-full px-3 py-1">
                  {p.name}
                  <button onClick={() => setPicked((x) => x.filter((y) => y.id !== p.id))} className="ml-2">✕</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-offwhite text-sm mt-2">
          <input type="checkbox" checked={popup} onChange={(e) => setPopup(e.target.checked)} /> Всплывающее окно в приложении
        </label>
        <label className="flex items-center gap-2 text-offwhite text-sm mt-1">
          <input type="checkbox" checked={tg} onChange={(e) => setTg(e.target.checked)} /> Сообщение от бота в Telegram
        </label>
        <p className="text-muted text-xs mt-1">В «Уведомлениях» человека сообщение останется в любом случае.</p>

        <p className="text-gold text-sm mt-3">Получателей: {total ?? "…"}</p>
        {!confirmed ? (
          <button onClick={() => setConfirmed(true)} disabled={!text.trim() || busy || !total} className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40 mt-2">
            Отправить
          </button>
        ) : (
          <div className="mt-2 border border-danger rounded-lg p-3">
            <p className="text-offwhite text-sm mb-2">Точно отправить {total} получателям? Отменить будет нельзя.</p>
            <div className="flex gap-2">
              <button onClick={send} disabled={busy} className="bg-danger text-white font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-40">Да, отправить</button>
              <button onClick={() => setConfirmed(false)} className="border border-muted text-offwhite px-4 py-2 rounded-full text-sm">Нет</button>
            </div>
          </div>
        )}
        {msg && <p className="text-offwhite text-xs mt-3">{msg}</p>}
      </div>
    </div>
  );
}
