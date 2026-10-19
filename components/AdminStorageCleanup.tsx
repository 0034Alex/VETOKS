"use client";

import { useState } from "react";
import { apiPost } from "@/lib/authClient";

type Scan = { total: number; orphans: number; bytes: number; byBucket: Record<string, number>; sample: string[] };

const mb = (b: number) => (b / 1048576).toFixed(1) + " МБ";

// CRM → Безопасность: файлы в хранилище, на которые больше нет ссылок. Только главный админ.
export default function AdminStorageCleanup() {
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const [msg, setMsg] = useState("");
  const [word, setWord] = useState("");

  async function doScan() {
    setBusy(true);
    setMsg("");
    setScan(null);
    const r = await apiPost("/api/admin/storage-cleanup", { action: "scan" });
    if (r?.ok) setScan(r);
    else setMsg(r?.message || "Не получилось проверить. Нужны права главного админа.");
    setBusy(false);
  }

  async function doDelete() {
    setBusy(true);
    const r = await apiPost("/api/admin/storage-cleanup", { action: "delete", confirm: word });
    if (r?.ok) {
      setMsg(`Удалено файлов: ${r.deleted}, освобождено ${mb(r.bytes)}.`);
      setScan(null);
      setWord("");
    } else setMsg("Не получилось удалить.");
    setBusy(false);
  }

  return (
    <section className="bg-bgSurface border border-muted rounded-2xl p-4 mt-4">
      <p className="text-gold font-semibold mb-1">Чистка хранилища</p>
      <p className="text-muted text-xs mb-3">
        Ищет фото и файлы, которые загрузили, но нигде не используются (брошенные загрузки). Файлы младше 14 дней не трогаем. Удаление необратимо — сначала сделайте «Скачать копию».
      </p>
      <button onClick={doScan} disabled={busy} className="bg-gold text-bgPrimary px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50">
        {busy ? "Проверяем…" : "Проверить"}
      </button>
      {msg && <p className="text-offwhite text-sm mt-3">{msg}</p>}
      {scan && (
        <div className="mt-3 text-sm text-offwhite">
          <p>
            Всего файлов: {scan.total}. Лишних: <b>{scan.orphans}</b> ({mb(scan.bytes)}).
          </p>
          {Object.entries(scan.byBucket).map(([b, n]) => (
            <p key={b} className="text-muted text-xs">
              {b}: {n}
            </p>
          ))}
          {scan.sample.length > 0 && <p className="text-muted text-xs mt-2 break-all">Примеры: {scan.sample.slice(0, 5).join(", ")}</p>}
          {scan.orphans > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <input
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Введите: УДАЛИТЬ"
                className="bg-bgPrimary border border-muted rounded-lg px-3 py-1.5 text-sm text-offwhite w-44"
              />
              <button onClick={doDelete} disabled={busy || word !== "УДАЛИТЬ"} className="bg-danger text-bgPrimary px-4 py-1.5 rounded-full text-sm font-semibold disabled:opacity-40">
                Удалить лишнее
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
