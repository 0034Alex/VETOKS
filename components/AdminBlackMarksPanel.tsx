"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { crmRegionIds } from "@/lib/crmCountry";
import { kyivWeekStart } from "@/lib/kyiv";

// CRM → «Чёрная метка»: что происходит на этой неделе и история штрафов.
// Штраф применяется сам в понедельник в 00:01. Кто отправил метку — не показываем.

type Standing = { region: string; name: string; count: number };
type History = { week: string; region: string; name: string; marks: number; penalty: number };

export default function AdminBlackMarksPanel() {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Standing[]>([]);
  const [history, setHistory] = useState<History[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const weekStart = kyivWeekStart();

      const rids0 = await crmRegionIds();
      let mq = supabase
        .from("black_marks")
        .select("target_participant_id, region_id")
        .eq("week_start", weekStart);
      let pq = supabase
        .from("black_mark_penalties")
        .select("participant_id, region_id, week_start, marks_count, penalty_votes")
        .order("week_start", { ascending: false })
        .limit(60);
      if (rids0) {
        mq = mq.in("region_id", rids0);
        pq = pq.in("region_id", rids0);
      }
      const { data: marks } = await mq;
      const { data: pens } = await pq;

      const pIds = new Set<string>();
      const rIds = new Set<string>();
      (marks ?? []).forEach((m: any) => {
        pIds.add(m.target_participant_id);
        rIds.add(m.region_id);
      });
      (pens ?? []).forEach((p: any) => {
        pIds.add(p.participant_id);
        rIds.add(p.region_id);
      });

      const { data: ps } = pIds.size
        ? await supabase.from("participants").select("id, display_name").in("id", [...pIds])
        : { data: [] as any[] };
      const { data: rs } = rIds.size
        ? await supabase.from("regions").select("id, name").in("id", [...rIds])
        : { data: [] as any[] };
      const pName: Record<string, string> = {};
      (ps ?? []).forEach((p: any) => (pName[p.id] = p.display_name));
      const rName: Record<string, string> = {};
      (rs ?? []).forEach((r: any) => (rName[r.id] = r.name));

      const counts: Record<string, number> = {};
      const regionOf: Record<string, string> = {};
      (marks ?? []).forEach((m: any) => {
        counts[m.target_participant_id] = (counts[m.target_participant_id] ?? 0) + 1;
        regionOf[m.target_participant_id] = m.region_id;
      });
      setCurrent(
        Object.keys(counts)
          .map((id) => ({
            region: rName[regionOf[id]] ?? "—",
            name: pName[id] ?? "—",
            count: counts[id],
          }))
          .sort((a, b) => a.region.localeCompare(b.region) || b.count - a.count)
      );

      setHistory(
        (pens ?? []).map((p: any) => ({
          week: p.week_start,
          region: rName[p.region_id] ?? "—",
          name: pName[p.participant_id] ?? "—",
          marks: p.marks_count,
          penalty: p.penalty_votes,
        }))
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-muted">Загрузка...</p>;

  return (
    <div className="max-w-lg">
      <p className="text-muted text-xs mb-4">
        Метки отправляют участницы по воскресеньям, по одной в неделю, только
        в своём регионе. В понедельник в 00:01 штраф получает одна участница
        региона — с наибольшим числом меток (не меньше минимума, при равенстве
        — у кого больше голосов). Голоса не удаляются, а вычитаются при подсчёте.
        Размер штрафа и минимум меток меняются в разделе «Рейтинг и титулы».
      </p>

      <h3 className="text-offwhite font-semibold mb-2">Эта неделя (метки по участницам)</h3>
      <div className="flex flex-col gap-2 mb-6">
        {current.length === 0 && <p className="text-muted text-sm">Меток пока нет.</p>}
        {current.map((c, i) => (
          <div key={i} className="bg-bgSurface border border-danger/40 rounded-xl p-3 flex justify-between">
            <div>
              <p className="text-muted text-xs">{c.region}</p>
              <p className="text-offwhite text-sm font-semibold">{c.name}</p>
            </div>
            <p className="text-danger font-semibold">🖤 {c.count}</p>
          </div>
        ))}
      </div>

      <h3 className="text-offwhite font-semibold mb-2">История штрафов</h3>
      <div className="flex flex-col gap-2">
        {history.length === 0 && <p className="text-muted text-sm">Штрафов ещё не было.</p>}
        {history.map((h, i) => (
          <div key={i} className="bg-bgSurface border border-muted rounded-xl p-3 flex justify-between">
            <div>
              <p className="text-muted text-xs">
                {h.region} · неделя с {h.week.split("-").reverse().join(".")}
              </p>
              <p className="text-offwhite text-sm font-semibold">{h.name}</p>
              <p className="text-muted text-xs">меток: {h.marks}</p>
            </div>
            <p className="text-danger font-semibold">−{h.penalty}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
