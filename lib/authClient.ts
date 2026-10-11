import { supabase } from "@/lib/supabaseClient";

// Открывает сессию в браузере по ключу, который выдал наш сервер.
export async function openSession(tokenHash: string): Promise<boolean> {
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  return !error;
}

export function getInitData(): string {
  if (typeof window === "undefined") return "";
  return (window as any).Telegram?.WebApp?.initData || "";
}

export async function postJson(url: string, body: unknown, token?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  try {
    return await res.json();
  } catch {
    return { status: "error" };
  }
}
