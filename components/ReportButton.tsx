"use client";

import { useState } from "react";
import ReportSheet from "@/components/ReportSheet";

// Три точки на публикации: открывают «Пожаловаться».
export default function ReportButton({ postId, loggedIn }: { postId: string; loggedIn: boolean }) {
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setMenu(true)} className="flex flex-col items-center" aria-label="Меню">
        <span className="text-white text-2xl leading-none">⋯</span>
      </button>
      {menu && (
        <div className="fixed inset-0 z-[95] bg-black/60 flex items-end justify-center" onClick={() => setMenu(false)}>
          <div className="w-full max-w-md bg-bgSurface rounded-t-3xl px-5 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pb-3">
              <span className="w-10 h-1 rounded-full bg-white/25" />
            </div>
            <button
              onClick={() => {
                setMenu(false);
                if (!loggedIn) window.location.href = "/login";
                else setOpen(true);
              }}
              className="w-full text-left text-danger py-3 text-[15px] font-semibold"
            >
              Пожаловаться
            </button>
            <button onClick={() => setMenu(false)} className="w-full text-left text-offwhite py-3 text-[15px] border-t border-muted/30">
              Отмена
            </button>
          </div>
        </div>
      )}
      <ReportSheet open={open} onClose={() => setOpen(false)} target={{ type: "post", postId }} />
    </>
  );
}
