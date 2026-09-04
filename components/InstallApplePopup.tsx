"use client";

export default function InstallApplePopup({ onClose }: { onClose: () => void }) {
  function openInSafari() {
    const url = window.location.origin + "/profile";
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-sm relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-2xl leading-none text-gray-400"
        >
          ✕
        </button>
        <h2 className="text-black text-xl font-bold mb-5 pr-8">
          Установка на iPhone
        </h2>

        <button
          onClick={openInSafari}
          className="w-full bg-[#7C3AED] text-white font-semibold py-4 rounded-2xl text-base mb-4 flex items-center justify-center gap-2"
        >
          🌐 Открыть в Safari
        </button>

        <p className="text-gray-500 text-xs mb-5 leading-snug">
          Если вы сейчас в Telegram — сначала откройте сайт в Safari, иначе
          кнопка «Поделиться» не сработает
        </p>

        <div className="flex items-start gap-3 py-3 border-t border-gray-100">
          <span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm flex items-center justify-center flex-shrink-0 font-semibold">
            1
          </span>
          <p className="text-black text-sm leading-snug">
            Нажмите на значок{" "}
            <span className="font-bold">«Поделиться»</span> внизу экрана
            Safari <span className="ml-1">⬆️</span>
          </p>
        </div>

        <div className="flex items-start gap-3 py-3 border-t border-gray-100">
          <span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm flex items-center justify-center flex-shrink-0 font-semibold">
            2
          </span>
          <p className="text-black text-sm leading-snug">
            Выберите <span className="font-bold">«На экран Домой»</span> в
            списке, который появится
          </p>
        </div>

        <div className="flex items-start gap-3 py-3 border-t border-gray-100">
          <span className="w-7 h-7 rounded-full bg-[#7C3AED] text-white text-sm flex items-center justify-center flex-shrink-0 font-semibold">
            3
          </span>
          <p className="text-black text-sm leading-snug">
            Нажмите <span className="font-bold">«Добавить»</span> — готово!
          </p>
        </div>

        <p className="text-gray-400 text-[11px] mt-4 leading-snug">
          Это ограничение самого Apple — сайты не могут открыть это меню
          автоматически.
        </p>
      </div>
    </div>
  );
}
