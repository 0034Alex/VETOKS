// Изоляция шоу: участники, ленты и рейтинги каждого шоу живут отдельно.
// participants.contest: null или "miss" — Miss, остальное — ключ шоу из CONTESTS.
import { CONTESTS } from "@/lib/status";

export const cleanContest = (v: unknown): string => (typeof v === "string" && CONTESTS[v] ? v : "miss");

// Фильтр для запроса к таблице participants (клиент и сервер).
export function applyContest(q: any, contest: string) {
  return cleanContest(contest) === "miss" ? q.or("contest.is.null,contest.eq.miss") : q.eq("contest", contest);
}

// Фильтр в коде, когда participants пришли вложенно.
export const inContest = (pcontest: unknown, contest: string) => cleanContest(pcontest ?? "miss") === cleanContest(contest);
