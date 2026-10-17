"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { supabase } from "@/lib/supabaseClient";

const AREAS = [
  { key: "moderation", label: "Модерация и люди" },
  { key: "finance", label: "Финансы" },
  { key: "partners", label: "Реклама и партнёры" },
  { key: "support", label: "Поддержка и документы" },
  { key: "staff", label: "Персонал и пользователи" },
];

type Inv = { id: string; token: string; email: string; name: string | null; role: string; permissions: Record<string, string>; countries: string[] | null; created_at: string; expires_at: string; used_at: string | null; revoked: boolean };

// Приглашение сотрудника по почте: выбираем разделы, права и страны, получаем ссылку для входа.
export default function AdminStaffInvites() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("moderator");
  const [perms, setPerms] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [list, setList] = useState<Inv[]>([]);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  async function load() {
    const r = await apiPost("/api/admin/staff-invites", { action: "list" });
    if (r?.ok) setList(r.items);
  }
  useEffect(() => {
    load();
    supabase.from("countries").select("id, name").order("name").then(({ data }) => setCountries((data as any) ?? []));
  }, []);

  const url = (t: string) => `${window.location.origin}/admin/invite/${t}`;

  async function create() {
    setErr("");
    setLink("");
    const r = await apiPost("/api/admin/staff-invites", { action: "create", email, name, role, permissions: perms, countries: picked });
    if (!r?.ok) {
      setErr(r?.error === "bad_email" ? "Проверьте почту." : r?.error === "no_permissions" ? "Выберите хотя бы один раздел." : "Не получилось создать ссылку.");
      return;
    }
    setLink(url(r.token));
    setEmail("");
    setName("");
    setPerms({});
    setPicked([]);
    load();
  }

  async function copy(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(t);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Скопируйте ссылку", t);
    }
  }

  const pending = list.filter((i) => !i.used_at && !i.revoked && new Date(i.expires_at).getTime() > Date.now());

  return (
    <div className="bg-bgSurface border border-gold/50 rounded-xl p-5 flex flex-col gap-4">
      <h2 className="text-gold font-semibold">Пригласить сотрудника по почте</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта сотрудника" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm md:col-span-2" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя (необязательно)" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <p className="text-muted text-xs mb-2">Какие страны видит (если ничего не отмечено — все)</p>
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 bg-bgPrimary border border-muted rounded-full px-3 py-1 text-sm">
              <input type="checkbox" checked={picked.includes(c.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id)))} />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-muted text-xs mb-2">Права по разделам</p>
        <div className="grid gap-2 md:grid-cols-2">
          {AREAS.map((a) => (
            <div key={a.key} className="flex items-center justify-between gap-3 bg-bgPrimary border border-muted rounded-lg px-3 py-2">
              <span className="text-sm">{a.label}</span>
              <select
                value={perms[a.key] ?? ""}
                onChange={(e) => setPerms((p) => ({ ...p, [a.key]: e.target.value }))}
                className="bg-bgSurface border border-muted rounded-md px-2 py-1 text-sm"
              >
                <option value="">Нет доступа</option>
                <option value="r">Только смотреть</option>
                <option value="w">Смотреть и менять</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm">
          <option value="moderator">Должность: модератор</option>
          <option value="finance_admin">Должность: финансист</option>
        </select>
        <button onClick={create} className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm">
          Создать ссылку для входа
        </button>
      </div>
      {err && <p className="text-danger text-sm">{err}</p>}
      {link && (
        <div className="bg-bgPrimary border border-gold rounded-lg p-3">
          <p className="text-muted text-xs mb-1">Отправьте эту ссылку сотруднику (действует 3 дня, работает один раз):</p>
          <p className="text-offwhite text-sm break-all mb-2">{link}</p>
          <button onClick={() => copy(link)} className="bg-gold text-bgPrimary px-3 py-1 rounded-full text-xs font-semibold">
            {copied === link ? "Скопировано" : "Скопировать"}
          </button>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <p className="text-muted text-xs mb-2">Ждут первого входа</p>
          <div className="flex flex-col gap-2">
            {pending.map((i) => (
              <div key={i.id} className="flex items-center gap-3 flex-wrap bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm">
                <span className="flex-1 min-w-0 truncate">{i.email}</span>
                <button onClick={() => copy(url(i.token))} className="text-gold text-xs">{copied === url(i.token) ? "Скопировано" : "Копировать ссылку"}</button>
                <button onClick={async () => { await apiPost("/api/admin/staff-invites", { action: "revoke", id: i.id }); load(); }} className="text-danger text-xs">Отменить</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
