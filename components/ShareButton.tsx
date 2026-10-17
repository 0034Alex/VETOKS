"use client";

import { useState } from "react";
import ShareSheet from "@/components/ShareSheet";

// Кнопка «Поделиться» в колонке справа: открывает окно с людьми внутри приложения и другими приложениями.
export default function ShareButton({ postId, children }: { postId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex flex-col items-center">
        {children}
      </button>
      <ShareSheet open={open} onClose={() => setOpen(false)} postId={postId} />
    </>
  );
}
