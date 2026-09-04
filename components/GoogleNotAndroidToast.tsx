"use client";

export default function GoogleNotAndroidToast({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-10"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-[#1c1c1e] rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white text-sm leading-snug mb-3">
          Приложение уже установлено, либо откройте эту страницу в Chrome на
          Android для установки.
        </p>
        <div className="flex justify-end">
          <button onClick={onClose} className="text-[#3B9EFF] text-sm font-medium">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
