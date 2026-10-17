"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/authClient";
import { IconGrid, IconVideoTab, IconRepost, IconTagTab, IconPlaySmall } from "@/components/ProfileIcons";

type Item = { id: string; postId: string; participantId: string | null; kind: "video" | "photo"; url: string; label?: string; tagId?: string };
type Data = {
  isSelf: boolean;
  isParticipant: boolean;
  feed: Item[];
  videos: Item[];
  reposts: Item[];
  tags: Item[];
  pending: Item[];
  tagManual: boolean;
};
type Tab = "feed" | "video" | "rep" | "tag";

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: "feed", label: "Лента", icon: <IconGrid /> },
  { key: "video", label: "Видео", icon: <IconVideoTab /> },
  { key: "rep", label: "Репосты", icon: <IconRepost /> },
  { key: "tag", label: "Отметки", icon: <IconTagTab /> },
];


// Разделы профиля с иконками: лента, видео, репосты, отметки. Одинаково у участниц и у зрителей.
export default function ProfileTabs({ userId }: { userId?: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("feed");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await apiPost("/api/profile/content", userId ? { userId } : {});
    if (r?.ok) setD(r as Data);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function tagAction(action: "accept" | "hide" | "remove", tagId?: string) {
    if (!tagId) return;
    await apiPost("/api/profile/tags", { action, tagId });
    setMsg(action === "accept" ? "Отметка принята." : action === "hide" ? "Отметка скрыта." : "Отметка убрана.");
    setTimeout(() => setMsg(""), 2500);
    await load();
  }

  async function toggleManual() {
    if (!d) return;
    const on = !d.tagManual;
    setD({ ...d, tagManual: on });
    await apiPost("/api/profile/tags", { action: "manual", on });
  }

  const items: Item[] = !d ? [] : tab === "feed" ? d.feed : tab === "video" ? d.videos : tab === "rep" ? d.reposts : d.tags;
  const self = !!d?.isSelf;

  return (
    <div className="mt-4">
      <div className="flex border-y border-muted/40 sticky top-0 z-10 bg-bgPrimary" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            aria-label={t.label}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 flex items-center justify-center relative ${tab === t.key ? "text-[#E8D48A]" : "text-muted"}`}
          >
            {t.icon}
            {tab === t.key && <span className="absolute left-[22%] right-[22%] -bottom-px h-0.5 bg-gold" />}
          </button>
        ))}
      </div>

      {tab === "tag" && self && d && (
        <div className="mx-5 mt-3 rounded-xl border border-muted/50 bg-bgSurface p-3 text-xs text-[#c9c9ce] leading-relaxed">
          <div className="flex items-center justify-between gap-3">
            <span>
              <b className="text-offwhite">Подтверждать отметки вручную</b>
              <br />
              Отметка появится в профиле только после вашего «Принять».
            </span>
            <button
              onClick={toggleManual}
              aria-pressed={d.tagManual}
              aria-label="Подтверждать отметки вручную"
              className={`relative w-10 h-6 rounded-full flex-none ${d.tagManual ? "bg-gold" : "bg-[#3a3a42]"}`}
            >
              <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${d.tagManual ? "left-[19px]" : "left-[3px]"}`} />
            </button>
          </div>
          {d.pending.map((p) => (
            <div key={p.tagId} className="flex items-center gap-3 mt-3">
              <div className="w-11 h-14 flex-none bg-black overflow-hidden rounded">
                {p.kind === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <video src={p.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <b className="text-offwhite">{(p.label ?? "").replace("отметка · ", "")}</b> хочет вас отметить
              </div>
              <button onClick={() => tagAction("accept", p.tagId)} className="bg-gold text-bgPrimary font-semibold rounded-lg px-3 py-1.5">
                Принять
              </button>
              <button onClick={() => tagAction("hide", p.tagId)} className="border border-muted rounded-lg px-3 py-1.5 text-offwhite">
                Скрыть
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="text-gold text-xs text-center mt-2">{msg}</p>}

      {!d ? (
        <div className="py-10 text-center text-muted text-sm">…</div>
      ) : items.length === 0 ? (
        <div className="py-10" />
      ) : (
        <div className="grid grid-cols-3 gap-[2px] mt-[2px]">
          {items.map((it) => (
            <div key={`${tab}-${it.id}-${it.tagId ?? ""}`} className="relative aspect-[3/4] bg-black overflow-hidden">
              <Link
                href={it.participantId ? `/participant/${it.participantId}/${it.kind === "video" ? "videos" : "photos"}?post=${it.postId}` : `/post/${it.postId}`}
                className="block w-full h-full"
              >
                {it.kind === "video" ? (
                  <video src={it.url} muted playsInline preload="metadata" className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.url} alt="" className="w-full h-full object-cover pointer-events-none" />
                )}
                {it.kind === "video" && (
                  <span className="absolute top-1.5 right-1.5 drop-shadow">
                    <IconPlaySmall />
                  </span>
                )}
                {it.label && (
                  <span className="absolute left-1.5 right-1.5 bottom-1 text-[10px] text-white truncate [text-shadow:0_1px_3px_rgba(0,0,0,.8)]">
                    {it.label}
                  </span>
                )}
              </Link>
              {tab === "tag" && self && it.tagId && (
                <button
                  onClick={() => tagAction("remove", it.tagId)}
                  aria-label="Убрать отметку"
                  className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
