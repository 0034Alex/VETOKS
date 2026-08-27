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
type Stage = {
  stage_number: number;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Скоро старт",
  registration: "Регистрация открыта",
  week1: "Этап 1: Отбор",
  week2: "Этап 2: Спорт",
  week3: "Этап 3: Образ",
  final: "Финал",
  archived: "Сезон завершён",
};

type MagazinePage = {
  kind: "participant";
  id: string;
  display_name: string;
  photo_url: string | null;
  dream: string | null;
  motto: string | null;
  fun_fact: string | null;
} | {
  kind: "ad";
  id: string;
  image_url: string;
  button_text: string;
  button_link: string;
};

function Magazine() {
  const [pages, setPages] = useState<MagazinePage[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: participantsData } = await supabase
        .from("participants")
        .select("id, display_name, photo_url, magazine_answers(dream, motto, fun_fact)")
        .eq("is_eliminated", false);

      const { data: adsData } = await supabase
        .from("magazine_ads")
        .select("id, image_url, button_text, button_link")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const participantPages: MagazinePage[] = (participantsData ?? []).map(
        (p: any) => ({
          kind: "participant",
          id: p.id,
          display_name: p.display_name,
          photo_url: p.photo_url,
          dream: p.magazine_answers?.[0]?.dream ?? p.magazine_answers?.dream ?? null,
          motto: p.magazine_answers?.[0]?.motto ?? p.magazine_answers?.motto ?? null,
          fun_fact: p.magazine_answers?.[0]?.fun_fact ?? p.magazine_answers?.fun_fact ?? null,
        })
      );

      const ads: MagazinePage[] = (adsData ?? []).map((a: any) => ({
        kind: "ad",
        id: a.id,
        image_url: a.image_url,
        button_text: a.button_text,
        button_link: a.button_link,
      }));

      // Каждая 10-я страница — реклама (по кругу, если реклам несколько).
      const merged: MagazinePage[] = [];
      let adIndex = 0;
      participantPages.forEach((p, i) => {
        merged.push(p);
        if ((i + 1) % 10 === 0 && ads.length > 0) {
          merged.push(ads[adIndex % ads.length]);
          adIndex++;
        }
      });
      setPages(merged);

      const u = await getCurrentUser();
      if (u) {
        setUserId(u.id);
        const { data: followsData } = await supabase
          .from("participant_follows")
          .select("participant_id")
          .eq("user_id", u.id);
        setFollowedIds(
          new Set((followsData ?? []).map((f: { participant_id: string }) => f.participant_id))
        );
      }

      setLoading(false);
    })();
  }, []);

  async function toggleFollow(participantId: string) {
    if (!userId) return;
    if (followedIds.has(participantId)) {
      await supabase
        .from("participant_follows")
        .delete()
        .eq("participant_id", participantId)
        .eq("user_id", userId);
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    } else {
      await supabase.from("participant_follows").insert({ participant_id: participantId, user_id: userId });
      setFollowedIds((prev) => new Set(prev).add(participantId));
    }
  }

  if (loading || pages.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-offwhite px-6 mb-3">
        📖 Журнал VETOKS
      </h2>
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-6 pb-2">
        {pages.map((page) => (
          <div
            key={`${page.kind}-${page.id}`}
            className="snap-center flex-shrink-0 w-[260px] bg-bgSurface border border-gold/30 rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}
          >
            {page.kind === "ad" ? (
              <a href={page.button_link} target="_blank" rel="noopener noreferrer">
                <div className="aspect-[3/4] bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={page.image_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <span className="block text-center bg-gold text-bgPrimary font-semibold py-2 rounded-full text-sm">
                    {page.button_text}
                  </span>
                </div>
              </a>
            ) : (
              <>
                <div className="aspect-[3/4] bg-black/40">
                  {page.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={page.photo_url} alt={page.display_name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-gold font-semibold mb-2">{page.display_name}</p>
                  {page.dream && (
                    <p className="text-offwhite text-xs mb-1">
                      <span className="text-muted">Мечта: </span>
                      {page.dream}
                    </p>
                  )}
                  {page.motto && (
                    <p className="text-offwhite text-xs mb-1">
                      <span className="text-muted">Девиз: </span>
                      {page.motto}
                    </p>
                  )}
                  {page.fun_fact && (
                    <p className="text-offwhite text-xs mb-3">
                      <span className="text-muted">Факт: </span>
                      {page.fun_fact}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => toggleFollow(page.id)}
                      disabled={!userId}
                      className={`flex-1 text-xs font-semibold py-2 rounded-full ${
                        followedIds.has(page.id)
                          ? "bg-bgPrimary border border-muted text-muted"
                          : "bg-gold text-bgPrimary"
                      }`}
                    >
                      {followedIds.has(page.id) ? "Вы подписаны" : "Подписаться"}
                    </button>
                    <Link
                      href={`/participant/${page.id}`}
                      className="flex-1 text-xs font-semibold py-2 rounded-full bg-bgPrimary border border-gold text-gold text-center"
                    >
                      Профиль
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Survey() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "survey_question")
        .maybeSingle();
      setQuestion(data?.value ?? "");
      setLoading(false);
    })();
  }, []);

  async function submit() {
    if (!answer.trim()) return;
    const u = await getCurrentUser();
    if (!u) return;
    await supabase.from("survey_answers").insert({
      user_id: u.id,
      question,
      answer,
    });
    setSent(true);
  }

  if (loading || !question) return null;

  return (
    <div className="px-6 mb-8">
      <div className="bg-gradient-to-br from-[#7C3AED]/20 to-[#EC4899]/20 border border-gold/30 rounded-2xl p-5">
        <p className="text-gold text-xs tracking-widest mb-2">ОПРОС</p>
        <h3 className="text-offwhite font-semibold text-lg mb-4">{question}</h3>
        {sent ? (
          <p className="text-success text-sm">Спасибо за ответ!</p>
        ) : (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="Ваш ответ..."
              className="w-full bg-bgPrimary text-offwhite border border-muted rounded-lg px-4 py-3 mb-3"
            />
            <button
              onClick={submit}
              disabled={!answer.trim()}
              className="bg-gold text-bgPrimary font-semibold px-6 py-2 rounded-full text-sm disabled:opacity-40"
            >
              Отправить
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [season, setSeason] = useState<Season | null>(null);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [totalStages, setTotalStages] = useState(0);
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

        if (seasonData) {
          const { data: stagesData } = await supabase
            .from("season_stages")
            .select("stage_number, title, starts_at, ends_at")
            .eq("season_id", (seasonData as Season).id)
            .order("stage_number", { ascending: true });
          setTotalStages((stagesData ?? []).length);
          const now = new Date();
          const current = (stagesData ?? []).find(
            (s: Stage) => s.ends_at && new Date(s.ends_at) > now
          );
          setCurrentStage((current as Stage) ?? null);
        }
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

  let stageProgress = 0;
  let stageCountdown = "—";
  if (currentStage?.starts_at && currentStage?.ends_at) {
    const start = new Date(currentStage.starts_at).getTime();
    const end = new Date(currentStage.ends_at).getTime();
    const now = Date.now();
    stageProgress = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
    const diff = Math.max(0, end - now);
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    stageCountdown = days > 0 ? `${days} дня ${hours} часов` : `${hours} часов`;
  }

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
            Мой регион
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
          className="mx-6 mb-6 rounded-2xl overflow-hidden relative flex flex-col justify-end p-5 md:p-8 min-h-[260px] md:min-h-[320px]"
          style={{
            backgroundImage: leaderPhoto
              ? `linear-gradient(to top, rgba(11,11,13,0.97), rgba(11,11,13,0.4)), url(${leaderPhoto})`
              : "linear-gradient(135deg, #2a1f3d, #0B0B0D)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Link
            href="/promo"
            className="absolute top-4 right-4 flex items-center gap-2 bg-bgPrimary/80 rounded-full pl-2 pr-3 py-1.5"
          >
            <span className="w-6 h-6 rounded-full bg-gold text-bgPrimary flex items-center justify-center text-[10px]">
              ▶
            </span>
            <span className="text-offwhite text-xs font-semibold">Промо</span>
          </Link>

          <p className="text-goldSoft text-xs tracking-widest mb-1">
            VETOKS MISS
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-offwhite mb-1 leading-tight">
            {scope === "country" ? "Россия" : user?.regions?.name ?? "Сезон скоро стартует"}
          </h1>
          <p className="text-muted text-sm mb-4">Красота. Харизма. Энергия.</p>

          {currentStage && totalStages > 0 ? (
            <div className="bg-bgPrimary/80 backdrop-blur rounded-xl p-3">
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-offwhite text-xs font-semibold whitespace-nowrap">
                  Этап {currentStage.stage_number} из {totalStages}
                </span>
                <span className="text-muted text-xs truncate">{currentStage.title}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-[#7C3AED] to-gold rounded-full h-2"
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
              <p className="text-offwhite text-xs">
                🕐 До окончания этапа: <span className="font-semibold">{stageCountdown}</span>
              </p>
            </div>
          ) : (
            <span className="inline-block w-fit bg-bgSurface/80 text-gold text-xs px-3 py-1 rounded-full border border-gold/40">
              {season ? STATUS_LABELS[season.status] ?? season.status : "Скоро старт"}
            </span>
          )}
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

        <Magazine />

        {season?.status === "registration" && (
          <div className="px-6 mb-8">
            <Link
              href="/apply"
              className="flex items-center justify-center gap-2 bg-gold text-bgPrimary rounded-full py-3 w-full font-semibold text-sm"
            >
              📝 Подать заявку на участие
            </Link>
          </div>
        )}

        <div className="px-6 grid md:grid-cols-2 gap-3 mb-8">
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
        </div>

        <Survey />
      </div>

      <BottomNav />
    </main>
  );
}
