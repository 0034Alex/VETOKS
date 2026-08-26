"use client";

import { useRouter } from "next/navigation";
import Logo from "./Logo";

export default function PageHeader() {
  const router = useRouter();

  return (
    <div
      className="flex items-center px-4 py-4 relative"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <button
        onClick={() => router.back()}
        className="text-offwhite text-xl w-8 flex-shrink-0"
        aria-label="Назад"
      >
        ←
      </button>
      <div className="flex-1 flex justify-center">
        <Logo size={28} />
      </div>
      <div className="w-8 flex-shrink-0" />
    </div>
  );
}
