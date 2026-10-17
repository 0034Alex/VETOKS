"use client";

import { useState } from "react";
import ReportSheet from "@/components/ReportSheet";

// Кнопка «Пожаловаться» для колонки справа в ленте.
export default function ReportButton({ postId, loggedIn }: { postId: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          if (!loggedIn) {
            window.location.href = "/login";
            return;
          }
          setOpen(true);
        }}
        className="flex flex-col items-center"
      >
        <span className="text-white text-xl leading-none">⚑</span>
        <span className="text-white text-[10px] mt-0.5">Жалоба</span>
      </button>
      <ReportSheet open={open} onClose={() => setOpen(false)} target={{ type: "post", postId }} />
    </>
  );
}
