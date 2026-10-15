"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

export const ACTION_LABELS: Record<string, string> = {
  ban: "Блокировка",
  dm_report_close: "Жалоба на переписку закрыта",
  unban: "Разблокировка",
  hide_from_contest: "Скрыта из конкурса",
  show_in_contest: "Возвращена в конкурс",
  support_new: "Поддержка: статус «новое»",
  support_in_progress: "Поддержка: статус «в работе»",
  support_done: "Поддержка: статус «решено»",
  support_reply: "Ответ в поддержке",
  partner_create: "Партнёр создан",
  partner_stage: "Стадия партнёра",
  partner_payment: "Платёж партнёра",
  partner_link: "Партнёр привязан к аккаунту",
  doc_edit: "Документ изменён",
  doc_restore: "Версия документа восстановлена",
  clan_hide: "Сообщение клана скрыто",
  clan_show: "Сообщение клана возвращено",
  clan_mute: "Запрет писать в клан",
  clan_unmute: "Запрет писать в клан снят",
};

const PERIODS: [number, string][] = [
  [1, "Сегодня"],
  [7, "7 дней"],
  [30, "30 дней"],
  [90, "90 дней"],
];

function extra(meta: any): string {
  const parts: string[] = [];
  if (meta?.stage) parts.push(`стадия: ${meta.stage}`);
  if (meta?.amount != null) parts.push(`сумма: ${meta.amount}`);
  if (meta?.hours != null) parts.push(`часов: ${meta.hours}`);
  if (meta?.from === "clan") parts.push("из клана");
  return parts.join(" · ");
}

// CRM → Пользователи → Журнал действий (только главный админ).
export default function AdminActionLogPanel() {
  const [days, setDays] = useState(7);
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [actors, setActors] = useState<{ id: string; name: string }[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const r = await apiPost("/api/admin/log", { days, actor: actor || undefined, action: action || undefined });
    if (r?.ok) {
      setRows(r.rows);
      setActors(r.actors);
      setActions(r.actions);
    } else {
      setErr("Не удалось загрузить журнал. Он доступен только главному администратору.");
    }
    setLoading(false);
  }, [days, actor, action]);

  useEffect(() => {
    load();
  }, [load]);

  const sel = "bg-bgSurface text-offwhite border border-muted rounded-lg px-3 py-2 text-sm";

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap gap-2 mb-4">
        <select className={sel} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {PERIODS.map(([d, l]) => (
            <option key={d} value={d}>
              {l}
            </option>
          ))}
        </select>
        <select className={sel} value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">Все сотрудники</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select className={sel} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Все типы действий</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABELS[a] ?? a}
            </option>
          ))}
        </select>
      </div>

      {err && <p className="text-danger text-sm mb-3">{err}</p>}
      {loading ? (
        <p className="text-muted">Загрузка...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted">За выбранный период действий нет.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-bgSurface border border-muted rounded-xl px-4 py-3 text-sm">
              <div className="flex justify-between gap-3 flex-wrap">
                <span className="text-offwhite font-semibold">{ACTION_LABELS[r.action] ?? r.action}</span>
                <span className="text-muted text-xs">{new Date(r.created_at).toLocaleString("ru-RU")}</span>
              </div>
              <p className="text-muted text-xs mt-1">
                Сотрудник: <span className="text-offwhite">{r.actor}</span>
                {r.target && (
                  <>
                    {" · "}Над кем: <span className="text-offwhite">{r.target}</span>
                  </>
                )}
                {extra(r.meta) && <> · {extra(r.meta)}</>}
              </p>
            </div>
          ))}
          <p className="text-muted text-xs mt-1">Показаны последние 300 записей.</p>
        </div>
      )}
    </div>
  );
}
