"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";
import { CONTESTS, STAGE_OPTIONS, CROWN_OPTIONS } from "@/lib/status";

// CRM → «Галочки и статусы»: золотая галочка вручную и статус участницы.
type Item = {
  userId: string;
  name: string;
  nick: string | null;
  contact: string;
  region: string | null;
  badge: boolean;
  badgeNote: string;
  participant: { id: string; contest: string; stage: string; crown: string; eliminated: boolean } | null;
};

export default function AdminBadgesPanel() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [given, setGiven] = useState<{ userId: string; name: string; nick: string | null; note: string; at: string | null }[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [bulkStage, setBulkStage] = useState("r4");
  const [bulkAsk, setBulkAsk] = useState(false);

  async function loadGiven() {
    const r = await apiPost("/api/admin/badges", { action: "list_badges" });
    if (r?.ok) setGiven(r.items);
  }
  useEffect(() => {
    loadGiven();
  }, []);

  async function find() {
    setMsg("");
    const r = await apiPost("/api/admin/badges", { action: "find", query: q, countryId: getCrmCountry() });
    if (r?.ok) {
      setItems(r.items);
      if (r.items.length === 0) setMsg("Никого не нашли.");
    }
  }

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 3500);
  }

  async function setBadge(userId: string, on: boolean) {
    const r = await apiPost("/api/admin/badges", { action: "set_badge", userId, on, note: notes[userId] ?? "" });
    if (r?.ok) {
      flash(on ? "Галочка выдана." : "Галочка снята.");
      setItems((arr) => arr.map((i) => (i.userId === userId ? { ...i, badge: on, badgeNote: on ? notes[userId] ?? "" : "" } : i)));
      loadGiven();
    } else flash(r?.error === "owner_only" ? "Это может только владелец." : "Не получилось.");
  }

  async function saveStatus(it: Item, patch: Partial<NonNullable<Item["participant"]>>) {
    if (!it.participant) return;
    const next = { ...it.participant, ...patch };
    setItems((arr) => arr.map((i) => (i.userId === it.userId ? { ...i, participant: next } : i)));
    const r = await apiPost("/api/admin/badges", {
      action: "set_status",
      participantId: next.id,
      contest: next.contest,
      stage: next.stage,
      crown: next.crown,
    });
    flash(r?.ok ? "Статус сохранён." : r?.error === "owner_only" ? "Звание победительницы выдаёт только владелец." : "Не получилось.");
  }

  async function bulk() {
    const r = await apiPost("/api/admin/badges", { action: "bulk_stage", stage: bulkStage, countryId: getCrmCountry() });
    setBulkAsk(false);
    flash(r?.ok ? `Готово: этап обновлён у ${r.count} участниц.` : "Не получилось (нужен владелец).");
  }

  const sel = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite";

  return (
    <div className="max-w-3xl flex flex-col gap-5">
      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Найти человека</p>
        <p className="text-muted text-xs mb-3">По имени, @нику, почте или номеру телефона.</p>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && find()}
            placeholder="Например: anna_vetoks"
            className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite"
          />
          <button onClick={find} className="bg-gold text-bgPrimary font-semibold rounded-lg px-5 text-sm">
            Найти
          </button>
        </div>
        {msg && <p className="text-gold text-xs mt-2">{msg}</p>}
      </div>

      {items.map((it) => (
        <div key={it.userId} className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-3">
          <div>
            <p className="text-offwhite font-semibold">
              {it.name} {it.badge && <span className="text-gold">✔ галочка</span>}
            </p>
            <p className="text-muted text-xs">
              {it.nick ? `@${it.nick} · ` : ""}
              {it.region ? `${it.region} · ` : ""}
              {it.contact}
              {it.participant ? " · участница" : ""}
            </p>
          </div>

          <div className="border-t border-muted/40 pt-3">
            <p className="text-offwhite text-sm mb-2">Золотая галочка</p>
            {it.badge ? (
              <div className="flex items-center gap-3">
                <span className="text-muted text-xs flex-1">{it.badgeNote ? `За что: ${it.badgeNote}` : "Выдана"}</span>
                <button onClick={() => setBadge(it.userId, false)} className="border border-danger text-danger rounded-lg px-4 py-2 text-xs">
                  Снять
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={notes[it.userId] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [it.userId]: e.target.value }))}
                  placeholder="За что (например: амбассадор)"
                  maxLength={200}
                  className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm text-offwhite"
                />
                <button onClick={() => setBadge(it.userId, true)} className="bg-gold text-bgPrimary font-semibold rounded-lg px-4 text-sm">
                  Выдать
                </button>
              </div>
            )}
          </div>

          {it.participant && (
            <div className="border-t border-muted/40 pt-3">
              <p className="text-offwhite text-sm mb-2">
                Статус участницы {it.participant.eliminated && <span className="text-muted text-xs">(выбыла)</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                <select value={it.participant.contest} onChange={(e) => saveStatus(it, { contest: e.target.value })} className={sel}>
                  {Object.entries(CONTESTS).map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
                <select value={it.participant.stage} onChange={(e) => saveStatus(it, { stage: e.target.value })} className={sel}>
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select value={it.participant.crown} onChange={(e) => saveStatus(it, { crown: e.target.value })} className={sel}>
                  {CROWN_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Выданные галочки ({given.length})</p>
        {given.length === 0 ? (
          <p className="text-muted text-xs">Пока никому не выдана.</p>
        ) : (
          <div className="flex flex-col">
            {given.map((g) => (
              <div key={g.userId} className="flex items-center gap-3 py-2 border-t border-muted/40 text-sm">
                <span className="text-gold">✔</span>
                <span className="flex-1 min-w-0">
                  <span className="text-offwhite">{g.name}</span>
                  <span className="text-muted text-xs">
                    {g.nick ? ` · @${g.nick}` : ""}
                    {g.note ? ` · ${g.note}` : ""}
                  </span>
                </span>
                <button onClick={() => setBadge(g.userId, false)} className="text-danger text-xs">
                  Снять
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Перевести всех участниц на этап</p>
        <p className="text-muted text-xs mb-3">
          Меняет этап у всех, кто не выбыл. Победительниц региона и сезона это не затрагивает. Выбывших участниц оставляйте как есть.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} className={sel}>
            {STAGE_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          {bulkAsk ? (
            <>
              <button onClick={bulk} className="bg-gold text-bgPrimary font-semibold rounded-lg px-4 py-2 text-sm">
                Да, применить ко всем
              </button>
              <button onClick={() => setBulkAsk(false)} className="text-muted text-sm px-2">
                Отмена
              </button>
            </>
          ) : (
            <button onClick={() => setBulkAsk(true)} className="border border-gold text-gold rounded-lg px-4 py-2 text-sm">
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
