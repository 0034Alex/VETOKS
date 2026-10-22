"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Отдельной анкеты «Стать партнёром» больше нет: всё через рекламный кабинет.
export default function PartnerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/ad-space");
  }, [router]);
  return null;
}
