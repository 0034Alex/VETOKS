"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Purchase = {
  id: string;
  created_at: string;
  ad_slots: {
    title: string;
    category: string;
    slot_number: number;
    duration: string;
  } | null;
};

type DocRow = { id: string; title: string; content: string };

const CATEGORY_LABELS: Record<string, string> = {
  magazine: "Журнал",
  homepage: "Главная",
  banner_participants: "Баннер — Участницы",
  banner_rating: "Баннер — Рейтинг",
  jury: "Место в жюри",
  magazine_gf: "Гранд-финал · Журнал",
  homepage_gf: "Гранд-финал · Главная",
  banner_participants_gf: "Гранд-финал · Баннер Участницы",
  banner_rating_gf: "Гранд-финал · Баннер Рейтинг",
  jury_gf: "Гранд-финал · Жюри",
};

export default function PartnerCabinetPage() {
  const router = useRouter();
  const [approved, setApproved] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeNote, setCreativeNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ id: string; file_url: string; note: string | null; status: string }[]>([]);

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

      if (!sponsor) {
        setLoading(false);
        return;
      }
      setApproved(true);
      setCompanyName(sponsor.name);

      const { data: purchasesData } = await supabase
        .from("ad_slot_purchases")
        .select("id, created_at, ad_slots(title, category, slot_number, duration)")
        .eq("owner_user_id", u.id)
        .order("created_at", { ascending: false });
      setPurchases((purchasesData as unknown as Purchase[]) ?? []);

      const { data: docsData } = await supabase
        .from("documents")
        .select("id, title, content")
        .eq("is_active", true)
        .in("audience", ["all", "partner"])
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
    const fileExt = creativeFile.name.split(".").pop();
    const filePath = `${u.id}-${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from("partner-creatives").upload(filePath, creativeFile);
    if (error) {
      alert(`Ошибка загрузки: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from("partner-creatives").getPublicUrl(filePath);
    await supabase.from("partner_creative_uploads").insert({
      owner_user_id: u.id,
      file_url: publicUrlData.publicUrl,
      note: creativeNote || null,
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
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  if (!approved) {
    return (
      <main className="min-h-screen px-6 py-12 pb-28 flex flex-col items-center justify-center text-center">
        <PageHeader />
        <h1 className="text-2xl font-semibold text-gold mb-4">Кабинет партнёра</h1>
        <p className="text-muted max-w-sm">
          Этот раздел доступен только одобренным партнёрам VETOKS. Если вы
          подавали заявку — дождитесь подтверждения, или напишите в поддержку.
        </p>
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

        <a
          href="/ad-space"
          className="block bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 mb-8 text-center"
        >
          <span className="text-white font-semibold text-sm">
            🎬 Схема мест — выбрать и оплатить
          </span>
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
                <p className="text-muted text-[10px] mt-1">
                  Оформлено {new Date(pu.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-gold mb-3">
          Прислать макет
        </h2>
        <p className="text-muted text-xs mb-3">
          Требования: баннеры — 1200×600 px, PNG или JPG, до 5 МБ. Видео для
          журнала — вертикальное 9:16, до 30 сек, MP4. Мы вставим материал
          вручную после проверки.
        </p>
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
