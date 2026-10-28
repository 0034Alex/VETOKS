"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

type Row = { countryId: string; country: string; botUsername: string; hasToken: boolean; channelLink: string; channelChat: string };

// CRM → «Telegram: боты и каналы»: у каждой страны свой бот и свой официальный канал.
export default function AdminCountryBotsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState("");
  const [f, setF] = useState({ botUsername: "", botToken: "", channelLink: "", channelChat: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await apiPost("/api/admin/country-bots", { action: "list" });
    if (r?.ok) setRows(r.items);
    else setMsg(r?.message || "Не удалось загрузить.");
  }
  useEffect(() => {
    load();
  }, []);

  function choose(r: Row) {
    setOpen(open === r.countryId ? "" : r.countryId);
    setF({ botUsername: r.botUsername, botToken: "", channelLink: r.channelLink, channelChat: r.channelChat });
    setMsg("");
  }
  async function run(action: string, extra: object = {}, ok?: string) {
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/admin/country-bots", { action, countryId: open, ...extra });
    setBusy(false);
    setMsg(r?.ok ? ok || "Готово." : r?.message || "Не получилось.");
    await load();
    return r;
  }
  async function saveAndConnect() {
    const r = await run("save", f);
    if (!r?.ok) return;
    setF((x) => ({ ...x, botToken: "" }));
    if (rows.find((x) => x.countryId === open)?.hasToken || f.botToken) {
      const c = await run("connect", {}, "Сохранено и подключено. Бот страны работает.");
      if (c?.ok) setMsg(`Сохранено и подключено: @${c.username}. Бот страны работает.`);
    }
  }

  const inp = "w-full bg-bgSurface border border-gold/30 rounded-lg px-3 py-2 text-base text-offwhite";
  return (
    <div className="max-w-lg flex flex-col gap-3">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Telegram: боты и каналы стран</p>
        <p className="text-xs text-offwhite/70">
          Для каждой страны — свой бот и свой официальный канал. Сообщения людям страны уходят только от её бота, в канал — только её канал. Пока бот страны не задан, работает общий бот.
        </p>
        <p className="text-xs text-offwhite/60 mt-2">
          Как подключить: 1) в @BotFather создайте бота; 2) вставьте здесь имя и токен; 3) нажмите «Сохранить и подключить». Человек получает сообщения от бота, только если начал с ним диалог (вход или подтверждение через этого бота).
        </p>
      </div>
      {msg && <p className="text-xs text-gold">{msg}</p>}
      {rows.map((r) => (
        <div key={r.countryId} className="bg-bgSurface border border-gold/20 rounded-xl">
          <button onClick={() => choose(r)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-offwhite text-sm font-semibold">{r.country}</span>
            <span className="text-xs text-offwhite/70">
              {r.hasToken ? `бот ${r.botUsername ? "@" + r.botUsername : "задан"} ✓` : "общий бот"} · {r.channelLink ? "канал ✓" : "канала нет"}
            </span>
          </button>
          {open === r.countryId && (
            <div className="px-4 pb-4 flex flex-col gap-2">
              <label className="text-xs text-offwhite/70">Имя бота (например MyCountry_bot)</label>
              <input className={inp} value={f.botUsername} onChange={(e) => setF({ ...f, botUsername: e.target.value })} />
              <label className="text-xs text-offwhite/70">Токен бота {r.hasToken ? "(уже задан — оставьте пустым, чтобы не менять)" : ""}</label>
              <input className={inp} type="password" autoComplete="off" value={f.botToken} onChange={(e) => setF({ ...f, botToken: e.target.value })} placeholder={r.hasToken ? "••••••••" : "123456:ABC..."} />
              <label className="text-xs text-offwhite/70">Ссылка на официальный канал (https://t.me/...)</label>
              <input className={inp} value={f.channelLink} onChange={(e) => setF({ ...f, channelLink: e.target.value })} />
              <label className="text-xs text-offwhite/70">Канал для публикаций от бота: @имя_канала или номер (бот должен быть админом канала)</label>
              <input className={inp} value={f.channelChat} onChange={(e) => setF({ ...f, channelChat: e.target.value })} />
              <div className="flex flex-wrap gap-2 mt-1">
                <button disabled={busy} onClick={saveAndConnect} className="bg-gold text-bg font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50">
                  Сохранить и подключить
                </button>
                <button disabled={busy} onClick={() => run("test_channel", {}, "Тест отправлен в канал.")} className="border border-gold/40 text-gold rounded-lg px-3 py-2 text-sm disabled:opacity-50">
                  Проверить канал
                </button>
                {r.hasToken && (
                  <button disabled={busy} onClick={() => run("clear_token", {}, "Токен удалён, страна снова на общем боте.")} className="border border-red-400/50 text-red-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50">
                    Убрать бота
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
