"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTeenOpen } from "@/lib/teenFlag";
import { DEFAULT_AUDIENCE } from "@/lib/adAudience";

const OPTS: [string, string][] = [
  ["teen", "TEEN"],
  ["main", "MISS"],
  ["adult", "LADY"],
];

// CRM: для кого показывать рекламу (у места — для кого оно и опубликованная из него реклама). Нажали на категорию — сохранилось сразу.
export default function AdAudience({ table, id }: { table: "promo_banners" | "magazine_ads" | "partner_logos" | "ad_slots"; id: string }) {
  const [val, setVal] = useState<string[] | null>(null);
  const teenOpen = useTeenOpen();

  useEffect(() => {
    supabase
      .from(table)
      .select("audience")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setVal(((data as any)?.audience as string[] | null) ?? DEFAULT_AUDIENCE));
  }, [table, id]);

  async function toggle(k: string) {
    if (!val) return;
    const next = val.includes(k) ? val.filter((x) => x !== k) : [...val, k];
    if (next.length === 0) return; // реклама должна показываться хотя бы кому-то
    setVal(next);
    await supabase.from(table).update({ audience: next }).eq("id", id);
  }

  if (!val) return null;
  return (
    <div className="flex items-center gap-1 mt-2 flex-wrap">
      <span className="text-muted text-[10px] mr-1">Показывать:</span>
      {OPTS.filter(([k]) => k !== "teen" || teenOpen).map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => toggle(k)}
          className={`text-[10px] px-2 py-1 rounded-full border ${
            val.includes(k) ? "border-gold text-gold bg-gold/10" : "border-muted text-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
