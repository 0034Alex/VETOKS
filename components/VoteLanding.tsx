"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";
import type { CardInfo } from "@/lib/cardInfo";

// Куда попадает друг по ссылке: если уже вошёл — сразу к участнице, иначе приглашаем зарегистрироваться.
export default function VoteLanding({ id, info }: { id: string; info: CardInfo | null }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(`/participant/${id}`);
      else setChecked(true);
    })();
  }, [id, router]);

  if (!checked) return <main className="min-h-screen" />;
  if (!info)
    return (
      <main className="min-h-screen flex items-center justify-center text-muted px-6 text-center">
        Эта страница недоступна.
      </main>
    );

  const next = encodeURIComponent(`/participant/${id}`);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
      <Logo size={44} />
      {info.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={info.photoUrl}
          alt=""
          className="w-56 h-72 object-cover rounded-3xl border-2 border-gold shadow-[0_10px_40px_rgba(201,162,39,.25)]"
        />
      )}
      <div>
        <h1 className="text-2xl font-semibold text-offwhite">{info.name}</h1>
        {info.rank ? (
          <p className="text-gold mt-1">
            №{info.rank} · {info.region}
          </p>
        ) : null}
      </div>
      <Link
        href={`/login?redirect=${next}`}
        className="w-full max-w-xs h-[54px] rounded-full font-semibold flex items-center justify-center text-[#1a1405] bg-gradient-to-b from-[#F1DE98] via-[#C9A227] to-[#b08d1c]"
      >
        Проголосовать за меня
      </Link>
      <Link href="/register" className="text-muted text-sm underline">
        Ещё нет аккаунта? Зарегистрироваться
      </Link>
    </main>
  );
}
