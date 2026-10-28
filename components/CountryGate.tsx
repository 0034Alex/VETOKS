"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useT } from "@/lib/i18n";
import { readyLangsForCountry } from "@/lib/langs";

const ISO =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ MR MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WS YE ZA ZM ZW".split(
    " "
  );

export const COUNTRY_KEY = "vt_country";

// Первое касание с сайта: страна обязательна. Из Telegram (бот страны) и для вошедших не показывается.
export default function CountryGate() {
  const pathname = usePathname() || "/";
  const { lang, setLang } = useT();
  const [show, setShow] = useState(false);
  const [enabled, setEnabled] = useState<{ id: string; code: string }[]>([]);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/legal")) return;
    let off = false;
    (async () => {
      try {
        if ((window as any).Telegram?.WebApp?.initData) return;
        if (localStorage.getItem(COUNTRY_KEY)) return;
      } catch {}
      const { data } = await supabase.auth.getSession();
      if (off || data.session) return;
      const { data: cs } = await supabase.from("countries").select("id, code").eq("enabled", true);
      if (off) return;
      setEnabled(((cs ?? []) as any[]).map((c) => ({ id: c.id as string, code: String(c.code ?? "").toUpperCase() })));
      try {
        const g = await fetch("/api/geo").then((r) => r.json());
        if (g?.code && ISO.includes(g.code)) setCode(g.code);
      } catch {}
      setShow(true);
    })();
    return () => {
      off = true;
    };
  }, [pathname]);

  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([lang], { type: "region" });
    } catch {}
    return ISO.map((c) => ({ code: c, name: dn?.of(c) ?? c })).sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [lang]);

  if (!show) return null;
  const hit = enabled.find((c) => c.code === code);

  function go() {
    if (!hit) return;
    try {
      localStorage.setItem(COUNTRY_KEY, hit.id);
      localStorage.setItem(COUNTRY_KEY + "_code", hit.code);
    } catch {}
    const allowed = readyLangsForCountry(hit.code);
    if (!allowed.includes(lang)) setLang(allowed[0]);
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-bgPrimary flex items-center justify-center px-4 overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="w-full max-w-sm flex flex-col gap-4 py-8">
        <p className="text-gold tracking-[0.3em] text-sm text-center">VETOKS</p>
        <h1 className="text-offwhite text-xl font-semibold text-center">Выберите вашу страну</h1>
        <p className="text-muted text-sm text-center">Это нужно, чтобы показать шоу и язык вашей страны.</p>
        <select
          id="country-gate"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 text-base"
        >
          <option value="" disabled>
            — выберите страну —
          </option>
          {names.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {code && !hit ? (
          <div className="text-center">
            <div style={{ fontSize: 72, lineHeight: 1 }}>🙈</div>
            <p className="text-offwhite mt-3">VETOKS пока нет в вашей стране.</p>
          </div>
        ) : (
          <button onClick={go} disabled={!hit} className="w-full bg-gold text-bgPrimary font-semibold rounded-full py-3 disabled:opacity-40">
            Продолжить
          </button>
        )}
      </div>
    </div>
  );
}
