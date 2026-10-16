"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

const STAGES: [string, string][] = [
  ["lead", "Знакомство"],
  ["talks", "Переговоры"],
  ["agreed", "Договорились"],
  ["paid", "Оплатил"],
  ["active", "В проекте"],
  ["done", "Завершили"],
  ["lost", "Отказ"],
];

// CRM → «Партнёры»: этапы, платежи, заметки и дата следующего контакта.
export default function AdminPartnersPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [refNames, setRefNames] = useState<Record<string, string>>({});
  const [pQuery, setPQuery] = useState("");
  const [pFound, setPFound] = useState<any[]>([]);
  const [pPicked, setPPicked] = useState<{ id: string; name: string } | null>(null);
  const [pct, setPct] = useState("10");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("all");
  const [name, setName] = useState("");
  const [pkg, setPkg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [linkQ, setLinkQ] = useState("");
  const [linkUser, setLinkUser] = useState<{ id: string; first_name: string | null } | null | undefined>(undefined);

  async function load() {
    const r = await apiPost("/api/admin/partners", { action: "list", countryId: getCrmCountry() });
    setRows(r?.rows ?? []);
    setPays(r?.payments ?? []);
    setRefNames(r?.refNames ?? {});
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const act = async (body: object) => {
    await apiPost("/api/admin/partners", { ...body, countryId: getCrmCountry() });
    await load();
  };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await act({ action: "create", name, packageType: pkg });
    setName("");
    setPkg("");
  }

  async function addPayment(id: string) {
    if (!payAmount) return;
    await act({ action: "add_payment", id, amount: Number(payAmount), note: payNote });
    setPayAmount("");
    setPayNote("");
  }

  async function findUser() {
    const r = await apiPost("/api/admin/partners", { action: "find_user", id: open, query: linkQ });
    setLinkUser(r?.user ?? null);
  }

  async function searchParticipant() {
    const r = await apiPost("/api/admin/partners", { action: "find_participant", query: pQuery });
    setPFound(r?.items ?? []);
  }

  async function saveReferrer(id: string) {
    setMsg("");
    await act({ action: "set_referrer", id, participantId: pPicked?.id ?? null, percent: Number(pct) });
    setPPicked(null);
    setPFound([]);
    setPQuery("");
  }

  async function payReferrer(s: any, mine: any[]) {
    const total = mine.reduce((t, p) => t + Number(p.amount), 0);
    const bonus = Math.round(((total * Number(s.referral_percent)) / 100) * 100) / 100;
    if (!confirm(`Зачислить ${bonus} ₴ участнице ${refNames[s.referrer_participant_id] ?? ""}? Это делается один раз.`)) return;
    const r = await apiPost("/api/admin/partners", { action: "pay_referrer", id: s.id });
    setMsg(r?.ok ? `Зачислено ${r.amount} ₴` : r?.error === "forbidden" ? "Зачислять может только финансовый админ или владелец." : r?.error === "no_payments" ? "Сначала внесите платёж рекламодателя." : "Не получилось зачислить.");
    await load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const shown = rows.filter((r) => stageFilter === "all" || (r.stage ?? "lead") === stageFilter);
  const counts: Record<string, number> = {};
  rows.forEach((r) => (counts[r.stage ?? "lead"] = (counts[r.stage ?? "lead"] ?? 0) + 1));

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-3xl">
      <form onSubmit={create} className="bg-bgSurface border border-muted rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название партнёра" required className="flex-1 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
        <input value={pkg} onChange={(e) => setPkg(e.target.value)} placeholder="Пакет (необязательно)" className="md:w-52 bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm">Добавить</button>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setStageFilter("all")} className={`px-3 py-1.5 rounded-full text-xs border ${stageFilter === "all" ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}>
          Все ({rows.length})
        </button>
        {STAGES.map(([k, label]) => (
          <button key={k} onClick={() => setStageFilter(k)} className={`px-3 py-1.5 rounded-full text-xs border ${stageFilter === k ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"}`}>
            {label} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="text-muted text-sm">Здесь пока никого.</p>}

      <div className="flex flex-col gap-3">
        {shown.map((s) => {
          const mine = pays.filter((p) => p.sponsor_id === s.id);
          const isOpen = open === s.id;
          const overdue = s.follow_up_at && s.follow_up_at <= today && !["done", "lost"].includes(s.stage ?? "lead");
          return (
            <div key={s.id} className={`bg-bgSurface border rounded-xl p-4 ${overdue ? "border-gold" : "border-muted"}`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-gold font-semibold">{s.name}</p>
                  <p className="text-muted text-xs">
                    {s.package_type ?? "без пакета"} · внесено {Math.round(Number(s.amount ?? 0))} ₴
                    {s.user_id ? " · кабинет открыт" : ""}
                  </p>
                  {s.follow_up_at && (
                    <p className={`text-xs ${overdue ? "text-gold" : "text-muted"}`}>
                      {overdue ? "⏰ Связаться: " : "Связаться: "}
                      {new Date(s.follow_up_at).toLocaleDateString("ru-RU")}
                    </p>
                  )}
                </div>
                <select
                  value={s.stage ?? "lead"}
                  onChange={(e) => act({ action: "update", id: s.id, stage: e.target.value })}
                  className="bg-bgPrimary border border-muted rounded-full px-2 py-1 text-xs text-offwhite"
                >
                  {STAGES.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setOpen(isOpen ? null : s.id);
                  setNotesDraft(s.notes ?? "");
                  setLinkUser(undefined);
                  setLinkQ("");
                }}
                className="text-xs text-muted mt-2 underline"
              >
                {isOpen ? "Свернуть" : "Открыть подробности"}
              </button>

              {isOpen && (
                <div className="mt-3 flex flex-col gap-4">
                  <div>
                    <p className="text-offwhite text-xs font-semibold mb-1">Заметки</p>
                    <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={3} className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-2" placeholder="О чём договорились, контакты, условия" />
                    <div className="flex gap-2 items-center flex-wrap">
                      <label className="text-muted text-xs">Связаться:</label>
                      <input type="date" defaultValue={s.follow_up_at ?? ""} onChange={(e) => act({ action: "update", id: s.id, followUpAt: e.target.value })} className="bg-bgPrimary border border-muted rounded-lg px-2 py-1 text-xs" />
                      <button onClick={() => act({ action: "update", id: s.id, notes: notesDraft })} className="bg-gold text-bgPrimary px-3 py-1.5 rounded-full text-xs font-semibold">Сохранить заметки</button>
                    </div>
                  </div>

                  <div>
                    <p className="text-offwhite text-xs font-semibold mb-1">Платежи</p>
                    {mine.length === 0 && <p className="text-muted text-xs mb-1">Платежей пока нет.</p>}
                    {mine.map((p) => (
                      <div key={p.id} className="flex justify-between text-xs text-offwhite py-0.5">
                        <span>{new Date(p.paid_at).toLocaleDateString("ru-RU")} · {Math.round(Number(p.amount))} ₴ {p.note ? `· ${p.note}` : ""}</span>
                        <button onClick={() => confirm("Удалить платёж?") && act({ action: "delete_payment", id: s.id, paymentId: p.id })} className="text-danger">✕</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" placeholder="Сумма, ₴" className="w-28 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-xs" />
                      <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Комментарий" className="flex-1 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-xs" />
                      <button onClick={() => addPayment(s.id)} className="bg-success text-bgPrimary px-3 rounded-full text-xs font-semibold">Внести</button>
                    </div>
                  </div>

                  <div>
                    <p className="text-offwhite text-xs font-semibold mb-1">Бонус участнице за этого рекламодателя</p>
                    {s.referral_paid_at ? (
                      <p className="text-success text-xs">
                        Зачислено {Math.round(Number(s.referral_amount) * 100) / 100} ₴ участнице {refNames[s.referrer_participant_id] ?? ""} ·{" "}
                        {new Date(s.referral_paid_at).toLocaleDateString("ru-RU")}. Повторно не начисляется.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {s.referrer_participant_id ? (
                          <p className="text-offwhite text-xs">
                            Привела: <b>{refNames[s.referrer_participant_id] ?? "участница"}</b> · {Number(s.referral_percent)}% от платежей
                          </p>
                        ) : (
                          <p className="text-muted text-xs">Участница не выбрана.</p>
                        )}
                        <div className="flex gap-2">
                          <input value={pQuery} onChange={(e) => setPQuery(e.target.value)} placeholder="Имя участницы" className="flex-1 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-xs" />
                          <button onClick={searchParticipant} className="border border-gold text-gold px-3 rounded-full text-xs">Найти</button>
                        </div>
                        {pFound.map((p) => (
                          <button key={p.id} onClick={() => { setPPicked({ id: p.id, name: p.display_name }); setPFound([]); }} className="text-left bg-bgPrimary rounded-lg p-2 text-xs text-offwhite">
                            {p.display_name} <span className="text-muted">{p.regions?.name ?? ""}</span>
                          </button>
                        ))}
                        {pPicked && <p className="text-xs text-gold">Выбрана: {pPicked.name}</p>}
                        <div className="flex gap-2 items-center">
                          <input value={pct} onChange={(e) => setPct(e.target.value)} type="number" className="w-20 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-xs" />
                          <span className="text-muted text-xs">% от платежей</span>
                          <button onClick={() => saveReferrer(s.id)} className="bg-gold text-bgPrimary px-3 py-1.5 rounded-full text-xs font-semibold">Сохранить</button>
                        </div>
                        {s.referrer_participant_id && Number(s.referral_percent) > 0 && (
                          <button
                            onClick={() => payReferrer(s, mine)}
                            className="bg-success text-bgPrimary px-4 py-2 rounded-full text-xs font-semibold"
                          >
                            Зачислить {Math.round((mine.reduce((t, p) => t + Number(p.amount), 0) * Number(s.referral_percent)) ) / 100} ₴ участнице (один раз)
                          </button>
                        )}
                        <p className="text-muted text-[11px]">Нажмите «Зачислить», когда договорились и оплата прошла. Сумма считается от внесённых платежей на момент нажатия, начисляется один раз, без продлений.</p>
                      </div>
                    )}
                    {msg && <p className="text-gold text-xs mt-1">{msg}</p>}
                  </div>

                  <div>
                    <p className="text-offwhite text-xs font-semibold mb-1">Личный кабинет партнёра</p>
                    {s.user_id ? (
                      <button onClick={() => act({ action: "unlink", id: s.id })} className="text-xs px-3 py-1.5 rounded-full border border-danger text-danger">Отвязать кабинет</button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <input value={linkQ} onChange={(e) => setLinkQ(e.target.value)} placeholder="Телефон или почта аккаунта" className="flex-1 bg-bgPrimary border border-muted rounded-lg px-2 py-1.5 text-xs" />
                          <button onClick={findUser} className="border border-gold text-gold px-3 rounded-full text-xs">Найти</button>
                        </div>
                        {linkUser === null && <p className="text-muted text-xs">Аккаунт не найден.</p>}
                        {linkUser && (
                          <div className="flex justify-between items-center bg-bgPrimary rounded-lg p-2">
                            <span className="text-xs text-offwhite">Найден: {linkUser.first_name ?? "Без имени"}</span>
                            <button onClick={() => act({ action: "link", id: s.id, userId: linkUser.id })} className="bg-success text-bgPrimary px-3 py-1 rounded-full text-xs">Привязать</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
