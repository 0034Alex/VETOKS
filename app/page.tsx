"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getCurrentUser, CurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import PartnersShowcase from "@/components/PartnersShowcase";
import LoadingScreen from "@/components/LoadingScreen";
import EntryPopup from "@/components/EntryPopup";

// Настоящий 3D-переворот страниц — библиотека работает только в браузере,
// поэтому подключаем её динамически, без серверной отрисовки.
const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false }) as any;

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
  banner_image_url: string | null;
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

type MagazinePage =
  | {
      kind: "photo";
      id: string;
      display_name: string;
      photo_url: string | null;
    }
  | {
      kind: "text";
      id: string;
      display_name: string;
      q1_question: string | null;
      q1_answer: string | null;
      q2_question: string | null;
      q2_answer: string | null;
      q3_question: string | null;
      q3_answer: string | null;
    }
  | {
      kind: "ad_text";
      id: string;
      description: string | null;
      button_text: string;
      button_link: string;
    }
  | {
      kind: "ad_photo";
      id: string;
      image_url: string;
    };

function Magazine({ scope, userRegionId }: { scope: "region" | "country"; userRegionId: string | null }) {
  const [pages, setPages] = useState<MagazinePage[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: participantsData } = await supabase
        .from("participants")
        .select(
          "id, display_name, photo_url, region_id, magazine_answers(q1_question, q1_answer, q2_question, q2_answer, q3_question, q3_answer)"
        )
        .eq("is_eliminated", false);

      const filteredParticipants =
        scope === "region" && userRegionId
          ? (participantsData ?? []).filter((p: any) => p.region_id === userRegionId)
          : participantsData ?? [];

      // Перемешиваем порядок при каждом открытии — чтобы при повторном
      // заходе журнал показывал участниц в новом случайном порядке.
      for (let i = filteredParticipants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filteredParticipants[i], filteredParticipants[j]] = [
          filteredParticipants[j],
          filteredParticipants[i],
        ];
      }

      const { data: adsData } = await supabase
        .from("magazine_ads")
        .select("id, image_url, description, button_text, button_link")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const ads = adsData ?? [];

      // Каждая участница — разворот: текст (левая страница) + фото (правая).
      // Каждый 10-й разворот — реклама, тем же принципом: слева текст с
      // кнопкой-ссылкой, справа лого/фото в такой же рамке. Если реклам
      // нет — просто идут дальше участницы без пропусков.
      const merged: MagazinePage[] = [];
      let adIndex = 0;
      filteredParticipants.forEach((p: any) => {
        const ans = Array.isArray(p.magazine_answers)
          ? p.magazine_answers[0]
          : p.magazine_answers;

        merged.push({
          kind: "text",
          id: p.id,
          display_name: p.display_name,
          q1_question: ans?.q1_question ?? null,
          q1_answer: ans?.q1_answer ?? null,
          q2_question: ans?.q2_question ?? null,
          q2_answer: ans?.q2_answer ?? null,
          q3_question: ans?.q3_question ?? null,
          q3_answer: ans?.q3_answer ?? null,
        });
        merged.push({ kind: "photo", id: p.id, display_name: p.display_name, photo_url: p.photo_url });

        if (merged.length % 20 === 0 && ads.length > 0) {
          const ad: any = ads[adIndex % ads.length];
          merged.push({
            kind: "ad_text",
            id: `${ad.id}-l`,
            description: ad.description,
            button_text: ad.button_text,
            button_link: ad.button_link,
          });
          merged.push({ kind: "ad_photo", id: `${ad.id}-r`, image_url: ad.image_url });
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
  }, [scope, userRegionId]);

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
      <div className="flex justify-center px-4">
        <div className="relative" style={{ width: "100%", maxWidth: 360 }}>
          {/* Кулисы «толщины» книги — каскад слоёв позади разворота */}
          <div
            className="absolute rounded-lg"
            style={{
              inset: "10px -6px -10px -6px",
              background: "#e4ddc9",
              boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
            }}
          />
          <div
            className="absolute rounded-lg"
            style={{
              inset: "6px -3px -6px -3px",
              background: "#eee6d2",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
            }}
          />

          <HTMLFlipBook
            key={`${scope}-${pages.length}-${pages[0]?.id ?? "x"}`}
            width={150}
            height={230}
            size="stretch"
            minWidth={140}
            maxWidth={220}
            minHeight={210}
            maxHeight={340}
            showCover={false}
            drawShadow={true}
            maxShadowOpacity={0.4}
            mobileScrollSupport={true}
            className="vetoks-magazine relative"
            style={{ margin: "0 auto" }}
          >
            {pages.map((page) => {
            if (page.kind === "ad_text") {
              return (
                <div
                  key={`adtext-${page.id}`}
                  className="relative rounded-l-lg"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#F0EBDD",
                    boxShadow: "inset -18px 0 18px -18px rgba(0,0,0,0.5)",
                    borderRight: "2px solid rgba(0,0,0,0.3)",
                    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                    transform: "translateZ(0)",
                  }}
                >
                  <div
                    className="px-3.5 pt-3"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 12 }}
                  >
                    <p className="text-[#B23A5C] text-[6px] tracking-[0.2em] font-semibold mb-1">
                      РЕКЛАМА
                    </p>
                    <h4
                      className="text-[#1a1520] text-sm italic mb-2 pb-1"
                      style={{
                        fontFamily: "Georgia, 'Times New Roman', serif",
                        borderBottom: "1px solid #ddd6c8",
                      }}
                    >
                      Партнёр VETOKS
                    </h4>
                    {page.description && (
                      <p
                        className="text-[#2b2530] text-[9px] leading-[1.4] mb-3"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        {page.description}
                      </p>
                    )}
                    <a
                      href={page.button_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        width: "fit-content",
                        backgroundColor: "#1a1520",
                        color: "#F3EEE4",
                        fontWeight: 600,
                        padding: "8px 14px",
                        borderRadius: 999,
                        fontSize: 10,
                      }}
                    >
                      {page.button_text}
                    </a>
                  </div>
                </div>
              );
            }

            if (page.kind === "ad_photo") {
              return (
                <div
                  key={`adphoto-${page.id}`}
                  className="relative rounded-r-lg"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#F0EBDD",
                    boxShadow: "inset 18px 0 18px -18px rgba(0,0,0,0.5)",
                    borderLeft: "2px solid rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 12,
                      bottom: 14,
                      left: 12,
                      border: "1px solid #C9A227",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.image_url}
                      alt=""
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                </div>
              );
            }

            if (page.kind === "photo") {
              return (
                <div
                  key={`photo-${page.id}`}
                  className="relative rounded-r-lg"
                  style={{
                    width: "100%",
                    height: "100%",
                    backgroundColor: "#F0EBDD",
                    boxShadow: "inset 18px 0 18px -18px rgba(0,0,0,0.5)",
                    borderLeft: "2px solid rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 12,
                      bottom: 14,
                      left: 12,
                      border: "1px solid #C9A227",
                      overflow: "hidden",
                    }}
                  >
                    {page.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.photo_url}
                        alt={page.display_name}
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ width: "100%", height: "100%", backgroundColor: "#F0EBDD" }}
                      >
                        <span
                          className="select-none"
                          style={{
                            fontFamily: "Georgia, 'Times New Roman', serif",
                            fontSize: 40,
                            lineHeight: 1,
                            color: "#C9A227",
                            opacity: 0.35,
                          }}
                        >
                          V
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Текстовая страница — журнальный диалог «В: / О:»
            const qaList = [
              { q: page.q1_question, a: page.q1_answer },
              { q: page.q2_question, a: page.q2_answer },
              { q: page.q3_question, a: page.q3_answer },
            ].filter((qa) => qa.q && qa.a);

            return (
              <div
                key={`text-${page.id}`}
                className="relative rounded-l-lg"
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#F0EBDD",
                  boxShadow: "inset -18px 0 18px -18px rgba(0,0,0,0.5)",
                  borderRight: "2px solid rgba(0,0,0,0.3)",
                  WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                  transform: "translateZ(0)",
                }}
              >
                <div
                  className="overflow-y-auto px-3.5 pt-3"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 56,
                    touchAction: "pan-y",
                  }}
                >
                  <p className="text-[#B23A5C] text-[6px] tracking-[0.2em] font-semibold mb-1">
                    ИНТЕРВЬЮ
                  </p>
                  <h4
                    className="text-[#1a1520] text-sm italic mb-1.5 pb-1"
                    style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      borderBottom: "1px solid #ddd6c8",
                    }}
                  >
                    {page.display_name}
                  </h4>

                  {qaList.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      {qaList.map((qa, i) => (
                        <p
                          key={i}
                          className="text-[#2b2530] text-[9px] leading-[1.3]"
                          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                        >
                          <span className="text-[#B23A5C] text-[7px] tracking-[0.1em] font-bold uppercase">
                            В:{" "}
                          </span>
                          <span className="italic text-[#5a5260] text-[8px]">{qa.q}</span>
                          <br />
                          <span className="text-[#7C3AED] text-[7px] tracking-[0.1em] font-bold uppercase">
                            О:{" "}
                          </span>
                          {qa.a}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-4">
                      <span className="text-[#C9A227] text-base mb-1.5">✦</span>
                      <p
                        className="text-[#5a5260] text-[11px] italic"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        Страница в процессе наполнения...
                      </p>
                    </div>
                  )}
                </div>

                <div
                  className="flex gap-1.5 px-3.5"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 12,
                    height: 44,
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => toggleFollow(page.id)}
                    disabled={!userId}
                    className={`flex-1 text-[8px] font-semibold py-1.5 px-1 rounded-full leading-tight ${
                      followedIds.has(page.id)
                        ? "bg-white border border-[#c9c2b4] text-[#5a5260]"
                        : "bg-[#1a1520] text-[#F3EEE4]"
                    }`}
                  >
                    {followedIds.has(page.id) ? "Подписаны" : "Подписаться"}
                  </button>
                  <Link
                    href={`/participant/${page.id}`}
                    className="flex-1 text-[8px] font-semibold py-1.5 px-1 rounded-full border border-[#1a1520] text-[#1a1520] text-center leading-tight"
                  >
                    Профиль
                  </Link>
                </div>
              </div>
            );
          })}
        </HTMLFlipBook>
        </div>
      </div>
      <p className="text-muted text-xs text-center mt-2">
        Потяните за угол страницы, чтобы перелистнуть
      </p>
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
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Ваш ответ..."
              className="w-full bg-bgPrimary text-offwhite border border-muted rounded-lg px-4 py-2.5 mb-3"
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
  const [isParticipant, setIsParticipant] = useState(false);
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

      const { data: myParticipant } = await supabase
        .from("participants")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      setIsParticipant(!!myParticipant);

      // Один общий национальный сезон и общие этапы — одинаковые для всей
      // страны одновременно, регион здесь ни на что не влияет.
      const { data: seasonData } = await supabase
        .from("seasons")
        .select("id, title, status")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSeason(seasonData as Season | null);

      if (seasonData) {
        const { data: stagesData } = await supabase
          .from("season_stages")
          .select("stage_number, title, starts_at, ends_at, banner_image_url")
          .eq("season_id", (seasonData as Season).id)
          .order("stage_number", { ascending: true });
        setTotalStages((stagesData ?? []).length);
        const now = new Date();
        // Этап без даты окончания или с датой в будущем считается текущим —
        // иначе, если дату не заполнили, баннер вообще ничего не покажет.
        const current =
          (stagesData ?? []).find(
            (s: Stage) => s.ends_at && new Date(s.ends_at) > now
          ) ?? (stagesData ?? []).find((s: Stage) => !s.ends_at) ?? (stagesData ?? [])[0];
        setCurrentStage((current as Stage) ?? null);
      }

      const { data: participantsData } = await supabase
        .from("participants")
        .select("id, display_name, photo_url, season_id, region_id")
        .eq("is_eliminated", false);

      const { data: votesData } = await supabase.from("votes").select("participant_id").range(0, 49999);
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
          region_id: string | null;
        }) => ({
          id: p.id,
          display_name: p.display_name,
          photo_url: p.photo_url,
          votes: counts[p.id] ?? 0,
          gifts: giftCounts[p.id] ?? 0,
          followers: followCounts[p.id] ?? 0,
          region_id: p.region_id,
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
      const { data: votesData } = await supabase.from("votes").select("participant_id").range(0, 49999);
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
      <EntryPopup />
      <div
        className="flex items-center justify-between px-6 py-4"
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
            backgroundImage: currentStage?.banner_image_url
              ? `linear-gradient(to top, rgba(11,11,13,0.97), rgba(11,11,13,0.4)), url(${currentStage.banner_image_url})`
              : "linear-gradient(135deg, #2a1f3d 0%, #0B0B0D 55%, #3d1f30 100%)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="w-1/2">
            <p className="text-goldSoft text-xs tracking-widest mb-1">
              MISS
            </p>
            <h1 className="text-2xl md:text-4xl font-bold text-offwhite mb-1 leading-tight">
              {scope === "country" ? "Россия" : user?.regions?.name ?? "Сезон скоро стартует"}
            </h1>
            <p className="text-muted text-[10px] mb-4 whitespace-nowrap">Красота. Харизма. Энергия.</p>
          </div>

          {currentStage && totalStages > 0 ? (
            <div
              className="w-1/2 rounded-xl p-3"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.35), rgba(236,72,153,0.25))",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(201,162,39,0.35)",
              }}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-offwhite text-xs font-semibold whitespace-nowrap">
                  Этап {currentStage.stage_number} из {totalStages}
                </span>
                <span className="text-muted text-[10px] truncate">{currentStage.title}</span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-[#7C3AED] to-gold rounded-full h-2"
                  style={{ width: `${stageProgress}%` }}
                />
              </div>
              <p className="text-offwhite text-[10px]">
                🕐 До конца: <span className="font-semibold">{stageCountdown}</span>
              </p>
            </div>
          ) : (
            <span className="inline-block w-fit bg-bgSurface/80 text-gold text-xs px-3 py-1 rounded-full border border-gold/40">
              {season ? STATUS_LABELS[season.status] ?? season.status : "Скоро старт"}
            </span>
          )}

          <div className="flex gap-2 mt-3">
            {season?.status === "registration" && !isParticipant && (
              <div
                className="flex-1 rounded-full p-[2px]"
                style={{
                  background:
                    "conic-gradient(from var(--vetoks-angle-2, 0deg), transparent 0%, #C9A227 12%, #F5E6A8 18%, #C9A227 24%, transparent 36%)",
                  animation: "vetoks-border-spin-2 3s linear infinite",
                }}
              >
                <Link
                  href="/apply"
                  className="flex items-center justify-center gap-1.5 bg-gold text-bgPrimary rounded-full py-2.5 font-semibold text-xs"
                >
                  📝 Подать анкету
                </Link>
              </div>
            )}
            <Link
              href="/promo"
              className="flex-1 flex items-center justify-center gap-1.5 bg-bgPrimary/80 border border-gold/50 text-offwhite rounded-full py-2.5 font-semibold text-xs"
            >
              ▶ Промо-ролик
            </Link>
          </div>
          <style>{`
            @property --vetoks-angle-2 {
              syntax: '<angle>';
              initial-value: 0deg;
              inherits: false;
            }
            @keyframes vetoks-border-spin-2 {
              to { --vetoks-angle-2: 360deg; }
            }
          `}</style>
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
          <div className="flex items-end justify-center gap-1.5 px-4 mb-8">
            {[participants[3], participants[1], participants[0], participants[2], participants[4]].map(
              (p, slot) => {
                if (!p) return <div key={slot} className="flex-1 max-w-[70px]" />;
                // slot: 0=4-е место, 1=2-е, 2=1-е (по центру), 3=3-е, 4=5-е
                const isFirst = slot === 2;
                const isMedium = slot === 1 || slot === 3;
                const isRising = risingIds.has(p.id);
                const rank = slot === 2 ? 1 : slot === 1 ? 2 : slot === 3 ? 3 : slot === 0 ? 4 : 5;
                const medal = rank === 1 ? "👑" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                const widthClass = isFirst ? "w-[92px]" : isMedium ? "w-[76px]" : "w-[62px]";
                return (
                  <Link
                    href={`/participant/${p.id}`}
                    key={p.id}
                    className={`flex-shrink-0 ${widthClass} bg-bgSurface border rounded-xl overflow-hidden transition-transform duration-500 ${
                      isFirst ? "border-gold" : "border-muted"
                    } ${isRising ? "scale-110 shadow-lg shadow-gold/50" : ""}`}
                    style={{ marginBottom: isFirst ? 0 : isMedium ? 14 : 24 }}
                  >
                    <div className="bg-black/40 flex items-center justify-center relative aspect-[3/4]">
                      {isRising && (
                        <span className="absolute -top-2 right-0.5 text-sm z-10">
                          🚀
                        </span>
                      )}
                      <span className={isFirst ? "absolute top-1.5 left-1.5 text-base" : "absolute top-1 left-1 text-xs"}>
                        {medal}
                      </span>
                      {p.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo_url}
                          alt={p.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-muted text-[9px] px-1 text-center">Нет фото</span>
                      )}
                    </div>
                    <div className={isFirst ? "p-2" : "p-1"}>
                      <p className={`text-offwhite font-semibold truncate ${isFirst ? "text-xs" : "text-[10px]"}`}>
                        {p.display_name}
                      </p>
                      <div className="flex items-center gap-1 flex-wrap">
                        <p className="text-rose text-[8px]">♥{p.votes}</p>
                        {isFirst && <p className="text-gold text-[8px]">🎁{p.gifts}</p>}
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        )}

        <Magazine scope={scope} userRegionId={user?.region_id ?? null} />

        {season?.status === "registration" && !isParticipant && (
          <div className="px-6 mb-8">
            <div
              className="relative rounded-full p-[2px]"
              style={{
                background:
                  "conic-gradient(from var(--vetoks-angle, 0deg), transparent 0%, #C9A227 12%, #F5E6A8 18%, #C9A227 24%, transparent 36%)",
                animation: "vetoks-border-spin 3s linear infinite",
              }}
            >
              <Link
                href="/apply"
                className="flex items-center justify-center gap-2 bg-gold text-bgPrimary rounded-full py-3 w-full font-semibold text-sm"
              >
                📝 Подать анкету на участие
              </Link>
            </div>
            <style>{`
              @property --vetoks-angle {
                syntax: '<angle>';
                initial-value: 0deg;
                inherits: false;
              }
              @keyframes vetoks-border-spin {
                to { --vetoks-angle: 360deg; }
              }
            `}</style>
          </div>
        )}

        <Survey />

        <PartnersShowcase />
      </div>

      <BottomNav />
    </main>
  );
}
