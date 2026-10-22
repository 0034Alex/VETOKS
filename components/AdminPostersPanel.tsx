"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const CATS: [string, string][] = [
  ["teen", "MISS TEEN 15–17"],
  ["main", "MISS 18–29"],
  ["adult", "LADY 30+"],
];

// CRM → «Афіші»: куда отправлять готовые афиши и список всех афиш участниц.
export default function AdminPostersPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [chats, setChats] = useState<Record<string, string>>({ teen: "", main: "", adult: "" });
  const [cat, setCat] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(c = cat) {
    const r = await apiPost("/api/admin/posters", { action: "list", cat: c });
    if (r?.ok) {
      setItems(r.items ?? []);
      setChats((prev) => ({ ...prev, ...(r.chats ?? {}) }));
    }
  }
  useEffect(() => {
    load("");
  }, []);

  async function save() {
    setBusy(true);
    const r = await apiPost("/api/admin/posters", { action: "set_chats", chats });
    setMsg(r?.ok ? "Сохранено." : r?.error === "owner_only" ? "Менять чаты может только владелец." : "Не получилось сохранить.");
    setBusy(false);
  }
  async function test(c: string) {
    setMsg("Проверяю…");
    const r = await apiPost("/api/admin/posters", { action: "test", cat: c });
    setMsg(r?.ok ? "Готово: в чат ушло тестовое сообщение." : `Не получилось: ${r?.error || "проверь, что бот добавлен в чат админом"}`);
  }
  async function resend(id: string) {
    setMsg("Отправляю…");
    const r = await apiPost("/api/admin/posters", { action: "resend", id });
    setMsg(r?.ok ? "Отправлено в Telegram." : `Не получилось: ${r?.error || "ошибка"}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#1F1938] border border-muted/40 rounded-xl p-4">
        <p className="text-offwhite font-semibold mb-1">Куда отправлять афиши</p>
        <p className="text-muted text-xs mb-3">
          Создай в Telegram чат или канал, добавь нашего бота администратором и впиши сюда @имя канала или номер чата. Каждая новая афиша будет приходить туда файлом.
        </p>
        {CATS.map(([k, label]) => (
          <div key={k} className="flex items-center gap-2 mb-2">
            <span className="text-gold text-xs w-28 flex-shrink-0">{label}</span>
            <input
              value={chats[k] ?? ""}
              onChange={(e) => setChats({ ...chats, [k]: e.target.value })}
              placeholder="@my_channel или -100123…"
              className="flex-1 min-w-0 bg-[#15112A] border border-muted/50 rounded-lg px-3 py-2 text-offwhite text-sm"
            />
            <button onClick={() => test(k)} className="text-xs border border-gold/50 text-gold rounded-lg px-2 py-2">
              Проверить
            </button>
          </div>
        ))}
        <button onClick={save} disabled={busy} className="mt-2 bg-gold text-[#1B1530] font-semibold rounded-lg px-4 py-2 text-sm">
          Сохранить
        </button>
        {msg && <p className="text-offwhite text-xs mt-2">{msg}</p>}
      </div>

      <div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {[["", "Все"], ...CATS].map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setCat(k);
                load(k);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs border ${cat === k ? "bg-gold text-[#1B1530] border-gold font-semibold" : "bg-[#1F1938] border-muted/60 text-offwhite"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {items.length === 0 && <p className="text-muted text-sm">Афиш пока нет.</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.id} className="bg-[#1F1938] border border-muted/40 rounded-xl p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.image_url} alt="" className="w-full rounded-lg mb-2" />
              <p className="text-offwhite text-sm font-semibold truncate">{it.name || "—"}</p>
              <p className="text-muted text-[11px]">
                {CATS.find((c) => c[0] === it.age_category)?.[1]} · {it.city || "—"}
              </p>
              <p className="text-muted text-[11px] mb-1">{new Date(it.created_at).toLocaleString("ru-RU")}</p>
              {it.bad_cutout && <p className="text-danger text-[11px]">⚠ Фон не вырезан</p>}
              <p className={`text-[11px] ${it.sent_tg ? "text-success" : "text-muted"}`}>{it.sent_tg ? "✓ В Telegram" : "Не отправлено"}</p>
              <div className="flex gap-2 mt-2">
                <a href={it.image_url} target="_blank" rel="noopener noreferrer" download className="flex-1 text-center text-xs bg-gold text-[#1B1530] font-semibold rounded-lg py-1.5">
                  Скачать
                </a>
                <button onClick={() => resend(it.id)} className="flex-1 text-xs border border-gold/50 text-gold rounded-lg py-1.5">
                  В Telegram
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
