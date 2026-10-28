"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry } from "@/lib/crmCountry";

const BLOCKS: [string, string, string][] = [
  ["recruit", "Баннер набора анкет", "Виден только когда набор на другое шоу открыт: отсчёт и кнопка «Подать анкету»."],
  ["hall", "Зал славы", "10 победительниц Гранд-финала страны, каждую можно открыть."],
  ["question", "Вопрос недели", "Люди пишут ответ текстом. Ответы видите только вы, ниже."],
  ["ads", "Рекламные баннеры", "Баннеры из раздела «Баннеры»."],
];

// Страница «Между шоу»: что видят люди страны, когда шоу не идёт.
export default function AdminBetweenPanel() {
  const cid = getCrmCountry();
  const [mode, setMode] = useState("auto");
  const [off, setOff] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ id: string; name: string; region: string; question: string; answer: string; at: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [noTable, setNoTable] = useState(false);

  async function load() {
    if (!cid) return;
    const r = await apiPost("/api/admin/between", { action: "get", country_id: cid });
    if (!r?.ok) return setMsg(r?.message || "Не получилось загрузить.");
    setMode(r.mode);
    setOff(r.off ?? []);
    setQuestion(r.question ?? "");
    setAnswers(r.answers ?? []);
    setNoTable(!!r.noTable);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);
  async function save() {
    const r = await apiPost("/api/admin/between", { action: "save", country_id: cid, mode, off, question });
    setMsg(r?.ok ? "Сохранено." : r?.message || "Не получилось.");
    setTimeout(() => setMsg(""), 2500);
  }
  if (!cid) return <p className="text-muted text-sm">Выберите страну вверху CRM.</p>;
  const inp = "w-full bg-bgPrimary border border-muted/60 rounded-lg px-2.5 py-2 text-base text-offwhite min-w-0";
  return (
    <div className="space-y-3">
      {noTable && <p className="text-sm text-red-300">Таблица ответов не создана: выполните SQL из чата, иначе вопрос недели работать не будет.</p>}
      <label className="text-[11px] text-muted block space-y-1">
        Режим
        <select className={inp} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="auto">Включается сам, когда в стране нет идущего шоу</option>
          <option value="on">Всегда включена</option>
          <option value="off">Выключена</option>
        </select>
      </label>
      {BLOCKS.map(([k, label, note]) => (
        <div key={k} className="border border-muted/40 rounded-xl p-2.5">
          <label className="flex items-center gap-2 text-sm text-offwhite">
            <input type="checkbox" checked={!off.includes(k)} onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== k) : [...off, k])} />
            {label}
          </label>
          <p className="text-[11px] text-muted mt-1">{note}</p>
          {k === "question" && !off.includes("question") && (
            <textarea className={`${inp} mt-2 min-h-[60px]`} placeholder="Например: Какой конкурс вы хотите увидеть следующим?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          )}
        </div>
      ))}
      <button className="px-4 py-2 rounded-lg bg-gold text-black text-sm font-semibold" onClick={save}>
        Сохранить
      </button>
      {msg && <span className="text-xs text-gold ml-2">{msg}</span>}
      <div>
        <p className="text-sm font-semibold text-offwhite mb-2">Ответы людей ({answers.length})</p>
        {answers.length === 0 && <p className="text-xs text-muted">Пока нет ответов.</p>}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {answers.map((a) => (
            <div key={a.id} className="border border-muted/40 rounded-xl p-2.5">
              <p className="text-sm text-offwhite whitespace-pre-wrap">{a.answer}</p>
              <p className="text-[11px] text-muted mt-1">
                {a.name}
                {a.region ? ` · ${a.region}` : ""} · {new Date(a.at).toLocaleString("ru-RU")}
              </p>
              <p className="text-[10px] text-muted">Вопрос: {a.question}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
