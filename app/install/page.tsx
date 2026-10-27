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

  const [copiedLink, setCopiedLink] = useState(false);
  function openSafari() {
    const url = window.location.origin + "/install";
    const wa = (window as any).Telegram?.WebApp;
    if (wa?.openLink) {
      wa.openLink(url);
      return;
    }
    window.location.href = "x-safari-" + url;
    setTimeout(async () => {
      if (document.visibilityState === "visible") {
        try { await navigator.clipboard?.writeText(url); } catch {}
        setCopiedLink(true);
      }
    }, 1500);
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
            {(env === "ios-safari" || env === "ios-other" || (env === "telegram" && /iPad|iPhone|iPod/.test(typeof navigator !== "undefined" ? navigator.userAgent : ""))) && (
              <>
                <p className="text-offwhite font-semibold text-lg mb-4">Установка на iPhone</p>
                {env !== "ios-safari" && (
                  <>
                    <button onClick={openSafari} className="w-full bg-gold text-bgPrimary font-semibold py-3.5 rounded-2xl text-base">
                      🌐 Открыть в Safari
                    </button>
                    <p className="text-muted text-xs mt-2 mb-4">
                      Если вы сейчас в Telegram — сначала откройте сайт в Safari, иначе кнопка «Поделиться» не сработает.
                    </p>
                    {copiedLink && <p className="text-goldSoft text-xs mb-4">Ссылка скопирована — вставьте её в адресную строку Safari.</p>}
                  </>
                )}
                <div className="flex flex-col divide-y divide-muted/30">
                  <div className="flex items-center gap-3 py-4">
                    <span className="w-8 h-8 rounded-full bg-gold text-bgPrimary font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <p className="text-offwhite text-sm flex-1">Нажмите на значок «Поделиться» внизу экрана Safari</p>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-gold))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" /></svg>
                  </div>
                  <div className="flex items-center gap-3 py-4">
                    <span className="w-8 h-8 rounded-full bg-gold text-bgPrimary font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <p className="text-offwhite text-sm flex-1">Выберите «На экран «Домой»» в появившемся списке</p>
                  </div>
                  <div className="flex items-center gap-3 py-4">
                    <span className="w-8 h-8 rounded-full bg-gold text-bgPrimary font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <p className="text-offwhite text-sm flex-1">Нажмите «Добавить» — готово!</p>
                  </div>
                </div>
                <p className="text-muted text-xs mt-3">Это ограничение самого Apple — сайты не могут открыть это меню автоматически.</p>
              </>
            )}

            {env === "telegram" && !/iPad|iPhone|iPod/.test(typeof navigator !== "undefined" ? navigator.userAgent : "") && (
              <>
                <p className="text-offwhite font-semibold mb-2">Вы открыли VETOKS внутри Telegram</p>
                <p className="text-muted text-sm mb-3">Установить приложение можно только из обычного браузера — откройте сайт там.</p>
                <button onClick={openOutside} className="w-full bg-gold text-bgPrimary font-semibold py-3 rounded-full text-sm">
                  Открыть в браузере
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
