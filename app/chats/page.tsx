"use client";

import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { apiPost } from "@/lib/authClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

type Row = {
  userId: string;
  name: string;
  last: string;
  lastAt: string;
  unread: number;
  accepted: boolean;
  mine: boolean;
};

function ago(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "сейчас";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  if (diff < 86400000) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU");
}

export default function ChatsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [inbox, setInbox] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [isParticipant, setIsParticipant] = useState(false);

  async function load() {
    const r = await apiPost("/api/dm/threads");
    if (r?.ok) {
      setInbox(r.inbox);
      setRequests(r.requests);
    }
    setLoading(false);
  }

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login?redirect=/chats");
        return;
      }
      const { data: p } = await supabase.from("participants").select("id").eq("user_id", data.session.user.id).maybeSingle();
      setIsParticipant(!!p);
      await load();
      timer = setInterval(load, 8000);
    })();
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = tab === "chats" ? inbox : requests;

  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="max-w-3xl mx-auto">
        <div className="px-6 mb-4 flex items-baseline gap-5">
          <button
            onClick={() => setTab("chats")}
            className={`text-2xl font-semibold relative ${tab === "chats" ? "text-offwhite" : "text-muted"}`}
          >
            Чаты
            {tab === "chats" && <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded bg-gold" />}
          </button>
          <button
            onClick={() => setTab("requests")}
            className={`text-2xl font-semibold relative ${tab === "requests" ? "text-offwhite" : "text-muted"}`}
          >
            Запросы
            {requests.length > 0 && (
              <span className="ml-2 align-middle bg-danger text-white text-[10px] min-w-5 h-5 px-1 rounded-full inline-flex items-center justify-center">
                {requests.length > 9 ? "9+" : requests.length}
              </span>
            )}
            {tab === "requests" && <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded bg-gold" />}
          </button>
        </div>

        {tab === "requests" && (
          <p className="px-6 text-muted text-xs mb-3">
            Сюда приходят сообщения от тех, на кого вы не подписаны. Пока вы не примете запрос, человек может написать только 3 сообщения.
          </p>
        )}


        {loading && <LoadingScreen inline />}
        {!loading && list.length === 0 && (
          <p className="text-muted text-center px-6">
            {tab === "chats" ? "Пока нет переписок. Откройте профиль участницы и нажмите «Написать»." : "Новых запросов нет."}
          </p>
        )}

        <div className="px-6 flex flex-col gap-2">
          {list.map((c) => (
            <Link
              key={c.userId}
              href={`/chats/${c.userId}`}
              className="bg-bgSurface border border-muted rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#EC4899] text-white flex items-center justify-center font-semibold flex-shrink-0">
                {(c.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="text-offwhite text-sm font-semibold truncate">{c.name}</span>
                  <span className="text-muted text-xs flex-shrink-0 ml-2">{ago(c.lastAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-sm truncate ${c.unread > 0 ? "text-offwhite" : "text-muted"}`}>{c.last}</p>
                  {c.unread > 0 && (
                    <span className="bg-danger text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
