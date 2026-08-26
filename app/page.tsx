"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import LoadingScreen from "@/components/LoadingScreen";

type Participant = {
  id: string;
  display_name: string;
  photo_url: string | null;
  votes: number;
  gifts: number;
  followers: number;
  region_id: string | null;
};

function useSundayCountdown() {
  const [inWindow, setInWindow] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const now = new Date();
      const sunday = new Date(now);
      const day = sunday.getDay();
      const daysUntilSunday = (7 - day) % 7;
      sunday.setDate(sunday.getDate() + daysUntilSunday);
      sunday.setHours(23, 59, 59, 999);
      if (daysUntilSunday === 0 && now > sunday) {
        sunday.setDate(sunday.getDate() + 7);
      }
      const diff = sunday.getTime() - now.getTime();
      const threeHours = 3 * 60 * 60 * 1000;
      setInWindow(diff <= threeHours && diff > 0);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { inWindow, timeLeft };
}

type Season = { id: string; title: string; status: string };

const STATUS_LABELS: Record<string, string> = {
  draft: "Скоро старт",
  registration: "Регистрация открыта",
  week1: "Этап 1: Отбор",
  week2: "Этап 2: Спорт",
  week3: "Этап 3: Образ",
  final: "Финал",
  archived: "Сезон завершён",
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [scope, setScope] = useState<"region" | "country">("region");
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [contentCount, setContentCount] = useState(0);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setChecked(true);

      if (u.region_id) {
        const { data: seasonData } = await supabase
          .from("seasons")
          .select("id, title, status")
          .eq("region_id", u.region_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setSeason(seasonData as Season | null);
      }

      const { data: participantsData } = await supabase
        .from("participants")
        .select("id, display_name, photo_url, season_id")
        .eq("is_eliminated", false);

      const { data: seasonsData } = await supabase
        .from("seasons")
        .select("id, region_id");
      const seasonToRegion: Record<string, string> = {};
      (seasonsData ?? []).forEach((s: { id: string; region_id: string }) => {
        seasonToRegion[s.id] = s.region_id;
      });

      const { data: votesData } = await supabase.from("votes").select("participant_id");
      const counts: Record<string, number> = {};
      (votesData ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });

      const { data: giftsData } = await supabase
        .from("gifts")
        .select("participant_id, quantity");
      const giftCounts: Record<string, number> = {};
      (giftsData ?? []).forEach(
        (g: { participant_id: string; quantity: number }) => {
          giftCounts[g.participant_id] =
            (giftCounts[g.participant_id] ?? 0) + (g.quantity ?? 1);
        }
      );

      const { data: followsData } = await supabase
        .from("participant_follows")
        .select("participant_id");
      const followCounts: Record<string, number> = {};
      (followsData ?? []).forEach((f: { participant_id: string }) => {
        followCounts[f.participant_id] = (followCounts[f.participant_id] ?? 0) + 1;
      });

      const list = (participantsData ?? []).map(
        (p: {
          id: string;
          display_name: string;
          photo_url: string | null;
          season_id: string;
        }) => ({
          id: p.id,
          display_name: p.display_name,
          photo_url: p.photo_url,
          votes: counts[p.id] ?? 0,
          gifts: giftCounts[p.id] ?? 0,
          followers: followCounts[p.id] ?? 0,
          region_id: seasonToRegion[p.season_id] ?? null,
        })
      );
      setAllParticipants(list);

      const { count: usersCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true });
      setActiveUsersCount(usersCount ?? 0);

      const { count: postsCount } = await supabase
        .from("content_posts")
        .select("id", { count: "exact", head: true });
      setContentCount(postsCount ?? 0);
    })();
  }, [router]);

  const { inWindow, timeLeft } = useSundayCountdown();
  const prevOrderRef = useState<string[]>([])[0];
  const [risingIds, setRisingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!inWindow || !checked) return;

    const interval = setInterval(async () => {
      const { data: votesData } = await supabase.from("votes").select("participant_id");
      const counts: Record<string, number> = {};
      (votesData ?? []).forEach((v: { participant_id: string }) => {
        counts[v.participant_id] = (counts[v.participant_id] ?? 0) + 1;
      });
      setAllParticipants((prev) => {
        const updated = prev.map((p) => ({ ...p, votes: counts[p.id] ?? p.votes }));
        const newOrder = [...updated].sort((a, b) => b.votes - a.votes).map((p) => p.id);
        const rising = new Set<string>();
        newOrder.forEach((id, idx) => {
          const oldIdx = prevOrderRef.indexOf(id);
          if (oldIdx !== -1 && idx < oldIdx) rising.add(id);
        });
        if (rising.size > 0) {
          setRisingIds(rising);
          setTimeout(() => setRisingIds(new Set()), 2000);
        }
        prevOrderRef.length = 0;
        prevOrderRef.push(...newOrder);
        return updated;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [inWindow, checked]);

  if (!checked) return <LoadingScreen />;

  const filtered =
    scope === "region" && user?.region_id
      ? allParticipants.filter((p) => p.region_id === user.region_id)
      : allParticipants;
  const participants = [...filtered].sort((a, b) => b.votes - a.votes).slice(0, 5);
  const leaderPhoto = participants[0]?.photo_url;

  return (
    <main className="min-h-screen pb-28">
      <div
        className="flex items-center justify-between px-6 py-4 sticky top-0 z-40 bg-bgPrimary/95 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <Logo size={32} />
        <Link
          href="/hall-of-fame"
          className="text-gold text-xs font-semibold border border-gold/50 rounded-full px-3 py-1.5 whitespace-nowrap"
        >
          🏆 Зал славы
        </Link>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="px-6 mb-4 flex gap-2">
          <button
            onClick={() => setScope("region")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              scope === "region"
                ? "bg-gold text-bgPrimary"
                : "bg-bgSurface text-muted border border-muted"
            }`}
          >
            {user?.regions?.name ?? "Мой регион"}
          </button>
          <button
            onClick={() => setScope("country")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              scope === "country"
                ? "bg-gold text-bgPrimary"
                : "bg-bgSurface text-muted border border-muted"
            }`}
          >
            Вся страна
          </button>
        </div>

        <div
          className="mx-6 mb-6 rounded-2xl overflow-hidden relative min-h-[220px] md:min-h-[300px] flex flex-col justify-end p-5 md:p-8"
          style={{
            backgroundImage: leaderPhoto
              ? `linear-gradient(to top, rgba(11,11,13,0.95), rgba(11,11,13,0.3)), url(${leaderPhoto})`
              : "linear-gradient(135deg, #2a1f3d, #0B0B0D)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <p className="text-goldSoft text-xs tracking-widest mb-1">
            VETOKS MISS
          </p>
          <h1 className="text-2xl md:text-4xl font-semibold text-offwhite mb-1">
            {season?.title ?? user?.regions?.name ?? "Сезон скоро стартует"}
          </h1>
          <p className="text-muted text-sm mb-3">Красота. Харизма. Энергия.</p>
          {season?.status === "registration" ? (
            <Link
              href="/apply"
              className="inline-block w-fit bg-gold text-bgPrimary text-xs font-semibold px-4 py-2 rounded-full"
            >
              Регистрация открыта — подать анкету
            </Link>
          ) : (
            <span className="inline-block w-fit bg-bgSurface/80 text-gold text-xs px-3 py-1 rounded-full border border-gold/40">
              {season ? STATUS_LABELS[season.status] ?? season.status : "Скоро старт"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 mb-8">
          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-gold text-xl font-semibold">
              👑 {filtered.length}
            </p>
            <p className="text-muted text-xs">Участниц сезона</p>
          </div>
          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-gold text-xl font-semibold">
              👥 {activeUsersCount}
            </p>
            <p className="text-muted text-xs">Пользователей</p>
          </div>
          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-gold text-xl font-semibold">🎁 0</p>
            <p className="text-muted text-xs">Подарков сегодня</p>
          </div>
          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-gold text-xl font-semibold">🔥 {contentCount}</p>
            <p className="text-muted text-xs">Роликов в соцсетях</p>
          </div>
        </div>

        {inWindow && (
          <div className="mx-6 mb-4 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] rounded-xl p-4 text-center animate-pulse">
            <p className="text-white font-semibold text-sm">
              🔥 До отсева недели: {timeLeft}
            </p>
            <p className="text-white/80 text-xs mt-1">
              Рейтинг обновляется прямо сейчас — успейте поддержать!
            </p>
          </div>
        )}

        <div className="px-6 mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-offwhite">
            🔥 ТОП участниц дня
          </h2>
          <Link href="/top25" className="text-gold text-sm">
            Смотреть всех →
          </Link>
        </div>

        {participants.length === 0 ? (
          <p className="text-muted text-center px-6 mb-8">
            Пока нет одобренных участниц.
          </p>
        ) : (
          <div className="flex items-end justify-center gap-3 px-6 mb-8">
            {[participants[1], participants[0], participants[2]].map(
              (p, slot) => {
                if (!p) return <div key={slot} className="flex-1 max-w-[110px]" />;
                const isFirst = slot === 1;
                const isRising = risingIds.has(p.id);
                return (
                  <Link
                    href={`/participant/${p.id}`}
                    key={p.id}
                    className={`flex-1 max-w-[130px] bg-bgSurface border rounded-xl overflow-hidden transition-transform duration-500 ${
                      isFirst ? "border-gold" : "border-muted"
                    } ${isRising ? "scale-110 shadow-lg shadow-gold/50" : ""}`}
                    style={{ marginBottom: isFirst ? 0 : 16 }}
                  >
                    <div
                      className="bg-black/40 flex items-center justify-center relative aspect-[3/4]"
                      style={{ transform: isFirst ? "scale(1)" : "scale(0.92)" }}
                    >
                      {isRising && (
                        <span className="absolute -top-3 right-1 text-lg z-10">
                          🚀
                        </span>
                      )}
                      <span className="absolute top-1.5 left-1.5 text-lg">
                        {isFirst ? "👑" : slot === 0 ? "🥈" : "🥉"}
                      </span>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt={p.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-muted text-xs">Нет фото</span>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-offwhite text-xs font-semibold truncate">
                        {p.display_name}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-rose text-[10px]">♥ {p.votes}</p>
                        <p className="text-gold text-[10px]">🎁 {p.gifts}</p>
                        <p className="text-muted text-[10px]">👥 {p.followers}</p>
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        )}

        <div className="px-6 grid md:grid-cols-3 gap-3">
          <Link
            href="/media"
            className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-offwhite font-semibold">Смотри контент участниц</p>
              <p className="text-muted text-xs">Лучшие видео и закулисье сезона</p>
            </div>
            <span className="text-gold">→</span>
          </Link>
          <Link
            href="/shop"
            className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-offwhite font-semibold">Подарки участницам</p>
              <p className="text-muted text-xs">Поддержи любимую участницу</p>
            </div>
            <span className="text-gold">→</span>
          </Link>
          <Link
            href="/apply"
            className="border border-gold text-gold font-semibold px-8 py-3 rounded-full text-center hover:bg-bgSurface transition-colors flex items-center justify-center"
          >
            Подать анкету на участие
          </Link>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
