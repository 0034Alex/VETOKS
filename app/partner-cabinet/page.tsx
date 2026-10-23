"use client";

import { cleanImage } from "@/lib/imageClean";
import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import PartnerAdStats from "@/components/PartnerAdStats";
import { apiPost } from "@/lib/authClient";
import { payAdRequest } from "@/lib/adPayClient";
import { adHintFor } from "@/lib/adHints";

type MyReq = {
  id: string;
  status: string;
  title: string;
  category: string;
  price: number | null;
  note: string | null;
  expires_at: string | null;
  slot_id: string;
  company: string;
  link_url: string;
  ad_text: string;
  image_url: string | null;
  comment: string;
  edit_kind: string | null;
  has_pending: boolean;
  live_until: string | null;
  live: boolean;
};

type Purchase = {
  id: string;
  slot_id: string | null;
  created_at: string;
  ad_slots: { title: string; category: string; duration: string } | null;
};

type DocRow = { id: string; title: string; content: string };

const CATEGORY_LABELS: Record<string, string> = {
  magazine: "Журнал",
  homepage: "Главная",
  banner_participants: "Баннер — Участницы",
  banner_rating: "Баннер — Рейтинг",
  banner_partner_page: "Баннер — «Стать партнёром»",
  jury: "Жюри от спонсоров",
  magazine_gf: "Гранд-финал · Журнал",
  homepage_gf: "Гранд-финал · Главная",
  banner_participants_gf: "Гранд-финал · Баннер Участницы",
  banner_rating_gf: "Гранд-финал · Баннер Рейтинг",
  jury_gf: "Гранд-финал · Жюри от спонсоров",
};

