"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { applyOpen, useRecruit } from "@/lib/useShow";

const p2 = (n: number) => String(n).padStart(2, "0");

// Плашка на главной: «Открыт набор анкет на следующее шоу». Данные берутся из CRM → «Шоу».
// Пока идёт одно шоу, здесь зовут подать анкету на следующее. Исчезает, когда приём закрыт или шоу началось.
export default function RecruitBanner() {
  const r = useRecruit();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!r || !applyOpen(r.banner)) return null;
  const bn = r.banner;
  const to = bn.apply_until ? new Date(bn.apply_until).getTime() : r.startsAt ? new Date(r.startsAt).getTime() : null;
  const s = to ? Math.max(0, Math.floor((to - now) / 1000)) : null;

  async function share() {
    const url = `${window.location.origin}/apply`;
    const text = `${bn.title || r!.title}: открыт набор анкет. Подай свою!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: bn.title || r!.title, text, url });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div
      className="mx-6 mb-4 rounded-2xl overflow-hidden border border-gold/40 p-4 relative"
      style={{
        background: bn.image
          ? `linear-gradient(180deg, rgb(var(--c-bg) / 0.35), rgb(var(--c-bg) / 0.92)), url(${bn.image}) center/cover`
          : "linear-gradient(135deg, rgb(var(--c-surface)), rgb(var(--c-bg)))",
      }}
    >
      <p className="text-goldSoft text-[11px] tracking-widest font-semibold">ОТКРЫТ НАБОР АНКЕТ</p>
      <h2 className="text-xl font-bold text-offwhite leading-tight mt-1">{bn.title || r.title}</h2>
      {bn.subtitle && <p className="text-offwhite/80 text-xs mt-1">{bn.subtitle}</p>}
      {s !== null && s > 0 && (
        <p className="text-muted text-xs mt-2 tabular-nums">
          До конца приёма: {Math.floor(s / 86400)} д {p2(Math.floor((s % 86400) / 3600))}:{p2(Math.floor((s % 3600) / 60))}:{p2(s % 60)}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <Link href="/apply" className="vt-glow flex-1 text-center bg-gold text-bgPrimary rounded-full py-2.5 font-semibold text-sm">
          Подать анкету
        </Link>
        <button onClick={share} className="px-4 rounded-full border border-gold/50 text-gold text-sm font-semibold">
          {copied ? "Скопировано" : "Поделиться"}
        </button>
      </div>
    </div>
  );
}
