"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

// CRM → «Чат кланов»: жалобы и последние сообщения, скрыть / заглушить / заблокировать.
export default function AdminClanPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [onlyReported, setOnlyReported] = useState(true);
  const [regionId, setRegionId] = useState("");
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("regions").select("id, name").order("name").then(({ data }) => setRegions((data as any) ?? []));
  }, []);

  async function load() {
    setLoading(true);
    const r = await apiPost("/api/admin/clan", { action: "list", regionId: regionId || null, onlyReported });
    setRows(r?.rows ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyReported, regionId]);

  const act = async (body: object) => {
    await apiPost("/api/admin/clan", body);
    await load();
  };

  const nameOf = (m: any) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return u?.first_name ?? "Без имени";
  };

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap gap-2 mb-4">
        {[[true, "С жалобами"], [false, "Все последние"]].map(([v, label]) => (
          <button
            key={String(v)}
            onClick={() => setOnlyReported(v as boolean)}
            className={`px-3 py-1.5 rounded-full text-xs border ${onlyReported === v ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}
          >
            {label as string}
          </button>
        ))}
        <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="bg-bgPrimary border border-muted rounded-full px-3 py-1.5 text-xs text-offwhite">
          <option value="">Все регионы</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Загрузка...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">{onlyReported ? "Жалоб нет 🎉" : "Сообщений нет."}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((m) => {
            const u = Array.isArray(m.users) ? m.users[0] : m.users;
            const reg = Array.isArray(m.regions) ? m.regions[0] : m.regions;
            const muted = u?.clan_muted_until && new Date(u.clan_muted_until) > new Date();
            return (
              <div key={m.id} className={`bg-bgSurface border rounded-xl p-3 ${m.reports > 0 ? "border-gold" : "border-muted"} ${m.is_hidden ? "opacity-60" : ""}`}>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{nameOf(m)} · {reg?.name ?? "—"}{muted ? " · заглушен" : ""}{u?.is_banned ? " · заблокирован" : ""}</span>
                  <span>{new Date(m.created_at).toLocaleString("ru-RU")}</span>
                </div>
                <p className="text-offwhite text-sm mb-2 break-words">{m.body}</p>
                {m.reports > 0 && <p className="text-gold text-xs mb-2">Жалоб: {m.reports}</p>}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act({ action: "hide", messageId: m.id, hide: !m.is_hidden })} className="border border-muted text-offwhite px-3 py-1 rounded-full text-xs">
                    {m.is_hidden ? "Вернуть" : "Скрыть"}
                  </button>
                  <button onClick={() => act({ action: "mute", userId: m.user_id, hours: muted ? 0 : 24 })} className="border border-muted text-offwhite px-3 py-1 rounded-full text-xs">
                    {muted ? "Снять заглушку" : "Заглушить на 24 ч"}
                  </button>
                  {!u?.is_banned && (
                    <button onClick={() => confirm("Заблокировать человека в приложении?") && act({ action: "ban", userId: m.user_id })} className="border border-danger text-danger px-3 py-1 rounded-full text-xs">
                      Заблокировать
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
