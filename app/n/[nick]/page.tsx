"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";

// Ссылка по нику: vetoks/n/anna. Открывает профиль участницы или человека.
export default function NickLanding() {
  const { nick } = useParams<{ nick: string }>();
  const router = useRouter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace(`/login?redirect=/n/${encodeURIComponent(String(nick))}`);
        return;
      }
      const r = await apiPost("/api/profile/resolve", { nick });
      if (!r?.ok) {
        setMissing(true);
        return;
      }
      if (r.userId === data.user.id) router.replace("/profile");
      else if (r.participantId) router.replace(`/participant/${r.participantId}`);
      else router.replace(`/u/${r.userId}`);
    })();
  }, [nick, router]);

  if (!missing) return <LoadingScreen />;
  return (
    <main className="min-h-screen flex items-center justify-center text-muted">
      Профиль с таким ником не найден.
    </main>
  );
}
