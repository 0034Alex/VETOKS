import { GET as dailyGet } from "@/app/api/cron/daily/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Старый адрес оставлен рабочим: можно вызывать из планировщика так же, как /api/cron/daily.
export async function GET(req: Request) {
  return dailyGet(req);
}
