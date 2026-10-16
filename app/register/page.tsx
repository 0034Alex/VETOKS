"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getInitData, openSession, postJson } from "@/lib/authClient";
import TelegramLoginButton from "@/components/TelegramLoginButton";
import { useT } from "@/lib/i18n";
import { langsForCountry } from "@/lib/langs";

type Region = { id: string; name: string; country_id?: string | null };

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const loginToken = search.get("tg") || "";

  const [initData, setInitData] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [countryCodes, setCountryCodes] = useState<Record<string, string>>({});
  const { setLang } = useT();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [regionId, setRegionId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [agreed, setAgreed] = useState(false);

  // Регистрация «через Telegram»: внутри мини-приложения или после
  // подтверждения в боте (ссылка ?tg=...).
  const tgMode = !!initData || !!loginToken;

  useEffect(() => {
    const d = getInitData();
    setInitData(d);
    if (d) {
      try {
        const u = JSON.parse(new URLSearchParams(d).get("user") || "{}");
        if (u.first_name) setFirstName(u.first_name);
      } catch {}
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Показываем регионы только включённой сейчас страны (см. CRM →
      // «Страны и регионы»).
      const { data: enabledCountries } = await supabase
        .from("countries")
        .select("id, code")
        .eq("enabled", true);
      const countryIds = (enabledCountries ?? []).map((c: { id: string }) => c.id);
      const codes: Record<string, string> = {};
      (enabledCountries ?? []).forEach((c: any) => (codes[c.id] = c.code));
      setCountryCodes(codes);

      let query = supabase.from("regions").select("id, name, country_id").order("name");
      if (countryIds.length > 0) {
        query = query.in("country_id", countryIds);
      }
      const { data } = await query;
      if (data) setRegions(data as Region[]);
    })();
  }, []);

  function validateCommon(): string {
    if (!firstName.trim()) return "Введите имя.";
    if (!regionId) return "Выберите регион.";
    if (!agreed) return "Нужно принять пользовательское соглашение и публичную оферту.";
    return "";
  }

  async function handleTelegramSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    const err = validateCommon();
    if (err) return setErrorMessage(err);

    setStatus("loading");
    const r = await postJson("/api/auth/tg-register", {
      initData,
      loginToken,
      firstName,
      regionId,
      agreed,
    });
    if (r.status !== "ok" || !(await openSession(r.token_hash))) {
      setStatus("error");
      setErrorMessage(r.message || "Не удалось зарегистрироваться.");
      return;
    }
    router.replace("/welcome");
    router.refresh();
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    const err = validateCommon();
    if (err) return setErrorMessage(err);
    if (password.length < 6) return setErrorMessage("Пароль должен быть не короче 6 символов.");
    if (password !== passwordConfirm) return setErrorMessage("Пароли не совпадают.");

    setStatus("loading");

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
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

    // Номер и Telegram привяжутся позже — при подтверждении номера.
    const { error: insertError } = await supabase.from("users").insert({
      id: signUpData.user.id,
      first_name: firstName.trim(),
      email: email.trim(),
      region_id: regionId,
      role: "viewer",
    });

    if (insertError) {
      setStatus("error");
      setErrorMessage(insertError.message);
      return;
    }

    router.push("/welcome");
  }

  const regionSelect = (
    <div>
      <label className="text-offwhite text-sm">Регион</label>
      <select
        data-tr
        value={regionId}
        onChange={(e) => {
          setRegionId(e.target.value);
          const rg = regions.find((r) => r.id === e.target.value);
          const code = rg?.country_id ? countryCodes[rg.country_id] : null;
          if (code) setLang(langsForCountry(code)[0]);
        }}
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
  );

  const nameInput = (
    <div>
      <label className="text-offwhite text-sm">Имя</label>
      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className="w-full bg-bgSurface text-offwhite border border-muted rounded-lg px-4 py-3 mt-1"
        required
      />
    </div>
  );

  const consent = (
    <label className="flex items-start gap-2 text-xs text-muted mt-1">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        className="mt-0.5"
      />
      <span>
        Я принимаю{" "}
        <Link href="/legal/offer" className="text-gold underline">
          пользовательское соглашение и публичную оферту
        </Link>
      </span>
    </label>
  );

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-3xl font-semibold text-gold mb-2">Регистрация</h1>
      <p className="text-muted mb-6 text-sm">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-gold underline">
          Войти
        </Link>
      </p>

      {tgMode ? (
        <form
          onSubmit={handleTelegramSubmit}
          className="w-full max-w-sm flex flex-col gap-3 text-left"
        >
          <p className="text-offwhite text-sm text-center mb-1">
            Telegram подтверждён ✅ Осталось выбрать регион.
          </p>
          {nameInput}
          {regionSelect}
          {consent}
          <button
            type="submit"
            disabled={status === "loading" || !agreed}
            className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
          >
            {status === "loading" ? "Регистрируем..." : "Зарегистрироваться"}
          </button>
          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
        </form>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-3 text-left">
          <TelegramLoginButton label="Зарегистрироваться через Telegram" />
          <p className="text-muted text-xs text-center my-1">или по почте</p>

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            {nameInput}
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
            {regionSelect}
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
            {consent}
            <button
              type="submit"
              disabled={status === "loading" || !agreed}
              className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full mt-2 disabled:opacity-50"
            >
              {status === "loading" ? "Регистрируем..." : "Зарегистрироваться"}
            </button>
            {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
          </form>
          <p className="text-muted text-xs text-center">
            Номер телефона подтверждается после входа — одной кнопкой в Telegram.
          </p>
        </div>
      )}
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
