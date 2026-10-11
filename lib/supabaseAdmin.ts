import { createClient } from "@supabase/supabase-js";

// Этот клиент работает ТОЛЬКО на сервере (внутри app/api/.../route.ts) и
// имеет полные права — через него можно менять пароль любого пользователя.
// Никогда не импортируйте его в компонент со строкой "use client" наверху.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
