"use client";

import AdminStorageCleanup from "@/components/AdminStorageCleanup";
import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

const KINDS: Record<string, string> = {
  login_locked: "Вход заблокирован после неверных паролей",
  reset_locked: "Сброс пароля заблокирован",
  bot_code_locked: "Бот: перебор кода",
  rate_limited: "Слишком частые запросы",
  admin_denied: "Попытка зайти в CRM без прав",
  webhook_bad_secret: "Поддельный запрос к боту",
  bad_upload_url: "Подозрительная ссылка на файл",
  client_error: "Ошибка в приложении у человека",
  bad_upload_file: "Загрузили файл, который не фото и не видео",
  server_error: "Ошибка на сервере",
};

function keyLabel(key: string): string {
  if (key.startsWith("login:ip:")) return `Вход: все попытки с адреса ${key.slice(9)}`;
  if (key.startsWith("login:id:")) return `Вход: логин ${key.slice(9)} (с любых адресов)`;
  if (key.startsWith("login:")) return `Вход: ${key.slice(6)}`;
  if (key.startsWith("reset:user:")) return "Сброс пароля: аккаунт " + key.slice(11, 19);
  if (key.startsWith("botcode:")) return "Код в боте: чат " + key.slice(8);
  return key;
}

function left(until: string): string {
  const s = Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000));
  if (s >= 3600) return `${Math.ceil(s / 3600)} ч`;
  return `${Math.max(1, Math.ceil(s / 60))} мин`;
}

