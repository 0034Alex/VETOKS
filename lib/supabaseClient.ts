import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Без межвкладочной блокировки: в Safari/PWA «зависшая» блокировка от прошлой страницы
// навсегда подвешивала getSession() и страница оставалась пустой.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async (_name: string, _timeout: number, fn: () => Promise<any>) => fn(),
  },
});
