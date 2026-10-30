"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";
import { REPORT_REASONS } from "@/components/ReportSheet";

export type BizPublic = {
  id?: string;
  name: string;
  category: string;
  about: string;
  logo_url: string | null;
  cover_url: string | null;
  hours: string;
  address: string;
  phone: string;
  email: string;
  site_url: string;
  quick_action: "buy" | "book";
  verified: boolean;
};

// Синяя галочка «Официальный партнёр VETOKS».
export function BlueCheck({ size = 18 }: { size?: number }) {
  return (
    <span
      title="Официальный партнёр VETOKS"
      className="inline-flex items-center justify-center rounded-full flex-none align-middle"
      style={{ width: size, height: size, background: "#1d9bf0", color: "#fff", fontSize: size * 0.62, fontWeight: 700 }}
    >
      ✓
    </span>
  );
}

// Страница партнёра: так её видят зрители в приложении. Один и тот же вид для зрителей, владельца и предпросмотра в CRM.
export default function BusinessPageView({ p, preview = false }: { p: BizPublic; preview?: boolean }) {
  const [contact, setContact] = useState(false);
  const [report, setReport] = useState<"" | "pick" | "done">("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const quick = p.quick_action === "book" ? "📅 Забронировать" : "🛒 Купить";

  async function sendReport() {
    if (!reason) return;
    setBusy(true);
    setErr("");
    const r = await apiPost("/api/business/report", { id: p.id, reason, details });
    setBusy(false);
    if (r?.ok) setReport("done");
    else setErr("Не получилось отправить. Попробуйте ещё раз.");
  }

  return (
    <div className="pb-6">
      <div className="h-32 w-full overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.45), rgba(201,162,39,0.25))" }}>
        {p.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="px-5 -mt-8">
        <div className="flex items-end gap-3">
          <div className="w-20 h-20 rounded-2xl bg-bgSurface border border-gold/40 overflow-hidden flex items-center justify-center flex-none">
            {p.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gold text-2xl font-bold">{(p.name || "?").slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          {!preview && p.id && (
            <button onClick={() => setReport("pick")} className="ml-auto text-muted text-xs border border-muted/60 rounded-full px-3 py-1.5">
              Пожаловаться
            </button>
          )}
        </div>

        <h1 className="text-offwhite text-xl font-semibold mt-3 flex items-center gap-2 flex-wrap">
          <span className="min-w-0 break-words">{p.name}</span>
          {p.verified && <BlueCheck />}
        </h1>
        {p.verified && <p className="text-[#1d9bf0] text-xs mt-0.5">Официальный партнёр VETOKS</p>}
        {p.category && <p className="text-muted text-sm mt-1">{p.category}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={() => setContact(true)} className="flex-1 bg-gold text-bgPrimary font-semibold rounded-full py-3 text-sm">
            {quick}
          </button>
          {p.phone && (
            <a href={`tel:${p.phone}`} className="border border-gold text-gold font-semibold rounded-full px-5 py-3 text-sm">
              Позвонить
            </a>
          )}
        </div>

        {p.about && <p className="text-offwhite text-sm mt-4 whitespace-pre-line">{p.about}</p>}

        <div className="bg-bgSurface border border-muted rounded-xl p-4 mt-4 flex flex-col gap-2 text-sm">
          {p.hours && <Row k="🕒" v={p.hours} />}
          {p.address && <Row k="📍" v={p.address} />}
          {p.phone && <Row k="📞" v={p.phone} />}
          {p.email && <Row k="✉️" v={p.email} />}
          {p.site_url && (
            <div className="flex gap-3">
              <span>🌐</span>
              <a href={p.site_url} target="_blank" rel="noopener noreferrer" className="text-gold break-all">
                {p.site_url.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
          {!p.hours && !p.address && !p.phone && !p.email && !p.site_url && <p className="text-muted">Контакты пока не заполнены.</p>}
        </div>

        <div className="bg-bgSurface border border-muted/60 rounded-xl p-4 mt-3">
          <p className="text-offwhite text-sm font-semibold">Товары и предложения для зрителей</p>
          <p className="text-muted text-xs mt-1">Каталог, заказы и спецпредложения появятся здесь в следующем обновлении.</p>
        </div>
      </div>

      {contact && (
        <div className="fixed inset-0 z-[120] bg-black/65 flex items-end justify-center" onClick={() => setContact(false)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-offwhite font-semibold mb-1">{quick.replace(/^\S+\s/, "")}: {p.name}</p>
            <p className="text-muted text-xs mb-3">Оформление заказа внутри приложения появится в следующем обновлении. Пока свяжитесь с партнёром напрямую.</p>
            {p.phone && <p className="text-offwhite text-sm">📞 {p.phone}</p>}
            {p.email && <p className="text-offwhite text-sm mt-1">✉️ {p.email}</p>}
            {!p.phone && !p.email && <p className="text-muted text-sm">Контакты не указаны.</p>}
            <button onClick={() => setContact(false)} className="w-full mt-4 border border-muted text-offwhite rounded-full py-2.5 text-sm">Закрыть</button>
          </div>
        </div>
      )}

      {report && (
        <div className="fixed inset-0 z-[120] bg-black/65 flex items-end justify-center" onClick={() => !busy && setReport("")}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl p-5 max-h-[85dvh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }} onClick={(e) => e.stopPropagation()}>
            {report === "done" ? (
              <>
                <p className="text-offwhite font-semibold mb-2">Спасибо, жалоба отправлена</p>
                <p className="text-muted text-sm mb-4">Мы проверим страницу и примем решение.</p>
                <button onClick={() => setReport("")} className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm">Готово</button>
              </>
            ) : (
              <>
                <p className="text-offwhite font-semibold mb-3">Пожаловаться на страницу</p>
                <div className="flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => (
                    <button key={r.key} onClick={() => setReason(r.key)} className={`text-left rounded-xl px-4 py-2.5 border ${reason === r.key ? "border-gold bg-gold/10" : "border-muted"}`}>
                      <span className="text-offwhite text-sm block">{r.title}</span>
                      <span className="text-muted text-xs">{r.hint}</span>
                    </button>
                  ))}
                </div>
                <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="Что не так (по желанию)" className="w-full bg-bgPrimary border border-muted rounded-xl px-3 py-2 text-sm mt-3" />
                {err && <p className="text-danger text-xs mt-2">{err}</p>}
                <button onClick={sendReport} disabled={!reason || busy} className="w-full mt-3 bg-gold text-bgPrimary font-semibold rounded-full py-2.5 text-sm disabled:opacity-50">
                  {busy ? "Отправляем..." : "Отправить"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span>{k}</span>
      <span className="text-offwhite min-w-0 break-words">{v}</span>
    </div>
  );
}
