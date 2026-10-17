import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bad, requireUser } from "@/lib/shopServer";
import { sameCountry } from "@/lib/countryServer";

export const dynamic = "force-dynamic";

type Item = { id: string; postId: string; participantId: string | null; kind: "video" | "photo"; url: string; label?: string; tagId?: string };

function toItem(p: any, extra: Partial<Item> = {}): Item | null {
  const url = p.video_url || p.photo_url;
  if (!url) return null;
  return { id: p.id, postId: p.id, participantId: p.participant_id ?? null, kind: p.video_url ? "video" : "photo", url, ...extra };
}

// Имя автора публикации: участница или обычный человек.
async function authorNames(posts: any[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(posts.filter((p) => !p.participants && p.user_id).map((p) => p.user_id as string)));
  if (!ids.length) return {};
  const { data } = await supabaseAdmin.from("users").select("id, first_name").in("id", ids);
  const m: Record<string, string> = {};
  (data ?? []).forEach((u: any) => (m[u.id] = u.first_name || ""));
  return m;
}
function nameOf(p: any, m: Record<string, string>) {
  const pp = Array.isArray(p.participants) ? p.participants[0] : p.participants;
  return pp?.display_name ?? m[p.user_id] ?? "";
}

// Содержимое профиля: лента, видео, репосты, отметки. Для себя — ещё запросы на отметку и настройка.
export async function POST(req: Request) {
  const me = await requireUser(req);
  if (me instanceof NextResponse) return me;
  const b = await req.json().catch(() => ({}));
  const target = String(b.userId || me);
  const isSelf = target === me;
  if (!isSelf && !(await sameCountry(me, target))) return bad("not_found", 404);

  const { data: part } = await supabaseAdmin.from("participants").select("id, display_name").eq("user_id", target).maybeSingle();
  let own: Item[] = [];
  {
    // Свои публикации: по автору (user_id) и, на всякий случай, по анкете участницы.
    const filter = part ? `user_id.eq.${target},participant_id.eq.${part.id}` : `user_id.eq.${target}`;
    const { data } = await supabaseAdmin
      .from("content_posts")
      .select("id, participant_id, user_id, video_url, photo_url")
      .or(filter)
      .order("submitted_at", { ascending: false })
      .limit(300);
    own = (data ?? []).map((p: any) => toItem(p)).filter(Boolean) as Item[];
  }

  // Репосты.
  let reposts: Item[] = [];
  const { data: rp } = await supabaseAdmin
    .from("content_reposts")
    .select("post_id, created_at")
    .eq("user_id", target)
    .order("created_at", { ascending: false })
    .limit(200);
  const rIds = (rp ?? []).map((r: any) => r.post_id);
  if (rIds.length) {
    const { data: posts } = await supabaseAdmin
      .from("content_posts")
      .select("id, participant_id, user_id, video_url, photo_url, participants(display_name)")
      .in("id", rIds);
    const byId: Record<string, any> = {};
    (posts ?? []).forEach((p: any) => (byId[p.id] = p));
    const nm = await authorNames(posts ?? []);
    reposts = rIds
      .map((id: string) => byId[id])
      .filter(Boolean)
      .map((p: any) => toItem(p, { label: `репост · ${nameOf(p, nm)}` }))
      .filter(Boolean) as Item[];
  }

  // Отметки: принятые видны всем, ожидающие — только владельцу.
  const loadTags = async (status: string) => {
    const { data: tg } = await supabaseAdmin
      .from("content_tags")
      .select("id, post_id, tagger_id, created_at")
      .eq("tagged_user_id", target)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = (tg ?? []).map((t: any) => t.post_id);
    if (!ids.length) return [] as Item[];
    const { data: posts } = await supabaseAdmin
      .from("content_posts")
      .select("id, participant_id, user_id, video_url, photo_url, participants(display_name)")
      .in("id", ids);
    const byId: Record<string, any> = {};
    (posts ?? []).forEach((p: any) => (byId[p.id] = p));
    const names = await authorNames(posts ?? []);
    return (tg ?? [])
      .map((t: any) => {
        const p = byId[t.post_id];
        if (!p) return null;
        return toItem(p, { tagId: t.id, label: `отметка · ${nameOf(p, names)}` });
      })
      .filter(Boolean) as Item[];
  };
  const tags = await loadTags("approved");
  const pending = isSelf ? await loadTags("pending") : [];

  let tagManual = false;
  if (isSelf) {
    const { data: u } = await supabaseAdmin.from("users").select("tag_manual").eq("id", me).maybeSingle();
    tagManual = !!(u as any)?.tag_manual;
  }

  return NextResponse.json({
    ok: true,
    isSelf,
    isParticipant: !!part,
    feed: own,
    videos: own.filter((i) => i.kind === "video"),
    reposts,
    tags,
    pending,
    tagManual,
  });
}
