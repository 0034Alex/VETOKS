"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, isStaff } from "@/lib/currentUser";

// Вход в CRM: только почта и пароль.
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/auth/password-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email.trim(), password }),
    });
    const r = await res.json().catch(() => ({}));
    if (r.status !== "ok") {
      setBusy(false);
      setErr("Неверная почта или пароль.");
      return;
    }
    await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    const u = await getCurrentUser();
    if (!isStaff(u)) {
      await supabase.auth.signOut();
      setBusy(false);
      setErr("У этой почты нет доступа в CRM.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-bgSurface border border-muted rounded-2xl p-6 flex flex-col gap-3">
        <h1 className="text-gold text-xl font-semibold text-center tracking-widest">VETOKS CRM</h1>
        <p className="text-muted text-sm text-center mb-2">Вход для сотрудников</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Почта"
          autoComplete="username"
          required
          className="bg-bgPrimary text-offwhite border border-muted rounded-xl px-4 py-3"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoComplete="current-password"
          required
          className="bg-bgPrimary text-offwhite border border-muted rounded-xl px-4 py-3"
        />
        {err && <p className="text-danger text-sm">{err}</p>}
        <button disabled={busy} className="bg-gold text-bgPrimary font-semibold py-3 rounded-full disabled:opacity-50">
          {busy ? "Входим..." : "Войти"}
        </button>
        <p className="text-muted text-xs text-center">Забыли пароль? Попросите владельца прислать новую ссылку.</p>
      </form>
    </main>
  );
}
