import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireStaff, logAction } from "@/lib/staffServer";
import { rateHit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Резервная копия данных: отдаём таблицы кусками по 500 строк (браузер собирает один файл).
const TABLES = [
  "users",
  "participants",
  "applications",
  "wallets",
  "wallet_transactions",
  "vote_credits",
  "votes",
  "gifts",
  "content_posts",
  "media_comments",
  "media_likes",
  "participant_follows",
  "user_follows",
  "boosts",
  "black_marks",
  "black_mark_penalties",
  "notifications",
  "support_requests",
  "seasons",
  "season_stages",
  "countries",
  "regions",
  "platform_settings",
  "app_prices",
  "partners",
  "admin_log",
];
const PAGE = 500;

export async function POST(req: Request) {
  const uid = await requireStaff(req, ["super_admin"]);
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));

  if (b.action === "tables") {
    const r = await rateHit(`export:${uid}`, 3600, 6);
    if (!r.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    await logAction(uid, "data_export", null);
    return NextResponse.json({ ok: true, tables: TABLES, page: PAGE });
  }

  const table = String(b.table ?? "");
  if (!TABLES.includes(table)) return NextResponse.json({ ok: false, error: "bad_table" }, { status: 400 });
  const offset = Math.max(0, Math.floor(Number(b.offset) || 0));

  let q = supabaseAdmin.from(table).select("*").order("id", { ascending: true }).range(offset, offset + PAGE - 1);
  let { data, error } = await q;
  if (error) {
    // Нет колонки id — читаем без сортировки; нет самой таблицы — отдаём пусто.
    const r2 = await supabaseAdmin.from(table).select("*").range(offset, offset + PAGE - 1);
    data = r2.data;
    error = r2.error;
  }
  if (error) return NextResponse.json({ ok: true, rows: [], missing: true });
  return NextResponse.json({ ok: true, rows: data ?? [] });
}
