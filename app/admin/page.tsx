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
  | "partner-logos"
  | "ad-space"
  | "support"
  | "cards"
  | "goal"
  | "stages"
  | "banners"
  | "documents"
  | "calendar"
  | "social"
  | "media"
  | "magazine-ads";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Дашборд" },
  { key: "applications", label: "Анкеты" },
  { key: "participants", label: "Участницы" },
  { key: "users", label: "Пользователи" },
  { key: "staff", label: "Персонал" },
  { key: "partners", label: "Партнёры" },
  { key: "partner-logos", label: "Витрина партнёров" },
  { key: "ad-space", label: "Рекламный кабинет" },
  { key: "support", label: "Поддержка" },
  { key: "cards", label: "Карточки" },
  { key: "goal", label: "Цель недели" },
  { key: "stages", label: "Этапы сезона" },
  { key: "banners", label: "Баннеры" },
  { key: "magazine-ads", label: "Реклама в журнале" },
  { key: "documents", label: "Документы" },
  { key: "calendar", label: "Календарь контента" },
  { key: "social", label: "Соцсети" },
  { key: "media", label: "Материалы" },
];

// Каждая галочка в «Персонал» открывает свой набор разделов.
// Владелец (super_admin) видит всё независимо от галочек.
const PERMISSION_TABS: Record<string, Tab[]> = {
  moderation: ["applications", "participants", "cards", "calendar", "media"],
  finance: ["dashboard", "goal"],
  partners: ["partners", "partner-logos", "banners", "magazine-ads", "ad-space", "social"],
  staff: ["staff", "users"],
  support: ["support", "documents"],
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
            className="bg-bgSurface w-72 h-full p-4 flex flex-col gap-1 overflow-y-auto"
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
        {tab === "partner-logos" && <PartnerLogosTab />}
        {tab === "ad-space" && <AdSpaceTab />}
        {tab === "support" && <SupportTab />}
        {tab === "cards" && <CardsTab />}
        {tab === "goal" && <GoalTab />}
        {tab === "stages" && <StagesTab />}
        {tab === "banners" && <BannersTab />}
        {tab === "magazine-ads" && <MagazineAdsTab />}
        {tab === "documents" && <DocumentsTab />}
        {tab === "calendar" && <CalendarTab />}
        {tab === "social" && <SocialLinksTab />}
        {tab === "media" && <MediaMaterialsTab />}
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
    companyEarnings: 0,
    pwaInstalls: 0,
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

      const { data: receivedData } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("type", "gift_received");
      const totalReceivedByParticipants = (receivedData ?? []).reduce(
        (sum: number, t: { amount: number }) => sum + Number(t.amount),
        0
      );

      const { count: pwaCount } = await supabase
        .from("pwa_installs")
        .select("id", { count: "exact", head: true });

      setStats({
        users: usersCount ?? 0,
        participants: participantsCount ?? 0,
        gifts: giftsTotal,
        tasksCompleted: tasksCount ?? 0,
        earnedByParticipants: totalBalance,
        totalPurchases,
        companyEarnings: totalPurchases - totalReceivedByParticipants,
        pwaInstalls: pwaCount ?? 0,
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
    { label: "Доход компании", value: `${Math.round(stats.companyEarnings)} ₽` },
    { label: "Установок PWA (Android — точно, iOS может недосчитывать)", value: stats.pwaInstalls },
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

    const { data: applicant } = await supabase
      .from("users")
      .select("region_id")
      .eq("id", app.user_id)
      .maybeSingle();

    await supabase.from("participants").insert({
      user_id: app.user_id,
      season_id: app.season_id,
      region_id: applicant?.region_id ?? null,
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

  async function clearEditorsChoice() {
    await supabase.from("participants").update({ is_editors_choice: false }).eq("is_editors_choice", true);
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
              onClick={() =>
                r.is_editors_choice ? clearEditorsChoice() : setEditorsChoice(r.id)
              }
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                r.is_editors_choice
                  ? "bg-bgPrimary border border-danger text-danger"
                  : "bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white"
              }`}
            >
              {r.is_editors_choice ? "✕ Убрать выбор редакции" : "Назначить выбор редакции"}
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
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  regions: { name: string }[] | { name: string } | null;
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
      .select("id, first_name, username, is_banned, last_login_at, photo_url, phone, email, regions(name)")
      .order("created_at", { ascending: false });
    setRows((data as unknown as UserRow[]) ?? []);

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
          <h2 className="text-lg text-offwhite font-semibold mb-2 flex items-center gap-2">
            {u.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={u.photo_url}
                alt=""
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            {u.first_name ?? "Без имени"}{" "}
            {u.username && (
              <span className="text-muted text-sm">@{u.username}</span>
            )}
          </h2>
          <p className="text-sm mb-1">
            {u.phone ?? "—"} · {u.email ?? "—"}
          </p>
          <p className="text-sm mb-1">
            Регион: {(Array.isArray(u.regions) ? u.regions[0]?.name : u.regions?.name) ?? "—"}
          </p>
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
  { key: "support", label: "Помощь и поддержка" },
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
  user_id: string | null;
  contact_info: any;
};

function PartnersTab() {
  const [rows, setRows] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [packageType, setPackageType] = useState("");
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResult, setLinkResult] = useState<{ id: string; first_name: string | null } | null>(null);
  const [linkSearching, setLinkSearching] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("sponsors")
      .select("id, name, amount, status, package_type, user_id, contact_info")
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

  async function searchUser() {
    if (!linkQuery) return;
    setLinkSearching(true);
    const isEmail = linkQuery.includes("@");
    const { data } = await supabase
      .from("users")
      .select("id, first_name")
      .eq(isEmail ? "email" : "phone", linkQuery.trim())
      .maybeSingle();
    setLinkResult(data ?? null);
    setLinkSearching(false);
  }

  async function confirmLink(sponsorId: string) {
    if (!linkResult) return;
    await supabase
      .from("sponsors")
      .update({ user_id: linkResult.id, status: "approved" })
      .eq("id", sponsorId);
    setLinkingId(null);
    setLinkQuery("");
    setLinkResult(null);
    await load();
  }

  async function unlinkPartner(sponsorId: string) {
    await supabase.from("sponsors").update({ user_id: null, status: "active" }).eq("id", sponsorId);
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
            <p className="text-sm text-muted mb-1">
              Контакты: {s.contact_info?.phone ?? "—"} / {s.contact_info?.email ?? "—"}
            </p>
            <p className="text-sm text-muted mb-3">
              Статус: {s.status === "approved" ? "✅ Одобрен, кабинет открыт" : s.status}
            </p>

            {s.user_id ? (
              <button
                onClick={() => unlinkPartner(s.id)}
                className="text-xs px-3 py-1.5 rounded-full bg-bgPrimary border border-danger text-danger"
              >
                Отвязать кабинет
              </button>
            ) : linkingId === s.id ? (
              <div className="flex flex-col gap-2">
                <input
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="Телефон или почта аккаунта партнёра"
                  className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-xs"
                />
                <button
                  onClick={searchUser}
                  disabled={linkSearching}
                  className="text-xs px-3 py-1.5 rounded-full bg-bgPrimary border border-gold text-gold"
                >
                  {linkSearching ? "Ищем..." : "Найти"}
                </button>
                {linkResult && (
                  <div className="bg-bgPrimary rounded-lg p-2 flex items-center justify-between">
                    <span className="text-xs text-offwhite">
                      Найден: {linkResult.first_name ?? "Без имени"}
                    </span>
                    <button
                      onClick={() => confirmLink(s.id)}
                      className="text-xs px-3 py-1 rounded-full bg-success text-bgPrimary"
                    >
                      Привязать
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setLinkingId(null);
                    setLinkResult(null);
                  }}
                  className="text-xs text-muted"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLinkingId(s.id)}
                className="text-xs px-3 py-1.5 rounded-full bg-gold text-bgPrimary font-semibold"
              >
                Одобрить и открыть кабинет
              </button>
            )}
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
  casting: "Отбор",
  week2: "Неделя 2",
  week3: "Неделя 3",
  week4: "Неделя 4",
  week5: "Неделя 5",
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
  banner_image_url: string | null;
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
      .select("id, stage_number, title, starts_at, ends_at, promo_video_url, banner_image_url")
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

  async function deleteVideo(stageId: string) {
    if (!confirm("Удалить промо-ролик этого этапа?")) return;
    await supabase
      .from("season_stages")
      .update({ promo_video_url: null })
      .eq("id", stageId);
    await loadStages(selectedSeason);
  }

  async function uploadBanner(stageId: string, file: File) {
    setUploadingId(stageId);
    const fileExt = file.name.split(".").pop();
    const filePath = `${stageId}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage
      .from("stage-banners")
      .upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadingId(null);
      return;
    }
    const { data: publicUrlData } = supabase.storage
      .from("stage-banners")
      .getPublicUrl(filePath);
    await supabase
      .from("season_stages")
      .update({ banner_image_url: publicUrlData.publicUrl })
      .eq("id", stageId);
    await loadStages(selectedSeason);
    setUploadingId(null);
  }

  async function deleteBanner(stageId: string) {
    if (!confirm("Убрать изображение баннера этого этапа?")) return;
    await supabase
      .from("season_stages")
      .update({ banner_image_url: null })
      .eq("id", stageId);
    await loadStages(selectedSeason);
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

  async function addStage() {
    const nextNumber = stages.length > 0 ? Math.max(...stages.map((s) => s.stage_number)) + 1 : 1;
    await supabase.from("season_stages").insert({
      season_id: selectedSeason,
      stage_number: nextNumber,
      title: `Этап ${nextNumber}`,
    });
    await loadStages(selectedSeason);
  }

  async function removeStage(stageId: string) {
    if (!confirm("Удалить этот этап? Даты и видео/баннер этапа удалятся.")) return;
    await supabase.from("season_stages").delete().eq("id", stageId);
    await loadStages(selectedSeason);
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-xs bg-bgSurface border border-gold/30 rounded-xl p-3 mb-4">
        Этапы здесь — общие на всю страну и действуют одновременно во всех
        регионах. Регион участницы влияет только на то, в каких списках и
        рейтингах она отображается — сами этапы, даты и баннер у всех одни.
      </p>

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

      {selectedSeason && (
        <button
          onClick={addStage}
          className="mb-4 bg-gold text-bgPrimary font-semibold px-4 py-2 rounded-full text-sm"
        >
          + Добавить этап
        </button>
      )}

      {loading && <p className="text-muted">Загрузка...</p>}

      {!loading &&
        stages.map((s, i) => (
          <div
            key={s.id}
            className="bg-bgSurface border border-muted rounded-xl p-4 mb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-gold text-sm font-semibold">
                Этап {s.stage_number}
              </p>
              <button
                onClick={() => removeStage(s.id)}
                className="text-danger text-xs"
              >
                Удалить этап
              </button>
            </div>
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
            {s.promo_video_url && (
              <button
                onClick={() => deleteVideo(s.id)}
                className="w-full text-center bg-danger text-bgPrimary text-xs font-semibold px-3 py-2 rounded-lg mt-2"
              >
                Удалить видео
              </button>
            )}

            <label className="text-offwhite text-xs mt-3 block">
              Изображение баннера на главной
            </label>
            {s.banner_image_url && (
              <div className="mt-1 mb-1 rounded-lg overflow-hidden aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.banner_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <label className="block w-full text-center bg-bgPrimary border border-gold text-gold text-xs font-semibold px-3 py-2 rounded-lg mt-1 cursor-pointer">
              {uploadingId === s.id
                ? "Загрузка..."
                : s.banner_image_url
                ? "Заменить изображение"
                : "Загрузить изображение"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingId === s.id}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadBanner(s.id, file);
                }}
              />
            </label>
            {s.banner_image_url && (
              <button
                onClick={() => deleteBanner(s.id)}
                className="w-full text-center bg-danger text-bgPrimary text-xs font-semibold px-3 py-2 rounded-lg mt-2"
              >
                Убрать изображение
              </button>
            )}
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

// ---------------------------------------------------------------------
// БАННЕРЫ
// ---------------------------------------------------------------------

type RegionOption = { id: string; name: string };

function RegionPicker({
  regions,
  allRegions,
  selectedIds,
  onToggleAll,
  onToggleRegion,
}: {
  regions: RegionOption[];
  allRegions: boolean;
  selectedIds: string[];
  onToggleAll: () => void;
  onToggleRegion: (id: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="flex items-center gap-2 text-sm text-offwhite mb-2">
        <input type="checkbox" checked={allRegions} onChange={onToggleAll} />
        Все регионы
      </label>
      {!allRegions && (
        <div className="max-h-40 overflow-y-auto bg-bgPrimary border border-muted rounded-lg p-2 flex flex-col gap-1">
          {regions.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={selectedIds.includes(r.id)}
                onChange={() => onToggleRegion(r.id)}
              />
              {r.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type BannerRow = {
  id: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  all_regions: boolean;
  region_names: string[];
};

function BannersTab() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);

  async function loadRegions() {
    const { data } = await supabase.from("regions").select("id, name").order("name");
    setRegions((data as RegionOption[]) ?? []);
  }

  async function load() {
    setLoading(true);
    const { data: settingRow } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "banners_enabled")
      .maybeSingle();
    setEnabled(settingRow?.value !== "false");

    const { data } = await supabase
      .from("promo_banners")
      .select("id, image_url, link_url, is_active, sort_order, all_regions, promo_banner_regions(regions(name))")
      .order("sort_order", { ascending: true });

    const mapped = (data as any[] ?? []).map((b) => ({
      id: b.id,
      image_url: b.image_url,
      link_url: b.link_url,
      is_active: b.is_active,
      sort_order: b.sort_order,
      all_regions: b.all_regions,
      region_names: (b.promo_banner_regions ?? [])
        .map((r: any) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
        .filter(Boolean),
    }));
    setBanners(mapped);
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadRegions();
  }, []);

  function toggleRegionSelection(id: string) {
    setSelectedRegionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function toggleEnabled() {
    const newValue = !enabled;
    await supabase
      .from("platform_settings")
      .upsert({ key: "banners_enabled", value: newValue ? "true" : "false" });
    setEnabled(newValue);
  }

  async function createBanner() {
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("promo-banners").upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("promo-banners").getPublicUrl(filePath);
    const { data: inserted, error: insertError } = await supabase
      .from("promo_banners")
      .insert({
        image_url: publicUrlData.publicUrl,
        link_url: linkUrl || null,
        sort_order: banners.length,
        all_regions: allRegions,
      })
      .select("id")
      .single();

    if (!insertError && inserted && !allRegions && selectedRegionIds.length > 0) {
      await supabase.from("promo_banner_regions").insert(
        selectedRegionIds.map((region_id) => ({ banner_id: inserted.id, region_id }))
      );
    }

    setLinkUrl("");
    setFile(null);
    setAllRegions(true);
    setSelectedRegionIds([]);
    await load();
    setUploading(false);
  }

  async function toggleActive(b: BannerRow) {
    await supabase.from("promo_banners").update({ is_active: !b.is_active }).eq("id", b.id);
    await load();
  }

  async function removeBanner(id: string) {
    if (!confirm("Удалить этот баннер?")) return;
    await supabase.from("promo_banners").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-lg">
      <div className="bg-bgSurface border border-muted rounded-xl p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-offwhite text-sm font-semibold">Раздел баннеров</p>
          <p className="text-muted text-xs">
            {enabled ? "Показывается на «Участницах» и «Рейтинге»" : "Выключен полностью"}
          </p>
        </div>
        <button
          onClick={toggleEnabled}
          className={`px-4 py-2 rounded-full text-sm font-semibold ${
            enabled ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"
          }`}
        >
          {enabled ? "Включено" : "Выключено"}
        </button>
      </div>

      <p className="text-muted text-sm mb-3">
        До 5 баннеров, показываются по кругу с автопрокруткой. Зритель видит
        только баннеры своего региона + общероссийские.
      </p>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <label className="block w-full text-center bg-bgPrimary border border-muted text-offwhite text-xs py-2 rounded-lg mb-2 cursor-pointer">
          {file ? file.name : "Выбрать изображение"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Ссылка при клике (необязательно)"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
        />

        <RegionPicker
          regions={regions}
          allRegions={allRegions}
          selectedIds={selectedRegionIds}
          onToggleAll={() => setAllRegions((v) => !v)}
          onToggleRegion={toggleRegionSelection}
        />

        <button
          onClick={createBanner}
          disabled={uploading || !file || banners.length >= 5}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          {uploading ? "Загрузка..." : banners.length >= 5 ? "Уже 5 баннеров" : "Добавить баннер"}
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {banners.map((b) => (
          <div key={b.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image_url} alt="" className="w-20 h-12 object-cover rounded-lg" />
            <div className="flex-1">
              <p className="text-muted text-xs truncate">{b.link_url || "без ссылки"}</p>
              <p className="text-gold text-[10px] mt-0.5">
                {b.all_regions ? "Все регионы" : b.region_names.join(", ") || "регион не выбран"}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleActive(b)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    b.is_active ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"
                  }`}
                >
                  {b.is_active ? "Активен" : "Выключен"}
                </button>
                <button
                  onClick={() => removeBanner(b.id)}
                  className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// ДОКУМЕНТЫ
// ---------------------------------------------------------------------

type DocumentRow = {
  id: string;
  title: string;
  content: string;
  audience: string;
  is_active: boolean;
};

function DocumentsTab() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState("all");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("documents")
      .select("id, title, content, audience, is_active")
      .order("sort_order", { ascending: true });
    setDocs((data as DocumentRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createDoc() {
    if (!title || !content) return;
    await supabase.from("documents").insert({
      title,
      content,
      audience,
      sort_order: docs.length,
    });
    setTitle("");
    setContent("");
    setAudience("all");
    await load();
  }

  async function toggleActive(d: DocumentRow) {
    await supabase.from("documents").update({ is_active: !d.is_active }).eq("id", d.id);
    await load();
  }

  async function removeDoc(id: string) {
    if (!confirm("Удалить этот документ?")) return;
    await supabase.from("documents").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-lg">
      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <p className="text-offwhite text-sm font-semibold mb-2">Новый документ</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название, напр. «Политика конфиденциальности»"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Текст документа"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
        >
          <option value="all">Все пользователи</option>
          <option value="participants">Только участницы</option>
          <option value="partner">Только партнёры</option>
        </select>
        <button
          onClick={createDoc}
          disabled={!title || !content}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          Добавить документ
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-bgSurface border border-muted rounded-xl p-4">
            <div className="flex justify-between items-start mb-1">
              <p className="text-offwhite text-sm font-semibold">{d.title}</p>
              <span className="text-muted text-[10px]">
                {d.audience === "participants" ? "участницы" : d.audience === "partner" ? "партнёры" : "все"}
              </span>
            </div>
            <p className="text-muted text-xs mb-2 line-clamp-2">{d.content}</p>
            <div className="flex gap-2">
              <button
                onClick={() => toggleActive(d)}
                className={`text-xs px-3 py-1 rounded-full ${
                  d.is_active ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"
                }`}
              >
                {d.is_active ? "Активен" : "Выключен"}
              </button>
              <button
                onClick={() => removeDoc(d.id)}
                className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// КАЛЕНДАРЬ КОНТЕНТА
// ---------------------------------------------------------------------

type SuggestionRow = { id: string; target: string; text: string };

function CalendarTab() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newTarget, setNewTarget] = useState("vetoks");

  async function load(d: string) {
    setLoading(true);
    const { data } = await supabase
      .from("content_suggestions")
      .select("id, target, text")
      .eq("suggestion_date", d)
      .order("sort_order", { ascending: true });
    setItems((data as SuggestionRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function addItem() {
    if (!newText) return;
    await supabase.from("content_suggestions").insert({
      suggestion_date: date,
      target: newTarget,
      text: newText,
      sort_order: items.length,
    });
    setNewText("");
    await load(date);
  }

  async function removeItem(id: string) {
    await supabase.from("content_suggestions").delete().eq("id", id);
    await load(date);
  }

  const vetoksItems = items.filter((i) => i.target === "vetoks");
  const socialItems = items.filter((i) => i.target === "social");

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Идеи для контента на конкретный день — участницы видят их у себя в
        профиле по выбранной дате. Обычно 3–5 вариантов на блок достаточно.
      </p>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mb-4"
      />

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <select
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        >
          <option value="vetoks">Для VETOKS</option>
          <option value="social">Для соцсетей участницы</option>
        </select>
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          rows={2}
          placeholder="Текст идеи"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={addItem}
          disabled={!newText}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          Добавить
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      {!loading && (
        <>
          <p className="text-offwhite text-sm font-semibold mb-2">👑 Для VETOKS</p>
          <div className="flex flex-col gap-2 mb-6">
            {vetoksItems.length === 0 && <p className="text-muted text-xs">Пусто</p>}
            {vetoksItems.map((i) => (
              <div key={i.id} className="bg-bgSurface border border-muted rounded-lg p-3 flex justify-between gap-2">
                <span className="text-offwhite text-sm">{i.text}</span>
                <button onClick={() => removeItem(i.id)} className="text-danger text-xs flex-shrink-0">
                  Удалить
                </button>
              </div>
            ))}
          </div>

          <p className="text-offwhite text-sm font-semibold mb-2">📱 Для соцсетей</p>
          <div className="flex flex-col gap-2">
            {socialItems.length === 0 && <p className="text-muted text-xs">Пусто</p>}
            {socialItems.map((i) => (
              <div key={i.id} className="bg-bgSurface border border-muted rounded-lg p-3 flex justify-between gap-2">
                <span className="text-offwhite text-sm">{i.text}</span>
                <button onClick={() => removeItem(i.id)} className="text-danger text-xs flex-shrink-0">
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// ВИТРИНА ПАРТНЁРОВ
// ---------------------------------------------------------------------

type PartnerLogoRow = {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
  is_active: boolean;
};

function PartnerLogosTab() {
  const [rows, setRows] = useState<PartnerLogoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("partner_logos")
      .select("id, name, logo_url, link_url, is_active")
      .order("sort_order", { ascending: true });
    setRows((data as PartnerLogoRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createLogo() {
    if (!file || !name) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("partner-logos").upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("partner-logos").getPublicUrl(filePath);
    await supabase.from("partner_logos").insert({
      name,
      logo_url: publicUrlData.publicUrl,
      link_url: linkUrl || null,
      sort_order: rows.length,
    });
    setName("");
    setLinkUrl("");
    setFile(null);
    await load();
    setUploading(false);
  }

  async function toggleActive(r: PartnerLogoRow) {
    await supabase.from("partner_logos").update({ is_active: !r.is_active }).eq("id", r.id);
    await load();
  }

  async function removeLogo(id: string) {
    if (!confirm("Удалить этого партнёра из витрины?")) return;
    await supabase.from("partner_logos").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Это карусель логотипов внизу главной страницы. Отдельно от вкладки
        «Партнёры» (там ведутся сделки/заявки) — здесь только витрина.
      </p>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название партнёра"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        />
        <label className="block w-full text-center bg-bgPrimary border border-muted text-offwhite text-xs py-2 rounded-lg mb-2 cursor-pointer">
          {file ? file.name : "Выбрать логотип"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Ссылка на партнёра, напр. https://..."
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
        />
        <button
          onClick={createLogo}
          disabled={uploading || !file || !name}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          {uploading ? "Загрузка..." : "Добавить в витрину"}
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex gap-3">
            <div
              className="w-16 h-16 flex-shrink-0 rounded-lg flex items-center justify-center p-2"
              style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(11,11,13,0.9))" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.logo_url} alt="" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-offwhite text-sm font-semibold">{r.name}</p>
              <p className="text-muted text-xs truncate">{r.link_url || "без ссылки"}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleActive(r)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    r.is_active ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"
                  }`}
                >
                  {r.is_active ? "Активен" : "Выключен"}
                </button>
                <button
                  onClick={() => removeLogo(r.id)}
                  className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// РЕКЛАМНЫЙ КАБИНЕТ
// ---------------------------------------------------------------------

type AdSlotRow = {
  id: string;
  category: string;
  slot_number: number;
  title: string;
  description: string | null;
  full_price: number;
  presale_price: number | null;
  presale_until: string | null;
  duration: string;
  status: string;
  capacity: number | null;
  sold_count: number;
  all_regions: boolean;
  region_names: string[];
};

type AdSlotRequestRow = {
  id: string;
  slot_id: string;
  name: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type AdMode = "tiers" | "capacity" | "seats";

const AD_CATEGORIES: { key: string; label: string; mode: AdMode }[] = [
  { key: "magazine", label: "Журнал", mode: "tiers" },
  { key: "homepage", label: "Главная (партнёры)", mode: "capacity" },
  { key: "banner_participants", label: "Баннер — Участницы", mode: "capacity" },
  { key: "banner_rating", label: "Баннер — Рейтинг", mode: "capacity" },
  { key: "jury", label: "Место в жюри", mode: "seats" },
  { key: "magazine_gf", label: "Гранд-финал · Журнал", mode: "tiers" },
  { key: "homepage_gf", label: "Гранд-финал · Главная", mode: "capacity" },
  { key: "banner_participants_gf", label: "Гранд-финал · Баннер Участницы", mode: "capacity" },
  { key: "banner_rating_gf", label: "Гранд-финал · Баннер Рейтинг", mode: "capacity" },
  { key: "jury_gf", label: "Гранд-финал · Жюри", mode: "seats" },
];

const DEFAULT_CAPACITY: Record<string, number> = {
  homepage: 20,
  homepage_gf: 20,
  banner_participants: 5,
  banner_participants_gf: 5,
  banner_rating: 5,
  banner_rating_gf: 5,
};

function AdSpaceTab() {
  const [subTab, setSubTab] = useState<"slots" | "requests">("slots");
  const [slots, setSlots] = useState<AdSlotRow[]>([]);
  const [requests, setRequests] = useState<
    (AdSlotRequestRow & { slot_title?: string; slot_category?: string; slot_number?: number })[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [addCategory, setAddCategory] = useState("magazine");
  const [title, setTitle] = useState("");
  const [slotNumber, setSlotNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [fullPrice, setFullPrice] = useState("");
  const [presalePrice, setPresalePrice] = useState("");
  const [presaleUntil, setPresaleUntil] = useState("");
  const [duration, setDuration] = useState("season");
  const [description, setDescription] = useState("");
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [addAllRegions, setAddAllRegions] = useState(true);
  const [addSelectedRegionIds, setAddSelectedRegionIds] = useState<string[]>([]);

  async function loadRegions() {
    const { data } = await supabase.from("regions").select("id, name").order("name");
    setRegions((data as RegionOption[]) ?? []);
  }

  function toggleAddRegion(id: string) {
    setAddSelectedRegionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFullPrice, setEditFullPrice] = useState("");
  const [editPresalePrice, setEditPresalePrice] = useState("");
  const [editPresaleUntil, setEditPresaleUntil] = useState("");
  const [editDuration, setEditDuration] = useState("season");
  const [editSlotNumber, setEditSlotNumber] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  const addMode = AD_CATEGORIES.find((c) => c.key === addCategory)?.mode ?? "seats";

  const [approvedPartners, setApprovedPartners] = useState<
    { user_id: string; name: string }[]
  >([]);
  const [sellingSlotId, setSellingSlotId] = useState<string | null>(null);
  const [sellPartnerId, setSellPartnerId] = useState("");

  async function loadPartners() {
    const { data } = await supabase
      .from("sponsors")
      .select("user_id, name")
      .eq("status", "approved")
      .not("user_id", "is", null);
    setApprovedPartners((data as any[]) ?? []);
  }

  async function loadSlots() {
    setLoading(true);
    const { data } = await supabase
      .from("ad_slots")
      .select(
        "id, category, slot_number, title, description, full_price, presale_price, presale_until, duration, status, capacity, sold_count, all_regions, ad_slot_regions(regions(name))"
      )
      .order("category", { ascending: true })
      .order("slot_number", { ascending: true });

    const mapped = (data as any[] ?? []).map((s) => ({
      ...s,
      region_names: (s.ad_slot_regions ?? [])
        .map((r: any) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
        .filter(Boolean),
    }));
    setSlots(mapped);
    setLoading(false);
  }

  async function loadRequests() {
    setLoading(true);
    const { data } = await supabase
      .from("ad_slot_requests")
      .select("id, slot_id, name, phone, message, status, created_at, ad_slots(title, category, slot_number)")
      .order("created_at", { ascending: false });
    const mapped = (data as any[] ?? []).map((r) => {
      const slotInfo = Array.isArray(r.ad_slots) ? r.ad_slots[0] : r.ad_slots;
      return {
        ...r,
        slot_title: slotInfo?.title,
        slot_category: slotInfo?.category,
        slot_number: slotInfo?.slot_number,
      };
    });
    setRequests(mapped);
    setLoading(false);
  }

  useEffect(() => {
    if (subTab === "slots") {
      loadSlots();
      loadPartners();
      loadRegions();
    } else loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  async function createSlot() {
    if (!title || !fullPrice) return;
    if (addMode !== "capacity" && !slotNumber) return;
    const { data: inserted, error } = await supabase
      .from("ad_slots")
      .insert({
        category: addCategory,
        slot_number: addMode === "capacity" ? 1 : Number(slotNumber),
        title,
        description: description || null,
        full_price: Number(fullPrice),
        presale_price: presalePrice ? Number(presalePrice) : null,
        presale_until: presaleUntil ? new Date(presaleUntil).toISOString() : null,
        duration,
        capacity:
          addMode === "capacity"
            ? Number(capacity || DEFAULT_CAPACITY[addCategory] || 20)
            : null,
        all_regions: addAllRegions,
      })
      .select("id")
      .single();

    if (!error && inserted && !addAllRegions && addSelectedRegionIds.length > 0) {
      await supabase.from("ad_slot_regions").insert(
        addSelectedRegionIds.map((region_id) => ({ slot_id: inserted.id, region_id }))
      );
    }

    setTitle("");
    setSlotNumber("");
    setCapacity("");
    setFullPrice("");
    setPresalePrice("");
    setPresaleUntil("");
    setDescription("");
    setAddAllRegions(true);
    setAddSelectedRegionIds([]);
    await loadSlots();
  }

  async function toggleSold(s: AdSlotRow) {
    if (s.status === "sold") {
      await supabase
        .from("ad_slots")
        .update({ status: "available", sold_at: null })
        .eq("id", s.id);
      await supabase.from("ad_slot_purchases").delete().eq("slot_id", s.id);
      await loadSlots();
      return;
    }
    setSellingSlotId(s.id);
    setSellPartnerId("");
  }

  async function confirmSell(s: AdSlotRow) {
    await supabase
      .from("ad_slots")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", s.id);
    if (sellPartnerId) {
      await supabase.from("ad_slot_purchases").insert({
        slot_id: s.id,
        owner_user_id: sellPartnerId,
      });
    }
    setSellingSlotId(null);
    setSellPartnerId("");
    await loadSlots();
  }

  async function bumpSold(s: AdSlotRow, delta: number) {
    const next = Math.max(0, Math.min(s.capacity ?? 0, s.sold_count + delta));
    await supabase.from("ad_slots").update({ sold_count: next }).eq("id", s.id);
    if (delta > 0 && sellPartnerId && sellingSlotId === s.id) {
      await supabase.from("ad_slot_purchases").insert({
        slot_id: s.id,
        owner_user_id: sellPartnerId,
      });
      setSellingSlotId(null);
      setSellPartnerId("");
    }
    await loadSlots();
  }

  async function removeSlot(id: string) {
    if (!confirm("Удалить это место?")) return;
    await supabase.from("ad_slots").delete().eq("id", id);
    await loadSlots();
  }

  function startEdit(s: AdSlotRow) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditDescription(s.description ?? "");
    setEditFullPrice(String(s.full_price));
    setEditPresalePrice(s.presale_price != null ? String(s.presale_price) : "");
    setEditPresaleUntil(s.presale_until ? s.presale_until.slice(0, 10) : "");
    setEditDuration(s.duration);
    setEditSlotNumber(String(s.slot_number));
    setEditCapacity(s.capacity != null ? String(s.capacity) : "");
  }

  async function saveEdit(id: string, mode: AdMode) {
    await supabase
      .from("ad_slots")
      .update({
        title: editTitle,
        description: editDescription || null,
        full_price: Number(editFullPrice),
        presale_price: editPresalePrice ? Number(editPresalePrice) : null,
        presale_until: editPresaleUntil ? new Date(editPresaleUntil).toISOString() : null,
        duration: editDuration,
        slot_number: mode === "capacity" ? 1 : Number(editSlotNumber),
        capacity: mode === "capacity" ? Number(editCapacity || 20) : null,
      })
      .eq("id", id);
    setEditingId(null);
    await loadSlots();
  }

  async function markRequestStatus(id: string, status: string) {
    await supabase.from("ad_slot_requests").update({ status }).eq("id", id);
    await loadRequests();
  }

  return (
    <div className="max-w-lg">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSubTab("slots")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            subTab === "slots" ? "bg-gold text-bgPrimary" : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          Места
        </button>
        <button
          onClick={() => setSubTab("requests")}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            subTab === "requests" ? "bg-gold text-bgPrimary" : "bg-bgSurface text-muted border border-muted"
          }`}
        >
          Заявки на покупку
        </button>
      </div>

      {subTab === "slots" && (
        <>
          <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
            <p className="text-offwhite text-sm font-semibold mb-2">Новое место</p>
            <select
              value={addCategory}
              onChange={(e) => setAddCategory(e.target.value)}
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
            >
              {AD_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>

            {addMode === "seats" && (
              <input
                value={slotNumber}
                onChange={(e) => setSlotNumber(e.target.value)}
                placeholder="Номер места (напр. 1, 2, 3...)"
                type="number"
                className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
              />
            )}

            {addMode === "tiers" && (
              <select
                value={slotNumber}
                onChange={(e) => setSlotNumber(e.target.value)}
                className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
              >
                <option value="">— сколько показов —</option>
                <option value="3">3 раза</option>
                <option value="5">5 раз</option>
                <option value="7">7 раз</option>
              </select>
            )}

            {addMode === "capacity" && (
              <input
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder={`Максимум мест (по умолчанию ${DEFAULT_CAPACITY[addCategory] ?? 20})`}
                type="number"
                className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
              />
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название, напр. «Реклама в журнале — место 1»"
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              rows={2}
              className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
            />
            <div className="flex gap-2 mb-2">
              <input
                value={fullPrice}
                onChange={(e) => setFullPrice(e.target.value)}
                placeholder="Полная цена, ₽"
                type="number"
                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
              >
                <option value="week">На неделю</option>
                <option value="season">На весь сезон</option>
              </select>
            </div>
            <p className="text-muted text-xs mb-1">Предпродажа (необязательно):</p>
            <div className="flex gap-2 mb-3">
              <input
                value={presalePrice}
                onChange={(e) => setPresalePrice(e.target.value)}
                placeholder="Цена предпродажи, ₽"
                type="number"
                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={presaleUntil}
                onChange={(e) => setPresaleUntil(e.target.value)}
                type="date"
                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <p className="text-muted text-xs mb-1">
              В каких регионах видно и продаётся:
            </p>
            <RegionPicker
              regions={regions}
              allRegions={addAllRegions}
              selectedIds={addSelectedRegionIds}
              onToggleAll={() => setAddAllRegions((v) => !v)}
              onToggleRegion={toggleAddRegion}
            />
            <button
              onClick={createSlot}
              disabled={!title || !fullPrice || (addMode !== "capacity" && !slotNumber)}
              className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
            >
              Добавить место
            </button>
          </div>

          {loading && <p className="text-muted">Загрузка...</p>}

          {!loading &&
            AD_CATEGORIES.map((cat) => {
              const catSlots = slots.filter((s) => s.category === cat.key);
              if (catSlots.length === 0) return null;
              return (
                <div key={cat.key} className="mb-6">
                  <p className="text-gold text-sm font-semibold mb-2">{cat.label}</p>
                  <div className="flex flex-col gap-3">
                    {catSlots.map((s) => (
                      <div key={s.id} className="bg-bgSurface border border-muted rounded-xl p-3">
                        {editingId === s.id ? (
                          <div className="flex flex-col gap-2">
                            {cat.mode === "seats" && (
                              <input
                                value={editSlotNumber}
                                onChange={(e) => setEditSlotNumber(e.target.value)}
                                type="number"
                                placeholder="Номер места"
                                className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              />
                            )}
                            {cat.mode === "tiers" && (
                              <select
                                value={editSlotNumber}
                                onChange={(e) => setEditSlotNumber(e.target.value)}
                                className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              >
                                <option value="3">3 раза</option>
                                <option value="5">5 раз</option>
                                <option value="7">7 раз</option>
                              </select>
                            )}
                            {cat.mode === "capacity" && (
                              <input
                                value={editCapacity}
                                onChange={(e) => setEditCapacity(e.target.value)}
                                type="number"
                                placeholder="Максимум мест"
                                className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              />
                            )}
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Название"
                              className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={2}
                              placeholder="Описание"
                              className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                            />
                            <div className="flex gap-2">
                              <input
                                value={editFullPrice}
                                onChange={(e) => setEditFullPrice(e.target.value)}
                                type="number"
                                placeholder="Полная цена"
                                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              />
                              <select
                                value={editDuration}
                                onChange={(e) => setEditDuration(e.target.value)}
                                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              >
                                <option value="week">На неделю</option>
                                <option value="season">На весь сезон</option>
                              </select>
                            </div>
                            <div className="flex gap-2">
                              <input
                                value={editPresalePrice}
                                onChange={(e) => setEditPresalePrice(e.target.value)}
                                type="number"
                                placeholder="Цена предпродажи"
                                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              />
                              <input
                                value={editPresaleUntil}
                                onChange={(e) => setEditPresaleUntil(e.target.value)}
                                type="date"
                                className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(s.id, cat.mode)}
                                className="flex-1 bg-gold text-bgPrimary font-semibold py-2 rounded-full text-xs"
                              >
                                Сохранить
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="flex-1 bg-bgPrimary border border-muted text-muted py-2 rounded-full text-xs"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-offwhite text-sm font-semibold">
                                {cat.mode === "seats" && `#${s.slot_number} · `}
                                {cat.mode === "tiers" && `${s.slot_number} раз · `}
                                {s.title}
                              </p>
                              {cat.mode !== "capacity" && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
                                    s.status === "sold"
                                      ? "bg-danger/20 text-danger"
                                      : "bg-success/20 text-success"
                                  }`}
                                >
                                  {s.status === "sold" ? "Занято" : "Свободно"}
                                </span>
                              )}
                            </div>
                            <p className="text-muted text-xs mb-2">
                              {Math.round(s.full_price)} ₽
                              {s.presale_price && (
                                <>
                                  {" "}
                                  · предпродажа {Math.round(s.presale_price)} ₽ до{" "}
                                  {s.presale_until &&
                                    new Date(s.presale_until).toLocaleDateString("ru-RU")}
                                </>
                              )}
                              {" · "}
                              {s.duration === "week" ? "на неделю" : "на сезон"}
                              {cat.mode === "capacity" && (
                                <> · занято {s.sold_count} из {s.capacity ?? 0}</>
                              )}
                            </p>
                            <p className="text-gold text-[11px] mb-2">
                              {s.all_regions
                                ? "Все регионы"
                                : (s.region_names ?? []).join(", ") || "регион не выбран"}
                            </p>

                            {sellingSlotId === s.id && (
                              <div className="mb-2 flex gap-2 items-center">
                                <select
                                  value={sellPartnerId}
                                  onChange={(e) => setSellPartnerId(e.target.value)}
                                  className="flex-1 bg-bgPrimary border border-gold rounded-lg px-2 py-1 text-xs"
                                >
                                  <option value="">— без привязки к партнёру —</option>
                                  {approvedPartners.map((p) => (
                                    <option key={p.user_id} value={p.user_id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                {cat.mode !== "capacity" && (
                                  <button
                                    onClick={() => confirmSell(s)}
                                    className="text-xs px-3 py-1 rounded-full bg-gold text-bgPrimary font-semibold"
                                  >
                                    OK
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => startEdit(s)}
                                className="text-xs px-3 py-1 rounded-full bg-bgPrimary border border-gold text-gold"
                              >
                                Редактировать
                              </button>
                              {cat.mode === "capacity" ? (
                                <>
                                  <button
                                    onClick={() => {
                                      if (sellingSlotId !== s.id) setSellingSlotId(s.id);
                                      else bumpSold(s, 1);
                                    }}
                                    className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary"
                                  >
                                    +1 продано
                                  </button>
                                  <button
                                    onClick={() => bumpSold(s, -1)}
                                    className="text-xs px-3 py-1 rounded-full bg-bgPrimary border border-muted text-muted"
                                  >
                                    −1
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => toggleSold(s)}
                                  className={`text-xs px-3 py-1 rounded-full ${
                                    s.status === "sold"
                                      ? "bg-bgPrimary border border-muted text-muted"
                                      : "bg-danger text-bgPrimary"
                                  }`}
                                >
                                  {s.status === "sold" ? "Освободить" : "Отметить проданным"}
                                </button>
                              )}
                              <button
                                onClick={() => removeSlot(s.id)}
                                className="text-xs px-3 py-1 rounded-full bg-bgPrimary border border-danger text-danger"
                              >
                                Удалить
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

          {!loading && slots.length === 0 && (
            <p className="text-muted text-sm">Мест пока не выставлено.</p>
          )}
        </>
      )}

      {subTab === "requests" && (
        <div className="flex flex-col gap-3">
          {loading && <p className="text-muted">Загрузка...</p>}
          {!loading && requests.length === 0 && (
            <p className="text-muted text-sm">Заявок пока нет.</p>
          )}
          {requests.map((r) => (
            <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-4">
              <p className="text-gold text-xs font-semibold mb-1">
                {AD_CATEGORIES.find((c) => c.key === r.slot_category)?.label ?? "—"}
                {r.slot_number != null && ` · место ${r.slot_number}`}
              </p>
              <p className="text-muted text-xs mb-2">{r.slot_title ?? "Место удалено"}</p>
              <p className="text-offwhite text-sm font-semibold mb-1">{r.name}</p>
              <p className="text-muted text-xs mb-1">{r.phone ?? "телефон не указан"}</p>
              {r.message && <p className="text-muted text-sm mb-2">{r.message}</p>}
              <p className="text-muted text-[10px] mb-2">
                {new Date(r.created_at).toLocaleString("ru-RU")}
              </p>
              <select
                value={r.status}
                onChange={(e) => markRequestStatus(r.id, e.target.value)}
                className="bg-bgPrimary border border-muted rounded-lg px-3 py-1 text-xs"
              >
                <option value="new">Новая</option>
                <option value="contacted">Связались</option>
                <option value="closed">Закрыта</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// СОЦСЕТИ
// ---------------------------------------------------------------------

function SocialLinksTab() {
  const [telegram, setTelegram] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("social_links").select("key, url");
    (data ?? []).forEach((row: { key: string; url: string | null }) => {
      if (row.key === "telegram") setTelegram(row.url ?? "");
      if (row.key === "instagram") setInstagram(row.url ?? "");
      if (row.key === "tiktok") setTiktok(row.url ?? "");
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    await supabase.from("social_links").upsert({ key: "telegram", url: telegram || null });
    await supabase.from("social_links").upsert({ key: "instagram", url: instagram || null });
    await supabase.from("social_links").upsert({ key: "tiktok", url: tiktok || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Ссылки на официальные соцсети VETOKS — показываются в профиле у всех
        пользователей внизу, под кнопками установки приложения.
      </p>
      {loading && <p className="text-muted">Загрузка...</p>}
      {!loading && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-offwhite text-sm">Telegram</label>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="https://t.me/..."
              className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">Instagram</label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/..."
              className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-offwhite text-sm">TikTok</label>
            <input
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://tiktok.com/@..."
              className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <button
            onClick={save}
            className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm w-fit"
          >
            Сохранить
          </button>
          {saved && <span className="text-success text-sm">Сохранено!</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// МАТЕРИАЛЫ ДЛЯ УЧАСТНИЦ
// ---------------------------------------------------------------------

type MaterialRow = { id: string; type: string; file_url: string; title: string | null };

function MediaMaterialsTab() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState("photo");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("media_materials")
      .select("id, type, file_url, title")
      .order("created_at", { ascending: false });
    setRows((data as MaterialRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("media-materials").upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("media-materials").getPublicUrl(filePath);
    await supabase.from("media_materials").insert({
      type,
      file_url: publicUrlData.publicUrl,
      title: title || null,
    });
    setTitle("");
    setFile(null);
    await load();
    setUploading(false);
  }

  async function remove(id: string) {
    if (!confirm("Удалить этот материал?")) return;
    await supabase.from("media_materials").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Фото и короткие видео, которые участницы смогут скачать для монтажа
        своих роликов. Загружайте сколько нужно.
      </p>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        >
          <option value="photo">Фото</option>
          <option value="video">Видео</option>
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название (необязательно)"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        />
        <label className="block w-full text-center bg-bgPrimary border border-muted text-offwhite text-xs py-2 rounded-lg mb-2 cursor-pointer">
          {file ? file.name : "Выбрать файл"}
          <input
            type="file"
            accept={type === "photo" ? "image/*" : "video/*"}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          onClick={upload}
          disabled={uploading || !file}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          {uploading ? "Загрузка..." : "Загрузить"}
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      <div className="grid grid-cols-3 gap-3">
        {rows.map((m) => (
          <div key={m.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
            {m.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.file_url} alt="" className="w-full aspect-square object-cover" />
            ) : (
              <video src={m.file_url} className="w-full aspect-square object-cover" muted />
            )}
            <button
              onClick={() => remove(m.id)}
              className="w-full text-danger text-xs py-1"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// РЕКЛАМА В ЖУРНАЛЕ
// ---------------------------------------------------------------------

type MagazineAdRow = {
  id: string;
  image_url: string;
  button_text: string;
  button_link: string;
  is_active: boolean;
  sort_order: number;
  all_regions: boolean;
  region_names: string[];
};

function MagazineAdsTab() {
  const [ads, setAds] = useState<MagazineAdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [buttonText, setButtonText] = useState("");
  const [buttonLink, setButtonLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [allRegions, setAllRegions] = useState(true);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>([]);

  async function loadRegions() {
    const { data } = await supabase.from("regions").select("id, name").order("name");
    setRegions((data as RegionOption[]) ?? []);
  }

  function toggleRegionSelection(id: string) {
    setSelectedRegionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("magazine_ads")
      .select(
        "id, image_url, button_text, button_link, is_active, sort_order, all_regions, magazine_ad_regions(regions(name))"
      )
      .order("sort_order", { ascending: true });

    const mapped = (data as any[] ?? []).map((a) => ({
      ...a,
      region_names: (a.magazine_ad_regions ?? [])
        .map((r: any) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
        .filter(Boolean),
    }));
    setAds(mapped);
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadRegions();
  }, []);

  async function createAd() {
    if (!file || !buttonText || !buttonLink) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("magazine-ads").upload(filePath, file);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("magazine-ads").getPublicUrl(filePath);
    const { data: inserted, error: insertError } = await supabase
      .from("magazine_ads")
      .insert({
        image_url: publicUrlData.publicUrl,
        button_text: buttonText,
        button_link: buttonLink,
        sort_order: ads.length,
        all_regions: allRegions,
      })
      .select("id")
      .single();

    if (!insertError && inserted && !allRegions && selectedRegionIds.length > 0) {
      await supabase.from("magazine_ad_regions").insert(
        selectedRegionIds.map((region_id) => ({ ad_id: inserted.id, region_id }))
      );
    }

    setButtonText("");
    setButtonLink("");
    setFile(null);
    setAllRegions(true);
    setSelectedRegionIds([]);
    await load();
    setUploading(false);
  }

  async function toggleActive(ad: MagazineAdRow) {
    await supabase.from("magazine_ads").update({ is_active: !ad.is_active }).eq("id", ad.id);
    await load();
  }

  async function removeAd(id: string) {
    if (!confirm("Удалить эту рекламу?")) return;
    await supabase.from("magazine_ads").delete().eq("id", id);
    await load();
  }

  return (
    <div className="max-w-lg">
      <p className="text-muted text-sm mb-4">
        Рекламный блок появляется каждой 10-й страницей в журнале на главной.
        Зритель видит только рекламу своего региона + общероссийскую.
      </p>

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-6">
        <p className="text-offwhite text-sm font-semibold mb-2">Новая реклама</p>
        <label className="block w-full text-center bg-bgPrimary border border-muted text-offwhite text-xs py-2 rounded-lg mb-2 cursor-pointer">
          {file ? file.name : "Выбрать изображение"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          value={buttonText}
          onChange={(e) => setButtonText(e.target.value)}
          placeholder="Текст кнопки, напр. «Узнать больше»"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2"
        />
        <input
          value={buttonLink}
          onChange={(e) => setButtonLink(e.target.value)}
          placeholder="Ссылка (https://... или /shop и т.п.)"
          className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
        />

        <RegionPicker
          regions={regions}
          allRegions={allRegions}
          selectedIds={selectedRegionIds}
          onToggleAll={() => setAllRegions((v) => !v)}
          onToggleRegion={toggleRegionSelection}
        />

        <button
          onClick={createAd}
          disabled={uploading || !file || !buttonText || !buttonLink}
          className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
        >
          {uploading ? "Загрузка..." : "Добавить рекламу"}
        </button>
      </div>

      {loading && <p className="text-muted">Загрузка...</p>}

      <div className="flex flex-col gap-3">
        {ads.map((ad) => (
          <div key={ad.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.image_url} alt="" className="w-16 h-20 object-cover rounded-lg" />
            <div className="flex-1">
              <p className="text-offwhite text-sm">{ad.button_text}</p>
              <p className="text-muted text-xs truncate">{ad.button_link}</p>
              <p className="text-gold text-[10px] mt-1">
                {ad.all_regions ? "Все регионы" : ad.region_names.join(", ") || "регион не выбран"}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleActive(ad)}
                  className={`text-xs px-3 py-1 rounded-full ${
                    ad.is_active ? "bg-success text-bgPrimary" : "bg-bgPrimary border border-muted text-muted"
                  }`}
                >
                  {ad.is_active ? "Активна" : "Выключена"}
                </button>
                <button
                  onClick={() => removeAd(ad.id)}
                  className="text-xs px-3 py-1 rounded-full bg-danger text-bgPrimary"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
