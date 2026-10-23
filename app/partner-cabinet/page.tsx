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

type MyReq = { id: string; status: string; title: string; category: string; price: number | null; note: string | null; expires_at: string | null };

function fmtLeft(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

type Purchase = {
  id: string;
  created_at: string;
  ad_slots: {
    title: string;
    category: string;
    slot_number: number;
    duration: string;
    all_regions: boolean;
    ad_slot_regions: { regions: { name: string } | { name: string }[] | null }[] | null;
  } | null;
};

type DocRow = { id: string; title: string; content: string };

const CATEGORY_LABELS: Record<string, string> = {
  magazine: "Журнал",
  homepage: "Главная",
  banner_participants: "Баннер — Участницы",
  banner_rating: "Баннер — Рейтинг",
  jury: "Жюри от спонсоров",
  magazine_gf: "Гранд-финал · Журнал",
  homepage_gf: "Гранд-финал · Главная",
  banner_participants_gf: "Гранд-финал · Баннер Участницы",
  banner_rating_gf: "Гранд-финал · Баннер Рейтинг",
  jury_gf: "Гранд-финал · Жюри от спонсоров",
};

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
  const [placeId, setPlaceId] = useState("");

  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeNote, setCreativeNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ id: string; file_url: string; note: string | null; status: string }[]>([]);

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

  async function payNow(id: string) {
    setPaying(id);
    setPayMsg(null);
    const r = await payAdRequest(id);
    setPayMsg({ ok: r.ok, text: r.message + (r.test ? " (тест: баланс пополнен на 1000)" : "") });
    setPaying(null);
    await loadReqs();
    if (r.ok) await loadPurchases();
  }

  async function loadPurchases() {
    const u = await getCurrentUser();
    if (!u) return;
    const { data: purchasesData } = await supabase
      .from("ad_slot_purchases")
      .select(
        "id, created_at, ad_slots(title, category, slot_number, duration, all_regions, ad_slot_regions(regions(name)))"
      )
      .eq("owner_user_id", u.id)
      .order("created_at", { ascending: false });
    setPurchases((purchasesData as unknown as Purchase[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/partner-cabinet");
        return;
      }

      const { data: sponsor } = await supabase
        .from("sponsors")
        .select("id, name, status")
        .eq("user_id", u.id)
        .eq("status", "approved")
        .maybeSingle();

      // Кабинет открыт и тем, у кого есть заявка (одобрили — сразу видно «Оплатить»).
      const mineReqs = await loadReqs();
      if (!sponsor && mineReqs.length === 0) {
        setLoading(false);
        return;
      }
      setApproved(true);
      setCompanyName(sponsor?.name ?? "");

      const { data: purchasesData } = await supabase
        .from("ad_slot_purchases")
        .select(
          "id, created_at, ad_slots(title, category, slot_number, duration, all_regions, ad_slot_regions(regions(name)))"
        )
        .eq("owner_user_id", u.id)
        .order("created_at", { ascending: false });
      setPurchases((purchasesData as unknown as Purchase[]) ?? []);

      const { data: docsData } = await supabase
        .from("documents")
        .select("id, title, content")
        .eq("is_active", true)
        .eq("audience", "partner")
        .order("sort_order", { ascending: true });
      setDocs((docsData as DocRow[]) ?? []);

      const { data: creativesData } = await supabase
        .from("partner_creative_uploads")
        .select("id, file_url, note, status")
        .eq("owner_user_id", u.id)
        .order("created_at", { ascending: false });
      setUploadedList(creativesData ?? []);

      setLoading(false);
    })();
  }, [router]);

  async function uploadCreative() {
    if (!creativeFile) return;
    setUploading(true);
    const u = await getCurrentUser();
    if (!u) return;
    let cf: File;
    try {
      cf = await cleanImage(creativeFile);
    } catch (e: any) {
      alert(e?.message || "Не удалось обработать файл.");
      setUploading(false);
      return;
    }
    const fileExt = cf.name.split(".").pop();
    const filePath = `${u.id}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("partner-creatives").upload(filePath, cf);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("partner-creatives").getPublicUrl(filePath);
    await supabase.from("partner_creative_uploads").insert({
      owner_user_id: u.id,
      file_url: publicUrlData.publicUrl,
      note: [purchases.find((x) => x.id === placeId)?.ad_slots?.title, creativeNote].filter(Boolean).join(" — ") || null,
    });
    setCreativeFile(null);
    setCreativeNote("");
    const { data: creativesData } = await supabase
      .from("partner_creative_uploads")
      .select("id, file_url, note, status")
      .eq("owner_user_id", u.id)
      .order("created_at", { ascending: false });
    setUploadedList(creativesData ?? []);
    setUploading(false);
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  if (!approved) {
    return (
      <main className="min-h-screen pb-28">
        <PageHeader />
        <div className="px-6 py-12 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <h1 className="text-2xl font-semibold text-gold mb-4">Кабинет партнёра</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только одобренным партнёрам VETOKS. Если вы
          подавали заявку — дождитесь подтверждения, или напишите в поддержку.
        </p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-1">
          Кабинет партнёра
        </h1>
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
            </div>
          );
        })}
        {payMsg && <p className={`text-sm mb-4 ${payMsg.ok ? "text-success" : "text-danger"}`}>{payMsg.text}</p>}

        {reqs.filter((r) => r.status !== "approved" && r.status !== "paid").length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gold mb-2">Мои заявки</h2>
            {reqs.filter((r) => r.status !== "approved" && r.status !== "paid").map((r) => (
              <div key={r.id} className="bg-bgSurface border border-muted rounded-xl p-3 mb-2">
                <p className="text-offwhite text-sm">{r.title}</p>
                <p className="text-xs text-muted">
                  {r.status === "new" && "⏳ На рассмотрении"}
                  {r.status === "paying" && "Идёт оплата…"}
                  {r.status === "rejected" && `✖ Отклонено${r.note ? `: ${r.note}` : ""}`}
                  {(r.status === "contacted" || r.status === "closed") && "Обрабатывается менеджером"}
                </p>
              </div>
            ))}
          </div>
        )}

        <a
          href="/ad-space"
          className="block border border-gold text-gold rounded-xl p-3 mb-8 text-center text-sm font-semibold"
        >
          + Заказать ещё место
        </a>

        <h2 className="text-lg font-semibold text-gold mb-3">
          Мои размещения
        </h2>
        {purchases.length === 0 ? (
          <p className="text-muted text-sm mb-8">
            У вас пока нет выкупленных мест.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-8">
            {purchases.map((pu) => (
              <div key={pu.id} className="bg-bgSurface border border-muted rounded-xl p-3">
                <p className="text-offwhite text-sm font-semibold">
                  {pu.ad_slots ? CATEGORY_LABELS[pu.ad_slots.category] ?? pu.ad_slots.category : "—"}
                </p>
                <p className="text-muted text-xs">
                  {pu.ad_slots?.title} · {pu.ad_slots?.duration === "week" ? "на неделю" : "на сезон"}
                </p>
                <p className="text-gold text-[11px] mt-1">
                  📍{" "}
                  {pu.ad_slots?.all_regions
                    ? "Все регионы"
                    : (pu.ad_slots?.ad_slot_regions ?? [])
                        .map((r) => (Array.isArray(r.regions) ? r.regions[0]?.name : r.regions?.name))
                        .filter(Boolean)
                        .join(", ") || "регион не указан"}
                </p>
                <p className="text-muted text-[10px] mt-1">
                  Оформлено {new Date(pu.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gold mb-3">
          Статистика моей рекламы
        </h2>
        <PartnerAdStats />

        <h2 className="text-lg font-semibold text-gold mb-3">
          Прислать макет
        </h2>
        {purchases.length > 0 && (
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="w-full bg-bgSurface border border-muted rounded-lg px-3 py-2 text-sm mb-3 text-offwhite"
          >
            <option value="">Выберите, для какого места макет</option>
            {purchases.map((pu) => (
              <option key={pu.id} value={pu.id}>
                {(pu.ad_slots ? CATEGORY_LABELS[pu.ad_slots.category] ?? pu.ad_slots.category : "—")} · {pu.ad_slots?.title}
              </option>
            ))}
          </select>
        )}
        {(() => {
          const pu = purchases.find((x) => x.id === placeId);
          const h = adHintFor(pu?.ad_slots?.category);
          if (!pu) return <p className="text-muted text-xs mb-3">Выберите место выше — покажем точные требования к макету именно для него.</p>;
          if (!h) return <p className="text-muted text-xs mb-3">Для этого места размер уточнит менеджер. Прикрепите файл и опишите пожелания.</p>;
          return (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-3 mb-3 text-xs">
              <p className="text-gold font-semibold mb-1">{h.title}</p>
              <p className="text-offwhite mb-1">📐 {h.size}</p>
              <p className="text-muted mb-1">📍 {h.where}</p>
              <p className="text-muted">💡 {h.tips}</p>
            </div>
          );
        })()}
        <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 mb-8">
          <label className="block w-full text-center bg-bgPrimary border border-muted text-offwhite text-xs py-2 rounded-lg mb-2 cursor-pointer">
            {creativeFile ? creativeFile.name : "Выбрать файл"}
            <input
              type="file"
              className="hidden"
              onChange={(e) => setCreativeFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <input
            value={creativeNote}
            onChange={(e) => setCreativeNote(e.target.value)}
            placeholder="Комментарий (куда вставить, для какого места)"
            className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mb-3"
          />
          <button
            onClick={uploadCreative}
            disabled={uploading || !creativeFile}
            className="w-full bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm disabled:opacity-40"
          >
            {uploading ? "Загрузка..." : "Отправить макет"}
          </button>
        </div>

        {uploadedList.length > 0 && (
          <div className="flex flex-col gap-2 mb-8">
            {uploadedList.map((up) => (
              <div key={up.id} className="bg-bgSurface border border-muted rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="text-offwhite text-xs">{up.note ?? "Без комментария"}</p>
                  <p className="text-muted text-[10px]">
                    {up.status === "new" ? "На проверке" : up.status}
                  </p>
                </div>
                <a href={up.file_url} target="_blank" rel="noopener noreferrer" className="text-gold text-xs">
                  Открыть
                </a>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gold mb-3">
          Документы
        </h2>
        {docs.length === 0 ? (
          <p className="text-muted text-sm">Документов пока нет.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {docs.map((d) => (
              <div key={d.id} className="bg-bgSurface border border-muted rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenDocId(openDocId === d.id ? null : d.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-offwhite text-sm font-semibold">{d.title}</span>
                  <span className="text-gold text-sm">{openDocId === d.id ? "▲" : "▼"}</span>
                </button>
                {openDocId === d.id && (
                  <div className="px-4 pb-4 text-muted text-sm whitespace-pre-wrap">
                    {d.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
