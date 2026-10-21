import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkBirth, BirthCheck } from "@/lib/ageCategory";

// Открыта ли регистрация и участие для 15–17 (CRM → платформенная настройка teen_open).
export async function teenOpen(): Promise<boolean> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", "teen_open").maybeSingle();
  return String((data as any)?.value ?? "") === "true";
}

// Проверка даты рождения при регистрации. 15–17 пока пускаем только если teen_open включён.
export async function checkBirthForSignup(s: unknown): Promise<BirthCheck> {
  const r = checkBirth(s);
  if (!r.ok) return r;
  if (r.category === "teen" && !(await teenOpen())) {
    return {
      ok: false,
      error: "too_young",
      message: "Регистрация для возраста 15–17 откроется позже. Мы сообщим.",
    };
  }
  return r;
}
