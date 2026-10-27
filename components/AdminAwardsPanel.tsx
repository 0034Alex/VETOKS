"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

type Show = { key: string; title: string };
type Award = { id: string; season: string; nomination: string; participantId: string; name: string; photo: string | null };
type Found = { id: string; name: string; photo: string | null };

export default function AdminAwardsPanel() {
  const [shows, setShows] = useState<Show[]>([]);
  const [showKey, setShowKey] = useState("");
  const [items, setItems] = useState<Award[]>([]);
  const [season, setSeason] = useState("Сезон 1");
  const [nomination, setNomination] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [pick, setPick] = useState<Found | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiPost("/api/admin/shows", { action: "list" }).then((r) => {
      const l: Show[] = (r?.items ?? []).map((s: any) => ({ key: s.key, title: s.title }));
      setShows(l);
      if (l[0]) setShowKey(l[0].key);
    });
  }, []);

  async function load(k: string) {
    if (!k) return;
    const r = await apiPost("/api/admin/awards", { action: "list", showKey: k });
    setItems(r?.items ?? []);
  }
  useEffect(() => {
    load(showKey);
  }, [showKey]);

  async function search(v: string) {
    setQ(v);
    setPick(null);
    if (v.trim().length < 2) return setFound([]);
    const r = await apiPost("/api/admin/awards", { action: "find", q: v });
    setFound(r?.items ?? []);
  }

  async function add() {
    const r = await apiPost("/api/admin/awards", { action: "add", showKey, season, nomination, participantId: pick?.id });
    if (!r?.ok) return flash(r?.message || "Не получилось.");
    setPick(null);
    setQ("");
    setFound([]);
    flash("Добавлено!");
    load(showKey);
  }
  async function remove(id: string) {
    await apiPost("/api/admin/awards", { action: "remove", id });
    load(showKey);
  }
  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 2500);
  }

  const noms = Array.from(new Set(items.map((i) => i.nomination)));
  const inp = "bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm w-full";
  const bySeason: Record<string, Award[]> = {};
  items.forEach((i) => (bySeason[i.season] = [...(bySeason[i.season] ?? []), i]));

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <p className="text-muted text-xs">
        Здесь вы вносите победителей вручную: название номинации придумываете сами (например «Мисс зрительских симпатий»). Они появятся в «Зале славы» в разделе этого шоу и сезона.
      </p>
      {msg && <p className="text-success text-sm">{msg}</p>}

      <div className="bg-bgSurface border border-gold/40 rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-muted">
            Шоу
            <select className={inp} value={showKey} onChange={(e) => setShowKey(e.target.value)}>
              {shows.map((s) => (
                <option key={s.key} value={s.key}>{s.title}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Сезон
            <input className={inp} value={season} onChange={(e) => setSeason(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Номинация
            <input className={inp} list="noms" value={nomination} onChange={(e) => setNomination(e.target.value)} placeholder="Мисс зрительских симпатий" />
            <datalist id="noms">
              {noms.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
        </div>
        <label className="text-xs text-muted">
          Победительница (найти по имени)
          <input className={inp} value={pick ? pick.name : q} onChange={(e) => search(e.target.value)} placeholder="Начните вводить имя" />
        </label>
        {!pick &&
          found.map((p) => (
            <button key={p.id} onClick={() => setPick(p)} className="flex items-center gap-3 text-left bg-bgPrimary border border-muted/50 rounded-lg px-3 py-2">
              <span className="w-8 h-8 rounded-full overflow-hidden bg-black/40 flex-none">
                {p.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                )}
              </span>
              <span className="text-offwhite text-sm">{p.name}</span>
            </button>
          ))}
        <button onClick={add} disabled={!pick || !nomination.trim()} className="self-start bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm disabled:opacity-40">
          Добавить победительницу
        </button>
      </div>

      {Object.keys(bySeason).length === 0 && <p className="text-muted text-sm">Пока никого не внесено.</p>}
      {Object.entries(bySeason).map(([s, list]) => (
        <div key={s} className="bg-bgSurface border border-muted/50 rounded-xl p-4">
          <p className="text-gold font-semibold mb-2">{s}</p>
          {list.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2 border-b border-muted/20 last:border-0">
              <span className="flex-1 min-w-0">
                <span className="block text-offwhite text-sm truncate">{a.name}</span>
                <span className="block text-muted text-xs">{a.nomination}</span>
              </span>
              <button onClick={() => remove(a.id)} className="text-danger text-xs">Убрать</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
