"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import { getCurrentUser } from "@/lib/currentUser";
import BirthField from "@/components/BirthField";

const HIDE_ON = ["/login", "/register", "/forgot-password", "/reset-password", "/admin", "/legal", "/welcome"];
const SKIP_KEY = "vt_birth_skip";

// Для тех, кто зарегистрировался раньше: просим указать дату рождения,
// чтобы определить возрастную категорию. Пока не укажут — остаются в MISS.
export default function BirthPopup() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [birth, setBirth] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      try {
        if (sessionStorage.getItem(SKIP_KEY) === "1") return;
      } catch {}
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const u = await getCurrentUser();
      if (cancelled || !u || u.birth_date) return;
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [hidden, pathname]);

  async function save() {
    if (!birth || busy) return;
    setBusy(true);
    setMsg("");
    const r = await apiPost("/api/profile/birth", { birth_date: birth });
    setBusy(false);
    if (r?.ok) {
      setOpen(false);
      window.location.reload();
    } else setMsg(r?.message || "Не получилось сохранить. Попробуйте ещё раз.");
  }

  function later() {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {}
    setOpen(false);
  }

  if (!open || hidden) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-bgSurface border border-gold/40 rounded-2xl p-5">
        <h2 className="text-gold font-semibold text-lg mb-1">Укажите дату рождения</h2>
        <p className="text-muted text-xs mb-4">
          В VETOKS три возрастные категории: TEEN 15–17, MISS 18–29, LADY 30+. По дате мы определим вашу. Пока она не указана, вы в категории MISS.
        </p>
        <BirthField onChange={setBirth} />
        {msg && <p className="text-danger text-sm mt-2">{msg}</p>}
        <div className="flex items-center justify-between mt-4">
          <button onClick={later} className="text-muted text-sm min-h-[44px] px-2">
            Позже
          </button>
          <button
            onClick={save}
            disabled={!birth || busy}
            className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm disabled:opacity-40"
          >
            {busy ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
