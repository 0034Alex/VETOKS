"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// «Моя анкета» объединена с «Мой профиль»: фото, имя и «о себе» теперь в одном месте.
export default function MyApplicationRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/edit-profile");
  }, [router]);
  return null;
}
