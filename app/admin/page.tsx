"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, isStaff, CurrentUser } from "@/lib/currentUser";

type Tab =
  | "dashboard"
  | "applications"
  | "participants"
  | "users"
  | "staff"
  | "partners"
  | "support"
  | "cards"
  | "goal"
  | "stages";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Дашборд" },
  { key: "applications", label: "Анкеты" },
  { key: "participants", label: "Участницы" },
  { key: "users", label: "Пользователи" },
  { key: "staff", label: "Персонал" },
  { key: "partners", label: "Партнёры" },
  { key: "support", label: "Поддержка" },
  { key: "cards", label: "Карточки" },
  { key: "goal", label: "Цель недели" },
  { key: "stages", label: "Этапы сезона" },
];

// Каждая галочка в «Персонал» открывает свой набор разделов.
// Владелец (super_admin) видит всё независимо от галочек.
const PERMISSION_TABS: Record<string, Tab[]> = {
  moderation: ["applications", "participants", "cards"],
  finance: ["dashboard", "goal"],
  partners: ["partners"],
  staff: ["staff", "users"],
};

function getAllowedTabs(user: CurrentUser): Tab[] {
  if (user.role === "super_admin") return TABS.map((t) => t.key);
  const perms = user.permissions ?? {};
  const allowed = new Set<Tab>();
  Object.entries(perms).forEach(([key, value]) => {
    if (value && PERMISSION_TABS[key]) {
      PERMISSION_TABS[key].forEach((t) => allowed.add(t));
    }
  });
  return [...allowed];
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [allowedTabs, setAllowedTabs] = useState<Tab[]>([]);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/admin");
        return;
      }
      setMe(u);
      const staffOk = isStaff(u);
      setAllowed(staffOk);
      if (staffOk) {
        const tabs = getAllowedTabs(u);
        setAllowedTabs(tabs);
        if (tabs.length > 0) setTab(tabs[0]);
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Проверка доступа...
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl font-semibold text-gold mb-3">
          Доступ только для персонала
        </h1>
        <p className="text-muted text-sm">
          Аккаунт {me?.email} не имеет прав на вход в CRM. Если это ошибка —
          обратитесь к владельцу проекта.
        </p>
      </main>
    );
  }

  if (allowedTabs.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl font-semibold text-gold mb-3">
          Пока нет доступных разделов
        </h1>
        <p className="text-muted text-sm">
          Владелец ещё не назначил вам ни одной зоны ответственности в
          разделе «Персонал».
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bgPrimary text-offwhite">
      <div
        className="flex items-center gap-3 px-4 py-4 border-b border-muted"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <button
          onClick={() => setMenuOpen(true)}
          className="text-2xl text-gold leading-none"
          aria-label="Открыть меню"
        >
          ☰
        </button>
        <h1 className="text-xl font-semibold text-gold">VETOKS CRM</h1>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="bg-bgSurface w-72 h-full p-4 flex flex-col gap-1"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-gold font-semibold">Разделы</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-muted text-xl leading-none"
              >
                ✕
              </button>
            </div>
            {TABS.filter((t) => allowedTabs.includes(t.key)).map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setMenuOpen(false);
                }}
                className={`text-left px-4 py-3 rounded-lg text-sm ${
                  tab === t.key
                    ? "bg-gold text-bgPrimary font-semibold"
                    : "text-offwhite hover:bg-bgPrimary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 py-6 pb-20">
        {tab === "dashboard" && <Dashboard />}
        {tab === "applications" && <Applications />}
        {tab === "participants" && <ParticipantsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "staff" && <StaffTab />}
        {tab === "partners" && <PartnersTab />}
        {tab === "support" && <SupportTab />}
        {tab === "cards" && <CardsTab />}
        {tab === "goal" && <GoalTab />}
        {tab === "stages" && <StagesTab />}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// ДАШБОРД
// ---------------------------------------------------------------------

function Dashboard() {
  const [stats, setStats] = useState({
    users: 0,
    participants: 0,
    gifts: 0,
    tasksCompleted: 0,
    earnedByParticipants: 0,
    totalPurchases: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { count: usersCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true });

      const { count: participantsCount } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true });

      const { data: giftsData } = await supabase
        .from("gifts")
        .select("quantity");
      const giftsTotal = (giftsData ?? []).reduce(
        (sum: number, g: { quantity: number }) => sum + (g.quantity ?? 1),
        0
      );

      const { count: tasksCount } = await supabase
        .from("wallet_transactions")
        .select("id", { count: "exact", head: true })
        .eq("type", "task_reward");

      const { data: walletsData } = await supabase
        .from("wallets")
        .select("balance");
      const totalBalance = (walletsData ?? []).reduce(
        (sum: number, w: { balance: number }) => sum + Number(w.balance),
        0
      );

      const { data: purchasesData } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .in("type", ["topup", "gift_sent", "vote_purchase"]);
      const totalPurchases = (purchasesData ?? []).reduce(
        (sum: number, t: { amount: number }) => sum + Math.abs(Number(t.amount)),
        0
      );

      setStats({
        users: usersCount ?? 0,
        participants: participantsCount ?? 0,
        gifts: giftsTotal,
        tasksCompleted: tasksCount ?? 0,
        earnedByParticipants: totalBalance,
        totalPurchases,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Пользователей", value: stats.users },
    { label: "Участниц", value: stats.participants },
    { label: "Подарков подарено", value: stats.gifts },
    { label: "Заданий выполнено", value: stats.tasksCompleted },
    { label: "Заработано участницами", value: `${Math.round(stats.earnedByParticipants)} ₽` },
    { label: "Оборот покупок", value: `${Math.round(stats.totalPurchases)} ₽` },
  ];

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <p className="text-gold text-2xl font-semibold">{c.value}</p>
          <p className="text-muted text-sm mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// АНКЕТЫ
// ---------------------------------------------------------------------

type Application = {
  id: string;
  status: string;
  form_data: {
    display_name?: string;
    age?: string;
    city?: string;
    bio?: string;
    photo_url?: string;
  };
  season_id: string;
  user_id: string;
  created_at: string;
};

function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("id, status, form_data, season_id, user_id, created_at")
      .eq("status", "submitted")
      .order("created_at", { ascending: false });
    setApplications((data as Application[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(app: Application) {
    setBusyId(app.id);
    await supabase
      .from("applications")
      .update({ status: "approved", reviewed_at: new Date().toISOString() })
      .eq("id", app.id);
    await supabase.from("participants").insert({
      user_id: app.user_id,
      season_id: app.season_id,
      application_id: app.id,
      display_name: app.form_data.display_name ?? "Без имени",
      bio: app.form_data.bio ?? null,
      photo_url: app.form_data.photo_url ?? null,
    });
    await load();
    setBusyId(null);
  }

  async function reject(app: Application) {
    setBusyId(app.id);
    await supabase
      .from("applications")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        rejection_reason: "Отклонено модератором",
      })
      .eq("id", app.id);
    await load();
    setBusyId(null);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;
  if (applications.length === 0)
    return <p className="text-muted">Новых анкет нет.</p>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg text-gold font-semibold">
              {app.form_data.display_name ?? "Без имени"}
            </h2>
            <span className="text-muted text-xs">
              {new Date(app.created_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <p className="text-sm mb-1">
            Возраст: {app.form_data.age ?? "—"} · Город:{" "}
            {app.form_data.city ?? "—"}
          </p>
          {app.form_data.bio && (
            <p className="text-muted text-sm mb-3">{app.form_data.bio}</p>
          )}
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => approve(app)}
              disabled={busyId === app.id}
              className="bg-success text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-50"
            >
              Одобрить
            </button>
            <button
              onClick={() => reject(app)}
              disabled={busyId === app.id}
              className="bg-danger text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-50"
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// УЧАСТНИЦЫ
// ---------------------------------------------------------------------

type ParticipantRow = {
  id: string;
  display_name: string;
  user_id: string;
  is_editors_choice: boolean;
  users: {
    is_banned: boolean;
    last_login_at: string | null;
  } | null;
};

function ParticipantsTab() {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [giftCounts, setGiftCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("participants")
      .select(
        "id, display_name, user_id, is_editors_choice, users(is_banned, last_login_at)"
      );
    const list = (data as unknown as ParticipantRow[]) ?? [];
    setRows(list);

    const { data: walletsData } = await supabase
      .from("wallets")
      .select("user_id, balance");
    const balMap: Record<string, number> = {};
    (walletsData ?? []).forEach((w: { user_id: string; balance: number }) => {
      balMap[w.user_id] = Number(w.balance);
    });
    setBalances(balMap);

    const { data: giftsData } = await supabase
      .from("gifts")
      .select("participant_id, quantity");
    const giftMap: Record<string, number> = {};
    (giftsData ?? []).forEach(
      (g: { participant_id: string; quantity: number }) => {
        giftMap[g.participant_id] =
          (giftMap[g.participant_id] ?? 0) + (g.quantity ?? 1);
      }
    );
    setGiftCounts(giftMap);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBan(userId: string, current: boolean) {
    await supabase.from("users").update({ is_banned: !current }).eq("id", userId);
    await load();
  }

  async function setEditorsChoice(participantId: string) {
    // Снимаем флаг со всех, ставим только на выбранную — титул один.
    await supabase.from("participants").update({ is_editors_choice: false }).neq("id", participantId);
    await supabase.from("participants").update({ is_editors_choice: true }).eq("id", participantId);
    await load();
  }

  async function remove(participantId: string) {
    if (!confirm("Удалить эту участницу из конкурса?")) return;
    await supabase.from("participants").delete().eq("id", participantId);
    await load();
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;
  if (rows.length === 0) return <p className="text-muted">Участниц пока нет.</p>;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((r) => (
        <div
          key={r.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <h2 className="text-lg text-gold font-semibold mb-2">
            {r.display_name}
          </h2>
          <p className="text-sm mb-1">
            Последний вход:{" "}
            {r.users?.last_login_at
              ? new Date(r.users.last_login_at).toLocaleString("ru-RU")
              : "—"}
          </p>
          <p className="text-sm mb-1">
            Баланс: {Math.round(balances[r.user_id] ?? 0)} ₽
          </p>
          <p className="text-sm mb-3">
            Подарков получено: {giftCounts[r.id] ?? 0}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => toggleBan(r.user_id, r.users?.is_banned ?? false)}
              className="bg-bgPrimary border border-muted px-3 py-1.5 rounded-full text-xs"
            >
              {r.users?.is_banned ? "Разблокировать" : "Заблокировать"}
            </button>
            <button
              onClick={() => remove(r.id)}
              className="bg-danger text-bgPrimary px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              Удалить
            </button>
            <button
              onClick={() => setEditorsChoice(r.id)}
              disabled={r.is_editors_choice}
              className="bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
            >
              {r.is_editors_choice ? "🌟 Выбор редакции" : "Назначить выбор редакции"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ПОЛЬЗОВАТЕЛИ
// ---------------------------------------------------------------------

type UserRow = {
  id: string;
  first_name: string | null;
  username: string | null;
  is_banned: boolean;
  last_login_at: string | null;
};

function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [giftsSent, setGiftsSent] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, first_name, username, is_banned, last_login_at")
      .order("created_at", { ascending: false });
    setRows((data as UserRow[]) ?? []);

    const { data: giftsData } = await supabase
      .from("gifts")
      .select("sender_id, quantity");
    const map: Record<string, number> = {};
    (giftsData ?? []).forEach((g: { sender_id: string; quantity: number }) => {
      map[g.sender_id] = (map[g.sender_id] ?? 0) + (g.quantity ?? 1);
    });
    setGiftsSent(map);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBan(id: string, current: boolean) {
    await supabase.from("users").update({ is_banned: !current }).eq("id", id);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Удалить этого пользователя? Это необратимо.")) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      setErrorId(id);
    } else {
      await load();
    }
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((u) => (
        <div
          key={u.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <h2 className="text-lg text-offwhite font-semibold mb-2">
            {u.first_name ?? "Без имени"}{" "}
            {u.username && (
              <span className="text-muted text-sm">@{u.username}</span>
            )}
          </h2>
          <p className="text-sm mb-1">
            Последний вход:{" "}
            {u.last_login_at
              ? new Date(u.last_login_at).toLocaleString("ru-RU")
              : "—"}
          </p>
          <p className="text-sm mb-3">
            Подарков отправлено: {giftsSent[u.id] ?? 0}
          </p>
          {errorId === u.id && (
            <p className="text-danger text-xs mb-2">
              Нельзя удалить — есть связанные записи (голоса, анкеты и т.п.).
              Сначала заблокируйте.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => toggleBan(u.id, u.is_banned)}
              className="bg-bgPrimary border border-muted px-3 py-1.5 rounded-full text-xs"
            >
              {u.is_banned ? "Разблокировать" : "Заблокировать"}
            </button>
            <button
              onClick={() => remove(u.id)}
              className="bg-danger text-bgPrimary px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              Удалить
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ПЕРСОНАЛ
// ---------------------------------------------------------------------

const ROLES = [
  { value: "viewer", label: "Обычный пользователь" },
  { value: "ambassador", label: "Амбассадор" },
  { value: "moderator", label: "Модератор" },
  { value: "finance_admin", label: "Финансист" },
  { value: "super_admin", label: "Владелец" },
];

const PERMISSION_KEYS = [
  { key: "moderation", label: "Модерация анкет" },
  { key: "finance", label: "Финансы и выплаты" },
  { key: "partners", label: "Партнёры" },
  { key: "staff", label: "Управление персоналом" },
];

type StaffRow = {
  id: string;
  first_name: string | null;
  role: string;
  permissions: Record<string, boolean> | null;
};

function StaffTab() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [allUsers, setAllUsers] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, first_name, role, permissions");
    const list = (data as StaffRow[]) ?? [];
    setAllUsers(list);
    setRows(list.filter((r) => !["viewer", "participant"].includes(r.role)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(id: string, role: string) {
    await supabase.from("users").update({ role }).eq("id", id);
    await load();
  }

  async function togglePermission(
    row: StaffRow,
    key: string,
    value: boolean
  ) {
    const updated = { ...(row.permissions ?? {}), [key]: value };
    await supabase
      .from("users")
      .update({ permissions: updated })
      .eq("id", row.id);
    await load();
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-bgSurface border border-muted rounded-xl p-4 flex flex-col md:flex-row gap-3 items-start md:items-center">
        <span className="text-sm text-muted">Назначить сотрудником:</span>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm flex-1"
        >
          <option value="">— выберите пользователя —</option>
          {allUsers
            .filter((u) => u.role === "viewer")
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name ?? u.id}
              </option>
            ))}
        </select>
        <button
          onClick={() => selectedId && changeRole(selectedId, "moderator")}
          disabled={!selectedId}
          className="bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm disabled:opacity-40"
        >
          Сделать модератором
        </button>
      </div>

      {rows.map((r) => (
        <div
          key={r.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="text-lg text-offwhite font-semibold">
              {r.first_name ?? "Без имени"}
            </h2>
            <select
              value={r.role}
              onChange={(e) => changeRole(r.id, e.target.value)}
              className="bg-bgPrimary border border-muted rounded-lg px-3 py-1.5 text-sm"
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-4">
            {PERMISSION_KEYS.map((p) => (
              <label
                key={p.key}
                className="flex items-center gap-2 text-sm text-muted"
              >
                <input
                  type="checkbox"
                  checked={!!r.permissions?.[p.key]}
                  onChange={(e) =>
                    togglePermission(r, p.key, e.target.checked)
                  }
                />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ПАРТНЁРЫ
// ---------------------------------------------------------------------

type Sponsor = {
  id: string;
  name: string;
  amount: number | null;
  status: string;
  package_type: string | null;
};

function PartnersTab() {
  const [rows, setRows] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [packageType, setPackageType] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("sponsors")
      .select("id, name, amount, status, package_type")
      .order("created_at", { ascending: false });
    setRows((data as Sponsor[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPartner(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    await supabase.from("sponsors").insert({
      name,
      amount: amount ? Number(amount) : null,
      package_type: packageType || null,
      status: "active",
    });
    setName("");
    setAmount("");
    setPackageType("");
    await load();
  }

  return (
    <div>
      <form
        onSubmit={createPartner}
        className="bg-bgSurface border border-muted rounded-xl p-5 mb-6 flex flex-col md:flex-row gap-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название партнёра"
          className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Внесено, ₽"
          type="number"
          className="w-full md:w-40 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <input
          value={packageType}
          onChange={(e) => setPackageType(e.target.value)}
          placeholder="Пакет (напр. региональный)"
          className="w-full md:w-52 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
        >
          Добавить
        </button>
      </form>

      {loading && <p className="text-muted">Загрузка...</p>}
      {!loading && rows.length === 0 && (
        <p className="text-muted">Партнёров пока нет.</p>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((s) => (
          <div
            key={s.id}
            className="bg-bgSurface border border-muted rounded-xl p-5"
          >
            <h2 className="text-lg text-gold font-semibold mb-1">{s.name}</h2>
            <p className="text-sm text-muted mb-1">
              Пакет: {s.package_type ?? "—"}
            </p>
            <p className="text-sm mb-1">Внесено: {s.amount ?? 0} ₽</p>
            <p className="text-sm text-muted">Статус: {s.status}</p>
          </div>
        ))}
      </div>

      <p className="text-muted text-xs mt-6">
        Метрики «сколько заданий участниц выполнено по заданию партнёра» пока
        не считаются — для этого нужно решить, как задание привязывается к
        конкретному партнёру.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// ПОДДЕРЖКА
// ---------------------------------------------------------------------

type SupportRequest = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string;
  status: string;
  created_at: string;
};

function SupportTab() {
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("support_requests")
      .select("id, name, phone, email, message, status, created_at")
      .order("created_at", { ascending: false });
    setRows((data as SupportRequest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markDone(id: string) {
    await supabase
      .from("support_requests")
      .update({ status: "done" })
      .eq("id", id);
    await load();
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;
  if (rows.length === 0) return <p className="text-muted">Заявок нет.</p>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {rows.map((r) => (
        <div
          key={r.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg text-gold font-semibold">{r.name}</h2>
            <span className="text-muted text-xs">
              {new Date(r.created_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <p className="text-sm mb-1">
            {r.phone ?? "—"} · {r.email ?? "—"}
          </p>
          <p className="text-offwhite text-sm mb-3">{r.message}</p>
          {r.status === "done" ? (
            <span className="text-success text-xs font-semibold">
              Обработано
            </span>
          ) : (
            <button
              onClick={() => markDone(r.id)}
              className="bg-success text-bgPrimary font-semibold px-4 py-2 rounded-full text-xs"
            >
              Отметить обработанным
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// КАРТОЧКИ
// ---------------------------------------------------------------------

const CARD_STAGE_LABELS: Record<string, string> = {
  casting: "Кастинг",
  week2: "Неделя 2",
  week3: "Неделя 3",
  grand_final: "Гранд-финал",
};

type CardRow = {
  id: string;
  stage: string;
  raw_photo_url: string | null;
  final_image_url: string | null;
  status: string;
  participant_id: string;
  participants: { display_name: string } | null;
};

function CardsTab() {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("collectible_cards")
      .select(
        "id, stage, raw_photo_url, final_image_url, status, participant_id, participants(display_name)"
      )
      .order("created_at", { ascending: false });
    setRows((data as unknown as CardRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function uploadFinal(row: CardRow, file: File) {
    setUploadingId(row.id);
    const fileExt = file.name.split(".").pop();
    const filePath = `final-${row.id}-${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("card-images")
      .upload(filePath, file);

    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadingId(null);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("card-images")
      .getPublicUrl(filePath);

    await supabase
      .from("collectible_cards")
      .update({ final_image_url: publicUrlData.publicUrl, status: "ready" })
      .eq("id", row.id);

    await load();
    setUploadingId(null);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;
  if (rows.length === 0) return <p className="text-muted">Карточек пока нет.</p>;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((r) => (
        <div
          key={r.id}
          className="bg-bgSurface border border-muted rounded-xl p-5"
        >
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg text-gold font-semibold">
              {r.participants?.display_name ?? "—"}
            </h2>
            <span className="text-muted text-xs">
              {CARD_STAGE_LABELS[r.stage] ?? r.stage}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-muted text-xs mb-1">Сырое фото</p>
              <div className="aspect-[3/4] bg-black/40 rounded-lg overflow-hidden">
                {r.raw_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.raw_photo_url}
                    alt="raw"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-muted text-xs mb-1">Обработанная карточка</p>
              <div className="aspect-[3/4] bg-black/40 rounded-lg overflow-hidden">
                {r.final_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.final_image_url}
                    alt="final"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          </div>

          <p className="text-sm mb-2">
            Статус:{" "}
            <span
              className={
                r.status === "sold"
                  ? "text-success"
                  : r.status === "ready"
                  ? "text-gold"
                  : "text-muted"
              }
            >
              {r.status === "pending"
                ? "На обработке"
                : r.status === "ready"
                ? "Опубликована"
                : "Продана"}
            </span>
          </p>

          {r.status !== "sold" && (
            <label className="block w-full text-center bg-gold text-bgPrimary font-semibold py-2 rounded-full text-xs cursor-pointer">
              {uploadingId === r.id
                ? "Загрузка..."
                : "Загрузить обработанную карточку"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingId === r.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFinal(r, file);
                }}
              />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ЦЕЛЬ НЕДЕЛИ
// ---------------------------------------------------------------------

function GoalTab() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("5000");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["weekly_goal_text", "weekly_goal_target", "weekly_goal_enabled"]);
    (data ?? []).forEach((s: { key: string; value: string }) => {
      if (s.key === "weekly_goal_text") setText(s.value);
      if (s.key === "weekly_goal_target") setTarget(s.value);
      if (s.key === "weekly_goal_enabled") setEnabled(s.value !== "false");
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleEnabled() {
    const newValue = !enabled;
    await supabase
      .from("platform_settings")
      .upsert({ key: "weekly_goal_enabled", value: newValue ? "true" : "false" });
    setEnabled(newValue);
  }

  async function save() {
    await supabase
      .from("platform_settings")
      .upsert({ key: "weekly_goal_text", value: text });
    await supabase
      .from("platform_settings")
      .upsert({ key: "weekly_goal_target", value: target });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-md">
      <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-offwhite text-sm font-semibold">
            Донаты на цель недели
          </p>
          <p className="text-muted text-xs">
            {enabled
              ? "Сейчас включены у всех участниц"
              : "Сейчас выключены у всех участниц"}
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            enabled
              ? "bg-success text-bgPrimary"
              : "bg-bgPrimary border border-muted text-muted"
          }`}
        >
          {enabled ? "Включено" : "Выключено"}
        </button>
      </div>

      <p className="text-muted text-sm mb-4">
        Этот текст и сумма показываются одинаковыми у всех участниц на
        странице цели недели.
      </p>
      <label className="text-offwhite text-sm">Текст цели</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mt-1 mb-4"
      />
      <label className="text-offwhite text-sm">Сумма цели, ₽</label>
      <input
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mt-1 mb-4"
      />
      <button
        onClick={save}
        className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm"
      >
        Сохранить
      </button>
      {saved && <span className="text-success text-sm ml-3">Сохранено!</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// ЭТАПЫ СЕЗОНА
// ---------------------------------------------------------------------

type SeasonRow = { id: string; title: string };
type StageRow = {
  id: string;
  stage_number: number;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  promo_video_url: string | null;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function StagesTab() {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  async function loadSeasons() {
    const { data } = await supabase.from("seasons").select("id, title");
    setSeasons((data as SeasonRow[]) ?? []);
    if (data && data.length > 0 && !selectedSeason) {
      setSelectedSeason((data[0] as SeasonRow).id);
    }
  }

  async function loadStages(seasonId: string) {
    if (!seasonId) return;
    setLoading(true);
    const { data } = await supabase
      .from("season_stages")
      .select("id, stage_number, title, starts_at, ends_at, promo_video_url")
      .eq("season_id", seasonId)
      .order("stage_number", { ascending: true });
    setStages((data as StageRow[]) ?? []);
    setLoading(false);
  }

  async function uploadVideo(stageId: string, file: File) {
    setUploadingId(stageId);
    const fileExt = file.name.split(".").pop();
    const filePath = `${stageId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("promo-videos")
      .upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadingId(null);
      return;
    }
    const { data: publicUrlData } = supabase.storage
      .from("promo-videos")
      .getPublicUrl(filePath);
    await supabase
      .from("season_stages")
      .update({ promo_video_url: publicUrlData.publicUrl })
      .eq("id", stageId);
    await loadStages(selectedSeason);
    setUploadingId(null);
  }

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) loadStages(selectedSeason);
  }, [selectedSeason]);

  function updateStage(index: number, field: keyof StageRow, value: string) {
    setStages((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  async function save() {
    for (const s of stages) {
      await supabase
        .from("season_stages")
        .update({
          title: s.title,
          starts_at: s.starts_at ? new Date(s.starts_at).toISOString() : null,
          ends_at: s.ends_at ? new Date(s.ends_at).toISOString() : null,
        })
        .eq("id", s.id);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Здесь вы сами задаёте реальные даты старта и окончания каждого этапа —
        на главной странице прогресс-бар и обратный отсчёт считаются по этим
        датам автоматически.
      </p>

      <select
        value={selectedSeason}
        onChange={(e) => setSelectedSeason(e.target.value)}
        className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mb-4"
      >
        {seasons.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title}
          </option>
        ))}
      </select>

      {loading && <p className="text-muted">Загрузка...</p>}

      {!loading &&
        stages.map((s, i) => (
          <div
            key={s.id}
            className="bg-bgSurface border border-muted rounded-xl p-4 mb-3"
          >
            <p className="text-gold text-sm font-semibold mb-2">
              Этап {s.stage_number}
            </p>
            <label className="text-offwhite text-xs">Название</label>
            <input
              value={s.title}
              onChange={(e) => updateStage(i, "title", e.target.value)}
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mt-1 mb-2"
            />
            <label className="text-offwhite text-xs">Начало</label>
            <input
              type="datetime-local"
              value={toDatetimeLocal(s.starts_at)}
              onChange={(e) => updateStage(i, "starts_at", e.target.value)}
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mt-1 mb-2"
            />
            <label className="text-offwhite text-xs">Окончание</label>
            <input
              type="datetime-local"
              value={toDatetimeLocal(s.ends_at)}
              onChange={(e) => updateStage(i, "ends_at", e.target.value)}
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mt-1 mb-2"
            />
            <label className="text-offwhite text-xs">Промо-ролик этапа</label>
            {s.promo_video_url && (
              <p className="text-success text-xs mt-1 mb-1">Видео загружено ✓</p>
            )}
            <label className="block w-full text-center bg-bgPrimary border border-gold text-gold text-xs font-semibold px-3 py-2 rounded-lg mt-1 cursor-pointer">
              {uploadingId === s.id
                ? "Загрузка..."
                : s.promo_video_url
                ? "Заменить видео"
                : "Загрузить видео"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploadingId === s.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadVideo(s.id, file);
                }}
              />
            </label>
          </div>
        ))}

      {!loading && stages.length > 0 && (
        <button
          onClick={save}
          className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm"
        >
          Сохранить все даты
        </button>
      )}
      {saved && <span className="text-success text-sm ml-3">Сохранено!</span>}
    </div>
  );
}
