"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DEFAULT_LANGS, readyLangsForCountry, Lang } from "@/lib/langs";

let cached: Lang[] | null = null;

/** Языки, доступные пользователю по стране его региона. */
export function useCountryLangs(): Lang[] {
  const [langs, setLangs] = useState<Lang[]>(cached ?? DEFAULT_LANGS);
  useEffect(() => {
    if (cached) return;
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const { data: u } = await supabase.from("users").select("region_id").eq("id", data.user.id).maybeSingle();
        if (!u?.region_id) return;
        const { data: rg } = await supabase.from("regions").select("country_id").eq("id", u.region_id).maybeSingle();
        if (!rg?.country_id) return;
        const { data: c } = await supabase.from("countries").select("code").eq("id", rg.country_id).maybeSingle();
        const l = readyLangsForCountry(c?.code);
        cached = l;
        if (!off) setLangs(l);
      } catch {}
    })();
    return () => {
      off = true;
    };
  }, []);
  return langs;
}