function fmtLeft(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function PartnerCabinetPage() {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reqs, setReqs] = useState<MyReq[]>([]);
  const [cur, setCur] = useState("₴");
  const [now, setNow] = useState(Date.now());
  const [paying, setPaying] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Правка материала
  const [editing, setEditing] = useState<MyReq | null>(null);
  const [eCompany, setECompany] = useState("");
  const [eLink, setELink] = useState("");
  const [eText, setEText] = useState("");
  const [eComment, setEComment] = useState("");
  const [eFile, setEFile] = useState<File | null>(null);
  const [eBusy, setEBusy] = useState(false);
  const [eErr, setEErr] = useState("");
  const [eDone, setEDone] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadReqs() {
    const r = await apiPost("/api/ad/mine");
    if (r?.ok) {
      setReqs(r.items ?? []);
      if (r.currency) setCur(r.currency);
      return (r.items ?? []) as MyReq[];
    }
    return [] as MyReq[];
  }

  async function loadPurchases() {
    const u = await getCurrentUser();
    if (!u) return;
    const { data } = await supabase
      .from("ad_slot_purchases")
      .select("id, slot_id, created_at, ad_slots(title, category, duration)")
      .eq("owner_user_id", u.id)
      .order("created_at", { ascending: false });
    setPurchases((data as unknown as Purchase[]) ?? []);
  }

  async function payNow(id: string) {
    setPaying(id);
    setPayMsg(null);
    const r = await payAdRequest(id);
    setPayMsg({ ok: r.ok, text: r.message + (r.test ? " (тест: баланс пополнен на 1000)" : "") });
    setPaying(null);
    await loadReqs();
    if (r.ok) await loadPurchases();
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/partner-cabinet");
        return;
      }
      const { data: sponsor } = await supabase.from("sponsors").select("id, name, status").eq("user_id", u.id).eq("status", "approved").maybeSingle();
      // Кабинет открыт и тем, у кого есть заявка (одобрили — сразу видно «Оплатить»).
      const mine = await loadReqs();
      if (!sponsor && mine.length === 0) {
        setLoading(false);
        return;
      }
      setApproved(true);
      setCompanyName(sponsor?.name ?? "");
      await loadPurchases();
      const { data: docsData } = await supabase
        .from("documents")
        .select("id, title, content")
        .eq("is_active", true)
        .eq("audience", "partner")
        .order("sort_order", { ascending: true });
      setDocs((docsData as DocRow[]) ?? []);
      setLoading(false);
    })();
  }, [router]);

  function openEdit(r: MyReq) {
    setEditing(r);
    setECompany(r.company);
    setELink(r.link_url);
    setEText(r.ad_text);
    setEComment(r.comment);
    setEFile(null);
    setEErr("");
    setEDone("");
  }

  async function saveEdit() {
    if (!editing) return;
    setEBusy(true);
    setEErr("");
    try {
      const fd = new FormData();
      fd.set("requestId", editing.id);
      fd.set("company", eCompany);
      fd.set("linkUrl", eLink);
      fd.set("adText", eText);
      fd.set("comment", eComment);
      if (eFile) fd.set("file", await cleanImage(eFile, 1600));
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/ad/edit", {
        method: "POST",
        headers: sess.session?.access_token ? { Authorization: `Bearer ${sess.session.access_token}` } : {},
        body: fd,
      });
      const r = await res.json().catch(() => ({}));
      if (r?.ok) {
        setEDone(
          r.state === "review_live"
            ? "Правки отправлены на проверку. Пока их одобряют, в эфире остаётся прежняя версия."
            : "Правки отправлены на повторную проверку."
        );
        await loadReqs();
      } else {
        const m: Record<string, string> = {
          need_link: "Укажите ссылку.",
          need_image: "Нужна картинка.",
          image_big: "Картинка слишком большая — не больше 3 МБ.",
          bad_image: "Файл должен быть картинкой.",
          busy: "Сейчас заявку изменить нельзя — идёт оплата.",
        };
        setEErr(m[r?.error] ?? "Не получилось отправить. Попробуйте ещё раз.");
      }
    } catch (e: any) {
      setEErr(e?.message || "Не получилось отправить. Попробуйте ещё раз.");
    }
    setEBusy(false);
  }

  if (loading) return <LoadingScreen />;

  if (!approved) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
          <h1 className="text-2xl font-semibold text-gold mb-4">Кабинет партнёра</h1>
          <p className="text-muted max-w-sm">
            Этот раздел открывается после отправки заявки на рекламу. Выберите место в «Рекламном кабинете» и отправьте заявку.
          </p>
          <a href="/ad-space" className="mt-6 bg-gold text-bgPrimary font-semibold px-6 py-3 rounded-full text-sm">Выбрать место</a>
        </div>
        <BottomNav />
      </main>
    );
  }

  const unpaid = reqs.filter((r) => r.status !== "paid");
  const paid = reqs.filter((r) => r.status === "paid");
  const paidSlots = new Set(paid.map((r) => r.slot_id));
  const manualPurchases = purchases.filter((p) => !p.slot_id || !paidSlots.has(p.slot_id));
  const hint = editing ? adHintFor(editing.category) : null;

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">Кабинет партнёра</h1>
        <p className="text-gold text-sm mb-6">{companyName}</p>

        {reqs.filter((r) => r.status === "approved").map((r) => {
          const left = r.expires_at ? new Date(r.expires_at).getTime() - now : 0;
          const expired = !!r.expires_at && left <= 0;
          return (
            <div key={r.id} className="rounded-2xl border border-gold bg-gold/10 p-4 mb-4">
              <p className="text-gold text-xs tracking-widest mb-1">ЗАЯВКА ОДОБРЕНА</p>
              <p className="text-offwhite font-semibold">{r.title}</p>
              {expired ? (
                <p className="text-danger text-sm mt-2">Время на оплату вышло. Напишите в поддержку — мы продлим.</p>
              ) : (
                <>
                  <p className="text-muted text-xs mt-2">Оплатите в течение 24 часов, иначе бронь снимется</p>
                  <p className="text-gold text-3xl font-semibold tabular-nums my-1">{r.expires_at ? fmtLeft(left) : "24:00:00"}</p>
                  <button
                    onClick={() => payNow(r.id)}
                    disabled={paying === r.id}
                    className="w-full bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white font-semibold py-3 rounded-full text-sm disabled:opacity-50 mt-2"
                  >
                    {paying === r.id ? "Оплата..." : `Оплатить ${Math.round(Number(r.price ?? 0))} ${cur}`}
                  </button>
                </>
              )}
              <button onClick={() => openEdit(r)} className="w-full text-gold text-xs mt-3 underline">Изменить материал (уйдёт на повторную проверку)</button>
            </div>
          );
        })}
        {payMsg && <p className={`text-sm mb-4 ${payMsg.ok ? "text-success" : "text-danger"}`}>{payMsg.text}</p>}

        {unpaid.filter((r) => r.status !== "approved").length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gold mb-2">Мои заявки</h2>
            {unpaid.filter((r) => r.status !== "approved").map((r) => (
              <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-3 mb-2">
                <p className="text-offwhite text-sm">{r.title}</p>
                <p className="text-xs text-muted">
                  {r.status === "new" && (r.edit_kind === "edit_prepay" ? "⏳ Правки на повторной проверке" : "⏳ На рассмотрении")}
                  {r.status === "paying" && "Идёт оплата…"}
                  {r.status === "rejected" && `✖ Отклонено${r.note ? `: ${r.note}` : ""}`}
                  {(r.status === "contacted" || r.status === "closed") && "Обрабатывается менеджером"}
                </p>
                {(r.status === "new" || r.status === "rejected") && (
                  <button onClick={() => openEdit(r)} className="text-gold text-xs mt-2 underline">
                    {r.status === "rejected" ? "Исправить и отправить снова" : "Изменить заявку"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gold mb-3">Моя реклама</h2>
        {paid.length === 0 && manualPurchases.length === 0 ? (
          <p className="text-muted text-sm mb-6">Оплаченной рекламы пока нет.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {paid.map((r) => {
              const ended = !!r.live_until && new Date(r.live_until).getTime() <= now;
              return (
                <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-3">
                  <p className="text-offwhite text-sm font-semibold">{CATEGORY_LABELS[r.category] ?? r.category}</p>
                  <p className="text-muted text-xs">{r.title}</p>
                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="max-h-24 rounded-lg border border-muted mt-2" />
                  )}
                  {r.live && r.live_until && !ended && (
                    <p className="text-success text-xs mt-2">● В эфире до {new Date(r.live_until).toLocaleDateString("ru-RU")} · осталось {daysLeft(r.live_until)} дн.</p>
                  )}
                  {ended && <p className="text-muted text-xs mt-2">Срок завершился {new Date(r.live_until!).toLocaleDateString("ru-RU")}</p>}
                  {!r.live && !ended && <p className="text-gold text-xs mt-2">Оплачено. Материал для этого места поставит менеджер.</p>}
                  {r.has_pending && <p className="text-gold text-xs mt-1">✏️ Правка на проверке — пока в эфире прежняя версия</p>}
                  {!ended && !r.has_pending && (
                    <button onClick={() => openEdit(r)} className="text-gold text-xs mt-2 underline">Изменить материал</button>
                  )}
                </div>
              );
            })}
            {manualPurchases.map((pu) => (
              <div key={pu.id} className="bg-bgSurface border border-muted rounded-xl p-3">
                <p className="text-offwhite text-sm font-semibold">{pu.ad_slots ? CATEGORY_LABELS[pu.ad_slots.category] ?? pu.ad_slots.category : "—"}</p>
                <p className="text-muted text-xs">{pu.ad_slots?.title} · оформлено менеджером {new Date(pu.created_at).toLocaleDateString("ru-RU")}</p>
              </div>
            ))}
          </div>
        )}

        <a href="/ad-space" className="block border border-gold text-gold rounded-xl p-3 mb-8 text-center text-sm font-semibold">
          + Заказать ещё место
        </a>

        <h2 className="text-lg font-semibold text-gold mb-3">Статистика моей рекламы</h2>
        <PartnerAdStats />

        <h2 className="text-lg font-semibold text-gold mb-3">Документы</h2>
        {docs.length === 0 ? (
          <p className="text-muted text-sm">Документов пока нет.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {docs.map((d) => (
              <div key={d.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
                <button onClick={() => setOpenDocId(openDocId === d.id ? null : d.id)} className="w-full flex items-center justify-between p-4 text-left">
                  <span className="text-offwhite text-sm font-semibold">{d.title}</span>
                  <span className="text-gold text-sm">{openDocId === d.id ? "▲" : "▼"}</span>
                </button>
                {openDocId === d.id && <div className="px-4 pb-4 text-muted text-sm whitespace-pre-wrap">{d.content}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 flex overflow-y-auto overscroll-contain z-[60] px-6" onClick={() => setEditing(null)}>
          <div className="bg-bgSurface border border-gold/40 rounded-2xl p-6 w-full max-w-sm m-auto my-8" onClick={(e) => e.stopPropagation()}>
            <p className="text-gold text-xs tracking-widest mb-1">{CATEGORY_LABELS[editing.category] ?? editing.category}</p>
            <h3 className="text-offwhite text-lg font-semibold mb-1">{editing.title}</h3>
            <p className="text-muted text-[11px] mb-3">
              {editing.status === "paid"
                ? "Реклама уже идёт. После правки новая версия уйдёт на проверку, а до одобрения в эфире останется прежняя. Повторно платить не нужно."
                : "Заявка вернётся на проверку. Срок оплаты при этом не продлевается."}
            </p>
            {eDone ? (
              <>
                <p className="text-success text-sm text-center py-4">{eDone}</p>
                <button onClick={() => setEditing(null)} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">Закрыть</button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                {hint && (
                  <div className="bg-bgPrimary border border-gold/40 rounded-lg p-3 text-[11px]">
                    <p className="text-offwhite mb-1">📐 {hint.size}</p>
                    <p className="text-muted">📍 {hint.where}</p>
                  </div>
                )}
                <input value={eCompany} onChange={(e) => setECompany(e.target.value)} placeholder="Компания или имя *" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
                <input value={eLink} onChange={(e) => setELink(e.target.value)} placeholder="Ссылка, куда вести клиентов *" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
                <textarea value={eText} onChange={(e) => setEText(e.target.value)} rows={3} placeholder="Текст рекламы" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
                {editing.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.image_url} alt="" className="max-h-28 rounded-lg border border-muted" />
                )}
                <label className="text-muted text-xs">
                  Заменить картинку (необязательно, до 3 МБ)
                  <input type="file" accept="image/*" onChange={(e) => setEFile(e.target.files?.[0] ?? null)} className="block mt-1 text-xs text-offwhite" />
                </label>
                <textarea value={eComment} onChange={(e) => setEComment(e.target.value)} rows={2} placeholder="Комментарий для модератора" className="bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm" />
                {eErr && <p className="text-danger text-xs">{eErr}</p>}
                <button onClick={saveEdit} disabled={!eCompany.trim() || eBusy} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm disabled:opacity-40 mt-1">
                  {eBusy ? "Отправляем..." : "Отправить на проверку"}
                </button>
                <button onClick={() => setEditing(null)} className="w-full text-muted text-xs mt-1">Закрыть</button>
              </div>
            )}
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
