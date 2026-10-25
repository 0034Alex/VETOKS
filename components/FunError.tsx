"use client";

import { useEffect, useState } from "react";

const TXT: Record<string, [string, string, string]> = {
  uk: ["Ой, щось зламалося", "Наш додаток на секунду заплющив очі. Таке буває навіть з королевами. Спробуємо ще раз?", "Перезавантажити"],
  ru: ["Ой, что-то сломалось", "Наше приложение на секунду закрыло глаза. Такое бывает даже с королевами. Попробуем ещё раз?", "Перезагрузить"],
  en: ["Oops, something broke", "Our app just closed its eyes for a second. It happens even to queens. Shall we try again?", "Reload"],
};

// Весёлая страница ошибки. Только inline-стили: работает и когда не загрузились общие стили.
export default function FunError({ info, onReload }: { info?: string; onReload?: () => void }) {
  const [lang, setLang] = useState("uk");
  useEffect(() => {
    try {
      const l = localStorage.getItem("vt_lang");
      if (l && TXT[l]) setLang(l);
    } catch {}
  }, []);
  const [h, p, b] = TXT[lang];
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 14, padding: "40px 24px", background: "radial-gradient(120% 70% at 50% 0%, #2a2110 0%, #0d0d0f 60%)", color: "#f5f5f2", fontFamily: "system-ui, sans-serif" }}>
      <style>{"@keyframes vtbob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}}@media (prefers-reduced-motion:reduce){.vtbob{animation:none!important}}"}</style>
      <div className="vtbob" style={{ fontSize: 84, lineHeight: 1, animation: "vtbob 2.4s ease-in-out infinite" }}>🙈</div>
      <h1 style={{ margin: 0, fontSize: 24, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600 }}>{h}</h1>
      <p style={{ margin: 0, color: "#8b8b93", fontSize: 14, lineHeight: 1.5, maxWidth: 300 }}>{p}</p>
      <button
        onClick={() => (onReload ? onReload() : window.location.reload())}
        style={{ marginTop: 8, background: "#c9a227", color: "#000", border: 0, borderRadius: 999, padding: "13px 34px", fontSize: 15, fontWeight: 700, width: "100%", maxWidth: 300 }}
      >
        {b}
      </button>
      {info && <div style={{ fontSize: 10, color: "#666", marginTop: 10, maxWidth: 300, wordBreak: "break-word" }}>{info}</div>}
    </div>
  );
}
