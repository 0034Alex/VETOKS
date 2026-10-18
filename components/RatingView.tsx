"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { formatCompact } from "@/lib/formatCompact";
import { getMyCountry } from "@/lib/myCountry";

type Ranking = {
  title_key: string;
  participant_id: string;
  metric_value: number;
};

type TitleSetting = {
  key: string;
  label: string;
  unit: string;
  sort_order: number;
};

type Participant = { id: string; display_name: string; photo_url: string | null };

export default function RatingView() {
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [scope, setScope] = useState<"region" | "country">("region");
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [titles, setTitles] = useState<TitleSetting[]>([]);
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [editorsChoice, setEditorsChoice] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    const { data: titlesData } = await supabase
      .from("title_settings")
      .select("key, label, unit, sort_order")
      .eq("enabled", true)
      .order("sort_order");
    setTitles((titlesData as TitleSetting[]) ?? []);

    const mc = await getMyCountry();
    // Берём самый свежий итог, который посчитал сервер (раз в сутки в 00:01).
    let q = supabase
      .from("title_rankings_v2")
      .select("snapshot_date")
      .eq("scope", scope === "region" && me?.region_id ? "region" : "country")
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (scope === "region" && me?.region_id) q = q.eq("region_id", me.region_id);
    else if (mc.countryId) q = q.eq("country_id", mc.countryId);
    const { data: latest } = await q.maybeSingle();

    if (latest?.snapshot_date) {
      setSnapshotDate(latest.snapshot_date);
      let r = supabase
        .from("title_rankings_v2")
        .select("title_key, participant_id, metric_value")
        .eq("scope", scope === "region" && me?.region_id ? "region" : "country")
        .eq("snapshot_date", latest.snapshot_date);
      if (scope === "region" && me?.region_id) r = r.eq("region_id", me.region_id);
      else if (mc.countryId) r = r.eq("country_id", mc.countryId);
      const { data: rows } = await r;
      const list = (rows as Ranking[]) ?? [];
      setRankings(list);

      const ids = [...new Set(list.map((x) => x.participant_id))];
      if (ids.length) {
        const { data: pData } = await supabase
          .from("participants")
          .select("id, display_name, photo_url")
          .in("id", ids);
        const map: Record<string, Participant> = {};
        ((pData as Participant[]) ?? []).forEach((p) => (map[p.id] = p));
        setParticipants(map);
      } else setParticipants({});
    } else {
      setSnapshotDate(null);
      setRankings([]);
      setParticipants({});
    }

    let eq2 = supabase
      .from("participants")
      .select("id, display_name, photo_url")
      .eq("is_editors_choice", true);
    if (mc.countryId) eq2 = eq2.in("region_id", mc.regionIds);
    const { data: editorsData } = await eq2.limit(1).maybeSingle();
    setEditorsChoice((editorsData as Participant) ?? null);

    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setMe(u);
    })();
  }, []);

  useEffect(() => {
    if (me !== null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, scope]);

  return (
    <div>
      <div>
        <div className="px-6 mb-4">
          <p className="text-muted text-sm">
            {scope === "region" ? "Титулы по вашему региону" : "Титулы по всей стране"}
          </p>
          {snapshotDate && (
            <p className="text-muted text-xs mt-1">
              Итоги от {snapshotDate.split("-").reverse().join(".")}
            </p>
          )}
        </div>

        <div className="px-6 mb-4 flex gap-2">
          <button
            onClick={() => setScope("region")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              scope === "region"
                ? "bg-gold text-bgPrimary"
                : "bg-bgSurface text-muted border border-muted"
            }`}
          >
            {me?.regions?.name ?? "Мой регион"}
          </button>
          <button
            onClick={() => setScope("country")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              scope === "country"
                ? "bg-gold text-bgPrimary"
                : "bg-bgSurface text-muted border border-muted"
            }`}
          >
            Вся страна
          </button>
        </div>

        {loading && <p className="text-muted text-center">Загрузка...</p>}

        {!loading && rankings.length === 0 && !editorsChoice && (
          <p className="px-6 text-center text-muted mb-4">
            Итоги ещё не подведены. Рейтинг обновляется каждую ночь в 00:01.
          </p>
        )}

        <div className="px-6 flex flex-col gap-3">
          {titles.map((t) => {
            const ranking = rankings.find((r) => r.title_key === t.key);
            const p = ranking ? participants[ranking.participant_id] : null;
            if (!ranking || !p) return null;
            return (
              <Link
                key={t.key}
                href={`/participant/${p.id}`}
                className="flex items-center gap-3 bg-bgSurface border border-muted rounded-xl p-3"
              >
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo_url}
                    alt={p.display_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-black/40" />
                )}
                <div className="flex-1">
                  <p className="text-muted text-xs">{t.label}</p>
                  <p className="text-offwhite font-semibold">{p.display_name}</p>
                </div>
                <span className="text-gold text-sm font-semibold">
                  {formatCompact(ranking.metric_value)} {t.unit}
                </span>
              </Link>
            );
          })}

          {editorsChoice && (
            <Link
              href={`/participant/${editorsChoice.id}`}
              className="flex items-center gap-3 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-3"
            >
              {editorsChoice.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editorsChoice.photo_url}
                  alt={editorsChoice.display_name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-black/20" />
              )}
              <div className="flex-1">
                <p className="text-white/80 text-xs">🌟 Выбор редакции</p>
                <p className="text-white font-semibold">{editorsChoice.display_name}</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
