"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

// Первое касание по ссылке-приглашению: сотрудник придумывает пароль.
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/staff-invite/info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then((r) => (r.ok ? setEmail(r.email) : setBad(true)))
      .catch(() => setBad(true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p1.length < 8) return setErr("Пароль — не короче 8 символов.");
    if (p1 !== p2) return setErr("Пароли не совпадают.");
    setBusy(true);
    setErr("");
    const r = await fetch("/api/staff-invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: p1 }) }).then((x) => x.json());
    if (!r.ok) {
      setBusy(false);
      return setErr(r.error === "bad_link" ? "Ссылка устарела. Попросите новую." : "Не получилось. Попробуйте ещё раз.");
    }
    const l = await fetch("/api/auth/password-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: r.email, password: p1 }) }).then((x) => x.json());
    if (l.status === "ok") {
      await supabase.auth.setSession({ access_token: l.access_token, refresh_token: l.refresh_token });
      router.replace("/admin");
    } else router.replace("/admin/login");
  }

  if (bad)
    return (
      <main className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-gold text-xl font-semibold mb-2">Ссылка не работает</h1>
          <p className="text-muted text-sm">Она устарела, уже использована или отменена. Попросите владельца прислать новую.</p>
        </div>
      </main>
    );
  if (!email) return <main className="min-h-screen flex items-center justify-center text-muted">Проверяем ссылку...</main>;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-bgSurface border border-muted rounded-2xl p-6 flex flex-col gap-3">
        <h1 className="text-gold text-xl font-semibold text-center">Добро пожаловать в VETOKS CRM</h1>
        <p className="text-muted text-sm text-center">Почта: <b className="text-offwhite">{email}</b><br />Придумайте пароль для входа.</p>
        <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Пароль (от 8 символов)" autoComplete="new-password" className="bg-bgPrimary text-offwhite border border-muted rounded-xl px-4 py-3" />
        <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} placeholder="Повторите пароль" autoComplete="new-password" className="bg-bgPrimary text-offwhite border border-muted rounded-xl px-4 py-3" />
        {err && <p className="text-danger text-sm">{err}</p>}
        <button disabled={busy} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50">
          {busy ? "Сохраняем..." : "Сохранить и войти"}
        </button>
      </form>
    </main>
  );
}
