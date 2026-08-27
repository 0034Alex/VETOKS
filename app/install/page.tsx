"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsSafari(/^((?!chrome|android|crios|fxios).)*safari/i.test(ua));

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function installAndroid() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function openInSafari() {
    window.location.href = window.location.href.replace(/^https?:\/\//, "https://");
  }

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-offwhite mb-6">
          Установить приложение
        </h1>

        <div className="bg-bgSurface border border-gold/40 rounded-xl p-5 mb-4">
          <p className="text-offwhite font-semibold mb-3">🍎 На iPhone (Safari)</p>
          {!isSafari && (
            <button
              onClick={openInSafari}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm mb-3"
            >
              Открыть в Safari
            </button>
          )}
          <ol className="text-muted text-sm flex flex-col gap-2 list-decimal pl-4">
            <li>Откройте сайт именно в браузере Safari (не в Chrome)</li>
            <li>Нажмите кнопку «Поделиться» (квадрат со стрелкой вверх) внизу экрана</li>
            <li>Пролистайте вниз и выберите «На экран «Домой»»</li>
            <li>Нажмите «Добавить» в правом верхнем углу</li>
          </ol>
        </div>

        <div className="bg-bgSurface border border-gold/40 rounded-xl p-5">
          <p className="text-offwhite font-semibold mb-3">🤖 На Android</p>
          {deferredPrompt ? (
            <button
              onClick={installAndroid}
              className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm"
            >
              Установить на Android
            </button>
          ) : (
            <p className="text-muted text-sm">
              Откройте сайт в Chrome — в адресной строке или в меню (⋮) появится
              пункт «Установить приложение».
            </p>
          )}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
