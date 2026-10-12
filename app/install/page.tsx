"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Env = "telegram" | "ios-safari" | "ios-other" | "android" | "other";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [env, setEnv] = useState<Env>("other");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const tg = !!(window as any).Telegram?.WebApp?.initData;
    const ios = /iPad|iPhone|iPod/.test(ua);
    const safari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    if (tg) setEnv("telegram");
    else if (ios) setEnv(safari ? "ios-safari" : "ios-other");
    else if (/android/i.test(ua)) setEnv("android");
    else setEnv("other");

    setInstalled(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  function openOutside() {
    const url = window.location.origin + "/install";
    const wa = (window as any).Telegram?.WebApp;
    if (wa?.openLink) wa.openLink(url);
    else window.open(url, "_blank");
  }

  const Steps = ({ items }: { items: string[] }) => (
    <ol className="text-muted text-sm flex flex-col gap-2 list-decimal pl-4">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ol>
  );

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-3xl mx-auto">
        <PageHeader />
        <div className="px-6">
          <h1 className="text-2xl font-semibold text-offwhite mb-6">Установить приложение</h1>

          {installed && (
            <div className="bg-bgSurface border border-gold/40 rounded-xl p-5 mb-4">
              <p className="text-offwhite text-sm">✓ Приложение уже установлено на этом устройстве.</p>
            </div>
          )}

          <div className="bg-bgSurface border border-gold/40 rounded-xl p-5 mb-4">
            {env === "telegram" && (
              <>
                <p className="text-offwhite font-semibold mb-2">Вы открыли VETOKS внутри Telegram</p>
                <p className="text-muted text-sm mb-3">Установить приложение можно только из обычного браузера — откройте сайт там.</p>
                <button onClick={openOutside} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">
                  Открыть в браузере
                </button>
              </>
            )}

            {env === "ios-safari" && (
              <>
                <p className="text-offwhite font-semibold mb-3">🍎 iPhone — Safari</p>
                <Steps items={[
                  "Нажмите «Поделиться» (квадрат со стрелкой вверх) внизу экрана",
                  "Пролистайте вниз и выберите «На экран «Домой»»",
                  "Нажмите «Добавить» в правом верхнем углу",
                ]} />
              </>
            )}

            {env === "ios-other" && (
              <>
                <p className="text-offwhite font-semibold mb-3">🍎 iPhone</p>
                <p className="text-muted text-sm mb-3">
                  На iPhone приложение устанавливается только из Safari. Скопируйте адрес сайта и откройте его в Safari, затем нажмите «Поделиться» → «На экран «Домой»».
                </p>
                <button
                  onClick={() => navigator.clipboard?.writeText(window.location.origin)}
                  className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm"
                >
                  Скопировать адрес сайта
                </button>
              </>
            )}

            {env === "android" && (
              <>
                <p className="text-offwhite font-semibold mb-3">🤖 Android — Chrome</p>
                {deferredPrompt ? (
                  <button onClick={install} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">
                    Установить приложение
                  </button>
                ) : (
                  <Steps items={[
                    "Откройте сайт в Chrome",
                    "Нажмите меню (⋮) справа вверху",
                    "Выберите «Установить приложение» или «Добавить на главный экран»",
                  ]} />
                )}
              </>
            )}

            {env === "other" && (
              <>
                <p className="text-offwhite font-semibold mb-3">💻 Компьютер</p>
                {deferredPrompt ? (
                  <button onClick={install} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">
                    Установить приложение
                  </button>
                ) : (
                  <p className="text-muted text-sm">
                    В Chrome или Edge нажмите значок установки в адресной строке. На телефоне откройте эту страницу — подскажем, что делать.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
