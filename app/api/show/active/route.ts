import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { userIdFromBearer } from "@/lib/authServer";
import { countryOfUser } from "@/lib/countryServer";
import { countryView } from "@/lib/launchServer";

export const dynamic = "force-dynamic";

type ShowRow = {
  id: string;
  key: string;
  title: string;
  contest: string | null;
  status: string;
  theme: any;
  banner: any;
  apply_open_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  preview_token: string | null;
};

const pub = (s: ShowRow) => ({ id: s.id, key: s.key, title: s.title, contest: s.contest ?? s.key, theme: s.theme ?? {}, banner: s.banner ?? {}, endsAt: s.ends_at });

// Какое шоу сейчас показывать. Само переключается по датам из CRM:
// «запланировано» + наступил старт → идёт; «идёт» + прошёл конец → закончено.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const now = Date.now();
  const { data } = await supabaseAdmin.from("shows").select("*");
  const rows = ((data as ShowRow[]) ?? []).map((s) => {
    let st = s.status;
    const t = (v: string | null) => (v ? new Date(v).getTime() : null);
    if (st === "scheduled" && t(s.starts_at) !== null && t(s.starts_at)! <= now) st = "live";
    if (st === "live" && t(s.ends_at) !== null && t(s.ends_at)! <= now) st = "finished";
    return { ...s, eff: st };
  });

  // Предпросмотр: по секретной ссылке или для сотрудника из CRM.
  let forced: (typeof rows)[number] | undefined;
  const token = typeof b.token === "string" ? b.token : "";
  if (token) forced = rows.find((s) => s.preview_token && s.preview_token === token);
  if (!forced && typeof b.previewId === "string" && b.previewId) {
    const uid = await userIdFromBearer(req);
    if (uid) {
      const { data: u } = await supabaseAdmin.from("users").select("role").eq("id", uid).maybeSingle();
      if (u && ["moderator", "finance_admin", "super_admin"].includes(u.role)) forced = rows.find((s) => s.id === b.previewId);
    }
  }
  if (forced) return NextResponse.json({ ok: true, preview: true, show: pub(forced), recruiting: null });

  // Если в стране человека есть запуски — шоу выбирает запуск (даты считаются от старта).
  try {
    const uid2 = await userIdFromBearer(req);
    const cid = uid2 ? await countryOfUser(uid2) : null;
    const cv = cid ? await countryView(cid) : null;
    if (cv) {
      const byKey = (k: string | null) => (k ? rows.find((s) => s.key === k) : undefined);
      const lv = byKey(cv.liveKey);
      const rc = byKey(cv.recruitKey);
      const withOver = lv
        ? {
            ...pub(lv),
            banner: { ...(lv.banner ?? {}), ...cv.banner },
            blocks: cv.blocks,
            launch: cv.info,
          }
        : null;
      return NextResponse.json({
        ok: true,
        preview: false,
        show: withOver,
        recruiting: rc ? { ...pub(rc), startsAt: rc.starts_at } : null,
      });
    }
  } catch {}

  const live = rows
    .filter((s) => s.eff === "live")
    .sort((a, c) => (new Date(c.starts_at ?? 0).getTime() || 0) - (new Date(a.starts_at ?? 0).getTime() || 0))[0];
  const recruiting = rows.find(
    (s) => s.eff === "scheduled" && s.apply_open_at && new Date(s.apply_open_at).getTime() <= now && s.id !== live?.id
  );
  return NextResponse.json({
    ok: true,
    preview: false,
    show: live ? pub(live) : null,
    recruiting: recruiting ? { ...pub(recruiting), startsAt: recruiting.starts_at } : null,
  });
}
