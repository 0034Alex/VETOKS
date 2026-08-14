"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import BottomNav from "@/components/BottomNav";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/register");
        return;
      }
      setUser(u);
      setChecked(true);
    })();
  }, [router]);

  if (!checked) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted">
        Загрузка...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 pb-24 flex flex-col items-center">
      <h1 className="text-4xl font-semibold text-gold mb-2 text-center">
        VETOKS
      </h1>
      <p className="text-muted mb-1 text-center">
        Привет, {user?.first_name}!
      </p>
      <p className="text-muted mb-10 text-center">
        Ваш регион: {user?.regions?.name ?? "—"}
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/participants"
          className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full text-center hover:bg-goldSoft transition-colors"
        >
          Смотреть участниц
        </Link>
        <Link
          href="/apply"
          className="border border-gold text-gold font-semibold px-8 py-3 rounded-full text-center hover:bg-bgSurface transition-colors"
        >
          Подать анкету
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
