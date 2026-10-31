"use client";

import { useEffect } from "react";

// Если страница профиля «упала» при переходе между аккаунтами, один раз перезагружаем её сами.
export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("vetoks_profile_reload")) {
        sessionStorage.setItem("vetoks_profile_reload", "1");
        window.location.reload();
        return;
      }
      sessionStorage.removeItem("vetoks_profile_reload");
    } catch {}
  }, []);
  return (
    <main className="min-h-screen bg-bgPrimary flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-offwhite">Не удалось открыть страницу.</p>
      <button onClick={() => { reset(); window.location.reload(); }} className="bg-gold text-bgPrimary font-semibold rounded-full px-6 py-2.5 text-sm">Обновить</button>
    </main>
  );
}