// CRM → Настройки → Безопасность (только главный админ).
export default function AdminSecurityPanel() {
  const [locks, setLocks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [days, setDays] = useState(3);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [clusters, setClusters] = useState<any[] | null>(null);
  const [backup, setBackup] = useState("");
  const [backing, setBacking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    const r = await apiPost("/api/admin/security", { action: "list", days, kind: kind || undefined });
    if (r?.ok) {
      setLocks(r.locks);
      setEvents(r.events);
    } else {
      setErr("Не удалось загрузить. Раздел доступен только главному администратору.");
    }
    setLoading(false);
  }, [days, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadClusters() {
    const r = await apiPost("/api/admin/security", { action: "clusters", days: 7 });
    setClusters(r?.ok ? r.clusters : []);
  }

  async function banUser(id: string) {
    if (!confirm("Заблокировать этот аккаунт? Он будет выведен со всех устройств.")) return;
    await apiPost("/api/admin/staff", { action: "ban", userId: id, value: true });
    await loadClusters();
  }

  async function makeBackup() {
    setBacking(true);
    setBackup("Готовим...");
    try {
      const t = await apiPost("/api/admin/export", { action: "tables" });
      if (!t?.ok) {
        setBackup("Не получилось (лимит: не больше 6 копий в час, только владелец).");
        setBacking(false);
        return;
      }
      const out: Record<string, any[]> = {};
      for (const table of t.tables as string[]) {
        const all: any[] = [];
        for (let off = 0; off < 200000; off += t.page) {
          setBackup(`Скачиваем: ${table} (${all.length})`);
          const r = await apiPost("/api/admin/export", { table, offset: off });
          const rows = r?.rows ?? [];
          all.push(...rows);
          if (rows.length < t.page) break;
        }
        out[table] = all;
      }
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), tables: out })], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vetoks-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setBackup("Готово. Файл сохранён, храните его в надёжном месте: в нём личные данные.");
    } catch {
      setBackup("Не получилось скачать. Попробуйте ещё раз.");
    }
    setBacking(false);
  }

  async function unblock(key: string) {
    await apiPost("/api/admin/security", { action: "unblock", key });
    await load();
  }

  async function unblockSearch() {
    setMsg("");
    const r = await apiPost("/api/admin/security", { action: "unblock_search", q });
    setMsg(r?.ok ? `Снято блокировок: ${r.count}` : "Введите хотя бы 3 символа: почту, номер или адрес.");
    await load();
  }

  async function unblockAll() {
    if (!confirm("Снять ВСЕ блокировки входа?")) return;
    await apiPost("/api/admin/security", { action: "unblock_all" });
    await load();
  }

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      <p className="text-muted text-sm">
        Здесь видно, кого сайт заблокировал за неверные пароли и коды, и все подозрительные действия. Если настоящая
        участница не может войти, найдите её здесь и снимите блокировку.
      </p>

      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col gap-2">
        <p className="text-offwhite text-sm font-semibold">Снять блокировку</p>
        <p className="text-muted text-xs">Введите почту, номер или адрес (IP) — снимем всё, что с ним связано.</p>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="почта, номер или IP"
            className="flex-1 min-w-0 bg-bgPrimary text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={unblockSearch} className="bg-gold text-bgPrimary font-semibold rounded-lg px-4 text-sm">
            Снять
          </button>
        </div>
        {msg && <p className="text-gold text-xs">{msg}</p>}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-offwhite font-semibold">Сейчас заблокированы ({locks.length})</h3>
          {locks.length > 0 && (
            <button onClick={unblockAll} className="text-danger text-xs underline">
              Снять все
            </button>
          )}
        </div>
        {loading && <p className="text-muted text-sm">Загрузка...</p>}
        {err && <p className="text-danger text-sm">{err}</p>}
        {!loading && !err && locks.length === 0 && <p className="text-muted text-sm">Никто не заблокирован.</p>}
        {locks.map((l) => (
          <div key={l.key} className="bg-bgSurface border border-muted rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-offwhite text-sm break-all">{keyLabel(l.key)}</p>
              <p className="text-muted text-xs">
                осталось {left(l.blocked_until)} · уровень {Number(l.level)}
              </p>
            </div>
            <button onClick={() => unblock(l.key)} className="border border-gold text-gold rounded-lg px-3 py-1 text-xs">
              Снять
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-offwhite font-semibold">Много аккаунтов с одного адреса</h3>
        <p className="text-muted text-xs">
          Адреса, с которых за 7 дней входили, регистрировались или голосовали 4 и больше разных аккаунтов. Это может быть
          накрутка, а может быть общая семья или общий Wi-Fi: проверяйте глазами.
        </p>
        <button onClick={loadClusters} className="self-start border border-gold text-gold rounded-lg px-4 py-2 text-sm">
          {clusters === null ? "Показать" : "Обновить"}
        </button>
        {clusters && clusters.length === 0 && <p className="text-muted text-sm">Подозрительных групп нет.</p>}
        {(clusters ?? []).map((c) => (
          <div key={c.ip} className="bg-bgSurface border border-muted rounded-xl p-3 flex flex-col gap-2">
            <p className="text-offwhite text-sm">
              {c.ip} · {c.accounts.length} аккаунтов · {c.kinds.join(", ")}
            </p>
            {c.votesFor.length > 0 && (
              <p className="text-muted text-xs">Голосовали за: {c.votesFor.map((v: any) => `${v.name} (${v.n})`).join(", ")}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {c.accounts.map((a: any) => (
                <button
                  key={a.id}
                  onClick={() => !a.banned && banUser(a.id)}
                  className={`text-xs rounded-full px-3 py-1 border ${a.banned ? "border-muted text-muted" : "border-danger text-danger"}`}
                >
                  {a.name}
                  {a.banned ? " (заблокирован)" : " — заблокировать"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-offwhite font-semibold">Резервная копия данных</h3>
        <p className="text-muted text-xs">
          Скачивает файл со всеми основными данными (люди, анкеты, балансы, голоса, подарки). Делайте раз в несколько дней и
          храните в надёжном месте.
        </p>
        <button
          onClick={makeBackup}
          disabled={backing}
          className="self-start bg-gold text-bgPrimary font-semibold rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          Скачать копию
        </button>
        {backup && <p className="text-gold text-xs">{backup}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-offwhite font-semibold">Журнал подозрительных действий</h3>
        <div className="flex gap-2 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
          >
            <option value={1}>Сегодня</option>
            <option value={3}>3 дня</option>
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
          </select>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="bg-bgSurface text-offwhite border border-muted rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Все виды</option>
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {!loading && events.length === 0 && <p className="text-muted text-sm">Пока тихо.</p>}
        {events.map((e) => (
          <div key={e.id} className="bg-bgSurface border border-muted rounded-xl p-3">
            <p className="text-offwhite text-sm">{KINDS[e.kind] ?? e.kind}</p>
            <p className="text-muted text-xs break-all">
              {new Date(e.created_at).toLocaleString("ru-RU")}
              {e.ip ? ` · ${e.ip}` : ""}
              {e.detail && Object.keys(e.detail).length
                ? " · " +
                  Object.entries(e.detail)
                    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
                    .join(", ")
                : ""}
            </p>
          </div>
        ))}
      </section>
      <AdminStorageCleanup />
    </div>
  );
}
