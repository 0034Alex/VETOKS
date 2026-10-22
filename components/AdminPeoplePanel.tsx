"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";

const FILTERS: [string, string][] = [
  ["all", "Все"],
  ["participants", "Участницы"],
  ["unverified", "Без номера"],
  ["new7", "Новые (7 дней)"],
  ["banned", "Заблокированные"],
  ["teen", "TEEN 15–17"],
  ["main", "MISS 18–29"],
  ["adult", "LADY 30+"],
  ["nobirth", "Без даты рождения"],
];

const ACTION_LABELS: Record<string, string> = {
  ban: "Заблокирован",
  unban: "Разблокирован",
  change_country: "Перенесён в другую страну",
  hide_from_contest: "Скрыта из конкурса",
  show_in_contest: "Возвращена в конкурс",
};

// CRM → «Пользователи»: поиск, фильтры и карточка человека.
export default function AdminPeoplePanel() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [regionId, setRegionId] = useState("");
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<any | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const [moveMsg, setMoveMsg] = useState("");
  const [newPass, setNewPass] = useState("");
  const [passMsg, setPassMsg] = useState("");

  const [teenOn, setTeenOn] = useState<boolean | null>(null);
  useEffect(() => {
    apiPost("/api/admin/teen-open", { action: "get" }).then((r) => setTeenOn(r?.ok ? !!r.open : null));
  }, []);
  async function toggleTeen() {
    const r = await apiPost("/api/admin/teen-open", { action: "set", open: !teenOn });
    if (r?.ok) setTeenOn(!!r.open);
  }

  useEffect(() => {
    supabase.from("countries").select("id, name").order("name").then(({ data }) => setCountries((data as any) ?? []));
  }, []);

  async function setPassword() {
    if (!card?.user || newPass.length < 8) return;
    const r = await apiPost("/api/admin/people", { action: "setpass", userId: card.user.id, password: newPass });
    if (r?.ok) {
      const how = r.authEmail && !String(r.authEmail).endsWith("@tg.vetoks.app") ? `почта ${r.authEmail}` : r.phone && r.phoneVerified ? `телефон ${r.phone}` : "у этого аккаунта нет почты и подтверждённого телефона — войти по паролю нельзя, только через Telegram";
      setPassMsg(`Пароль сохранён. Вход: ${how}.`);
      setNewPass("");
    } else setPassMsg(r?.error === "forbidden" ? "Только владелец." : r?.error === "short" ? "Пароль — от 8 символов." : "Не получилось.");
  }

  async function moveCountry() {
    if (!card?.user || !moveTo) return;
    const name = countries.find((c) => c.id === moveTo)?.name ?? "";
    if (!confirm(`Перенести этого человека в страну «${name}»? Он исчезнет из текущей страны, а его регион ему придётся выбрать заново.`)) return;
    const r = await apiPost("/api/admin/user-country", { userId: card.user.id, countryId: moveTo });
    setMoveMsg(r?.ok ? (r.unchanged ? "Он уже в этой стране." : `Готово: теперь в стране «${r.countryName}».`) : r?.error === "no_regions" ? "В этой стране ещё нет регионов." : r?.error === "forbidden" ? "Нет прав на эту страну." : "Не получилось.");
    setMoveTo("");
    await openCard(card.user.id);
    await search();
  }

  useEffect(() => {
    (getCrmCountry()
      ? supabase.from("regions").select("id, name").eq("country_id", getCrmCountry()).order("name")
      : supabase.from("regions").select("id, name").order("name")
    ).then(({ data }) => setRegions((data as any) ?? []));
  }, []);

  async function search() {
    setLoading(true);
    const r = await apiPost("/api/admin/people", { action: "list", q, filter, regionId: regionId || null, countryId: getCrmCountry() });
    setRows(r?.rows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, regionId]);

  async function openCard(id: string) {
    setCardLoading(true);
    setCard({ loading: true });
    setMoveMsg("");
    setPassMsg("");
    const r = await apiPost("/api/admin/people", { action: "card", userId: id });
    setCard(r?.ok ? r : null);
    setCardLoading(false);
  }

  async function ban(ban: boolean) {
    if (!card?.user) return;
    if (ban && !confirm("Заблокировать этого человека?")) return;
    await apiPost("/api/admin/people", { action: "ban", userId: card.user.id, ban });
    await openCard(card.user.id);
    await search();
  }

  async function hide(hide: boolean) {
    if (!card?.participant) return;
    if (hide && !confirm("Скрыть участницу из конкурса? Её не будет в списках и рейтингах.")) return;
    await apiPost("/api/admin/people", { action: "hide", participantId: card.participant.id, hide });
    await openCard(card.user.id);
    await search();
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("ru-RU") : "—");

  return (
    <div className="max-w-2xl">
      {teenOn !== null && (
        <div className={`flex items-center justify-between gap-3 mb-3 rounded-xl border px-4 py-3 ${teenOn ? "border-gold bg-gold/10" : "border-muted bg-bgSurface"}`}>
          <div className="min-w-0">
            <p className="text-offwhite text-sm font-semibold">Раздел TEEN 15–17: {teenOn ? "ВКЛЮЧЁН" : "ВЫКЛЮЧЕН"}</p>
            <p className="text-muted text-xs">
              {teenOn
                ? "Подростки могут регистрироваться и участвовать, раздел виден в приложении."
                : "В приложении про TEEN ничего нет: ни в переключателе категорий, ни при регистрации. Вход с 18 лет."}
            </p>
          </div>
          <button
            onClick={toggleTeen}
            className={`flex-shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${teenOn ? "bg-danger text-white" : "bg-gold text-bgPrimary"}`}
          >
            {teenOn ? "Выключить" : "Включить"}
          </button>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Имя, @ник, телефон или почта"
          className="flex-1 bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={search} className="bg-gold text-bgPrimary font-semibold px-4 rounded-lg text-sm">
          Найти
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              filter === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          className="bg-bgPrimary border border-muted rounded-full px-3 py-1.5 text-xs text-offwhite"
        >
          <option value="">Все регионы</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Ищем...</p>
      ) : rows.length === 0 ? (
        <p className="text-muted text-sm">Никого не найдено.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((u) => (
            <button
              key={u.id}
              onClick={() => openCard(u.id)}
              className="text-left bg-bgSurface border border-muted rounded-xl px-3 py-2.5 flex items-center gap-3"
            >
              {u.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.photo_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-bgPrimary flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-offwhite text-sm truncate">
                  {u.first_name ?? "Без имени"} {u.username && <span className="text-muted">@{u.username}</span>}
                </p>
                <p className="text-muted text-xs truncate">{u.phone ?? u.email ?? "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-[10px] flex-shrink-0">
                {u.participant && <span className="text-gold">участница{u.participant.is_eliminated ? " (скрыта)" : ""}</span>}
                {u.age_category && <span className="text-goldSoft">{u.age_category === "teen" ? "TEEN" : u.age_category === "adult" ? "LADY" : "MISS"}</span>}
                {u.phone_verified ? <span className="text-success">номер ✓</span> : <span className="text-muted">без номера</span>}
                {u.is_banned && <span className="text-danger">заблокирован</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {card && (
        <div
          onClick={() => setCard(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-bgSurface border border-muted rounded-2xl p-5 w-full max-w-md relative"
            style={{ maxHeight: "88dvh", overflowY: "auto" }}
          >
            <button onClick={() => setCard(null)} className="absolute top-2 right-3 text-muted text-xl">✕</button>
            {cardLoading || card.loading ? (
              <p className="text-muted">Загрузка...</p>
            ) : (
              <>
                <h3 className="text-offwhite font-semibold text-lg mb-1">{card.user.first_name ?? "Без имени"}</h3>
                <p className="text-muted text-xs mb-3">
                  {card.user.username ? `@${card.user.username} · ` : ""}
                  {(Array.isArray(card.user.regions) ? card.user.regions[0]?.name : card.user.regions?.name) ?? "регион не указан"}
                </p>

                {card.user.age_category === "teen" && (
                  <div className="border border-gold/50 rounded-lg p-3 mb-3 text-xs text-offwhite">
                    <p className="text-gold font-semibold mb-1">Согласие родителей</p>
                    {(card.consents ?? []).length === 0 && <p className="text-danger">Не получено</p>}
                    {(card.consents ?? []).map((c: any, i: number) => (
                      <p key={i}>
                        {c.status === "approved" ? "✅ Дано" : c.status === "revoked" ? "⛔ Отозвано" : "⏳ Ждёт номер"} · {c.parent_name ?? "—"} · {c.parent_phone ?? "—"}{c.parent_tg_username ? ` · @${c.parent_tg_username}` : ""} · {c.agreed_at ? new Date(c.agreed_at).toLocaleString("ru-RU") : ""}
                      </p>
                    ))}
                  </div>
                )}

                {card.signs.length > 0 && (
                  <div className="border border-danger rounded-lg p-3 mb-3">
                    <p className="text-danger text-xs font-semibold mb-1">⚠ Признаки накрутки / проблем</p>
                    {card.signs.map((s: string, i: number) => (
                      <p key={i} className="text-offwhite text-xs">• {s}</p>
                    ))}
                  </div>
                )}

                <div className="text-sm text-offwhite flex flex-col gap-1 mb-3">
                  <p>Телефон: {card.user.phone ?? "—"} {card.user.phone_verified ? "✓ подтверждён" : "(не подтверждён)"}</p>
                  <p>Почта: {card.user.email ?? "—"}</p>
                  <p>Роль: {card.user.role}</p>
                  <p>Категория: {card.user.age_category ? ({ teen: "TEEN 15–17", main: "MISS 18–29", adult: "LADY 30+" } as Record<string, string>)[card.user.age_category] : "—"} · Дата рождения: {card.user.birth_date ?? "не указана"}</p>
                  <p>Регистрация: {fmt(card.user.created_at)}</p>
                  <p>Последний вход: {fmt(card.user.last_login_at)}</p>
                  <p>Баланс: {Math.round(card.balance)} {crmCur}</p>
                  <p>Голосов отдано: {card.votesCast} · Подарков отправлено: {card.giftsSent}</p>
                  {card.participant && (
                    <p>
                      Участница «{card.participant.display_name}» · голосов получено (посл. 500): {card.votesReceived} · жалоб: {card.reportsAgainst}
                      {card.participant.is_eliminated ? " · СКРЫТА из конкурса" : ""}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <button onClick={() => ban(!card.user.is_banned)} className="border border-muted px-3 py-1.5 rounded-full text-xs text-offwhite">
                    {card.user.is_banned ? "Разблокировать" : "Заблокировать"}
                  </button>
                  {card.participant && (
                    <button onClick={() => hide(!card.participant.is_eliminated)} className="border border-muted px-3 py-1.5 rounded-full text-xs text-offwhite">
                      {card.participant.is_eliminated ? "Вернуть в конкурс" : "Скрыть из конкурса"}
                    </button>
                  )}
                </div>

                <div className="border border-muted rounded-lg p-3 mb-3">
                  <p className="text-muted text-xs mb-2">Задать человеку новый пароль (только владелец)</p>
                  <div className="flex gap-2">
                    <input value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Новый пароль, от 8 символов" className="flex-1 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-sm" />
                    <button onClick={setPassword} disabled={newPass.length < 8} className="bg-gold text-bgPrimary font-semibold px-3 rounded-lg text-sm disabled:opacity-40">Задать</button>
                  </div>
                  {passMsg && <p className="text-offwhite text-xs mt-2">{passMsg}</p>}
                </div>

                <div className="border border-muted rounded-lg p-3 mb-3">
                  <p className="text-muted text-xs mb-2">Сменить страну (человек и его анкета переедут в базу новой страны)</p>
                  <div className="flex gap-2">
                    <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="flex-1 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-sm">
                      <option value="">— выберите страну —</option>
                      {countries.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button onClick={moveCountry} disabled={!moveTo} className="bg-gold text-bgPrimary font-semibold px-3 rounded-lg text-sm disabled:opacity-40">
                      Перенести
                    </button>
                  </div>
                  {moveMsg && <p className="text-offwhite text-xs mt-2">{moveMsg}</p>}
                </div>

                {card.log.length > 0 && (
                  <div>
                    <p className="text-muted text-xs mb-1">История действий персонала</p>
                    {card.log.map((l: any, i: number) => (
                      <p key={i} className="text-offwhite text-xs">
                        {fmt(l.created_at)} — {ACTION_LABELS[l.action] ?? l.action}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
