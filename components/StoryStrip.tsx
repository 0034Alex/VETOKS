"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/authClient";
import StoryViewer, { type StoryGroup } from "@/components/StoryViewer";

// Лента историй на главной: «Ваша» и те, на кого вы подписаны.
export default function StoryStrip() {
  const router = useRouter();
  const [mine, setMine] = useState<StoryGroup | null>(null);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<{ list: StoryGroup[]; start: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await apiPost("/api/story", { action: "feed" });
    if (r?.ok) {
      setMine({ ...r.mine, own: true });
      setGroups(r.groups ?? []);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const hasMine = !!mine && mine.stories.length > 0;

  return (
    <div className="px-6 mb-5">
      <p className="text-offwhite text-sm font-semibold mb-2">Истории</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          className="flex-none w-16 text-center"
          onClick={() => (hasMine ? setOpen({ list: [mine!], start: 0 }) : router.push("/add-video?story=1"))}
        >
          <div
            className={`relative w-16 h-16 rounded-full ${hasMine ? "p-[2px]" : "border border-dashed border-gold/70"} flex items-center justify-center`}
            style={hasMine ? { background: "linear-gradient(135deg, rgb(var(--c-sec)), rgb(var(--c-gold)))" } : undefined}
          >
            {hasMine ? (
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-bgPrimary bg-bgSurface">
                {mine?.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mine.photo} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ) : (
              <span className="text-gold text-2xl">+</span>
            )}
            {hasMine && <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gold text-bgPrimary text-sm leading-5 font-bold">+</span>}
          </div>
          <p className="text-[10px] text-muted mt-1">Ваша</p>
        </button>
        {groups.map((g, i) => (
          <button key={g.userId} className="flex-none w-16 text-center" onClick={() => setOpen({ list: groups, start: i })}>
            <div
              className="w-16 h-16 rounded-full p-[2px]"
              style={{ background: (g as any).unseen ? "linear-gradient(135deg, rgb(var(--c-sec)), rgb(var(--c-gold)))" : "rgb(var(--c-gold) / 0.25)" }}
            >
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-bgPrimary bg-bgSurface">
                {g.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photo} alt={g.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-muted">{g.name?.[0]}</span>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted mt-1 truncate">{g.name}</p>
          </button>
        ))}
        {loaded && groups.length === 0 && <p className="text-muted text-xs self-center">Подпишитесь на участниц, и их истории появятся здесь.</p>}
      </div>
      {open && <StoryViewer groups={open.list} start={open.start} onClose={() => { setOpen(null); load(); }} onChanged={load} />}
    </div>
  );
}
