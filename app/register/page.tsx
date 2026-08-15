"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Region = { id: string; name: string };

export default function RegisterPage() {
  const router = useRouter();
  const [regions, setRegions] = useState<Region[]>([]);
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [regionId, setRegionId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    supabase
      .from("regions")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        if (data) setRegions(data as Region[]);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < 6) {
      setErrorMessage("Пароль должен быть не короче 6 символов.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMessage("Пароли не совпадают.");
      return;
    }
    if (!regionId) {
      setErrorMessage("Выберите регион.");
      return;
    }

    setStatus("loading");

    const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError || !signUpData.user) {
      setStatus("error");
      setErrorMessage(
        signUpError?.message === "User already registered"
          ? "Такая почта уже зарегистрирована — войдите вместо регистрации."
          : signUpError?.message ?? "Не удалось зарегистрироваться."
      );
      return;
    }

    const { error: insertError } = await supabase.from("users").insert({
      id: signUpData.user.id,
      first_name: firstName,
      phone,
      email,
      region_id: regionId,
      telegram_id: tgId,
      role: "viewer",
    });

    if (insertError) {
      setStatus("error");
      setErrorMessage(insertError.message);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Регистрация</h1>
      <p className="text-muted mb-6 text-sm">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-gold underline">
          Войти
        </Link>
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-3 text-left"
      >
        <div>
          <label className="text-offwhite text-sm">Имя</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <div>
          <label className="text-offwhite text-sm">Телефон</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 900 000 00 00"
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <div>
          <label className="text-offwhite text-sm">Почта</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <div>
          <label className="text-offwhite text-sm">Регион</label>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          >
            <option value="" disabled>
              — выберите —
            </option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-offwhite text-sm">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <div>
          <label className="text-offwhite text-sm">Повторите пароль</label>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
            required
          />
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
        >
          {status === "loading" ? "Регистрируем..." : "Зарегистрироваться"}
        </button>

        {errorMessage && (
          <p className="text-danger text-sm">{errorMessage}</p>
        )}
      </form>
    </main>
  );
}
