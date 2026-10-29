"use client";

import { useEffect, useState } from "react";

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

// Дата рождения тремя списками: день, месяц, год. Отдаёт «ГГГГ-ММ-ДД» или пустую строку.
export default function BirthField({ onChange }: { onChange: (v: string) => void }) {
  const [d, setD] = useState("");
  const [m, setM] = useState("");
  const [y, setY] = useState("");
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let i = thisYear; i >= thisYear - 90; i--) years.push(i);

  // Черновик: после чтения документов и возврата дата остаётся на месте.
  useEffect(() => {
    try {
      const j = JSON.parse(sessionStorage.getItem("vt_birth_draft") || "{}");
      if (j.d) setD(String(j.d));
      if (j.m) setM(String(j.m));
      if (j.y) setY(String(j.y));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (d || m || y) sessionStorage.setItem("vt_birth_draft", JSON.stringify({ d, m, y }));
    } catch {}
  }, [d, m, y]);
  const tooYoung = !!(d && m && y) && thisYear - Number(y) < 15 && (() => {
    const bd = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const now = new Date();
    let age = now.getUTCFullYear() - bd.getUTCFullYear();
    if (now.getUTCMonth() < bd.getUTCMonth() || (now.getUTCMonth() === bd.getUTCMonth() && now.getUTCDate() < bd.getUTCDate())) age -= 1;
    return age < 15;
  })();

  useEffect(() => {
    if (d && m && y) onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    else onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, m, y]);

  const cls = "bg-bgSurface text-offwhite border border-muted rounded-lg px-3 py-3 mt-1 w-full";
  return (
    <div>
      <label className="text-offwhite text-sm">Дата рождения</label>
      <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
        <select value={d} onChange={(e) => setD(e.target.value)} className={cls} aria-label="День">
          <option value="">День</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
        <select value={m} onChange={(e) => setM(e.target.value)} className={cls} aria-label="Месяц">
          <option value="">Месяц</option>
          {MONTHS.map((n, i) => (
            <option key={n} value={String(i + 1)}>
              {n}
            </option>
          ))}
        </select>
        <select value={y} onChange={(e) => setY(e.target.value)} className={cls} aria-label="Год">
          <option value="">Год</option>
          {years.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {tooYoung && <p className="text-danger text-xs mt-1">Сервис доступен с 15 лет.</p>}
      <p className="text-muted text-[11px] mt-1">Нужна, чтобы определить вашу категорию. Изменить её потом можно только через поддержку.</p>
    </div>
  );
}
