// Общая часть правил активности: без серверного кода, безопасно для браузера (CRM).
// Повышение доли участницы за активность (за последние 30 дней). Правила — в CRM «Цены и выплаты».
export const ACT_KEY = "activity_bonus";
export type ActRule = { kind: "posts" | "invites"; min: number; bonus: number };
export type ActRules = { regular: boolean; amb: boolean; max: number; rules: ActRule[] };

export const ACT_DEFAULT: ActRules = {
  regular: false,
  amb: false,
  max: 10,
  rules: [
    { kind: "posts", min: 10, bonus: 2 },
    { kind: "invites", min: 50, bonus: 3 },
  ],
};

export function parseAct(raw?: string | null): ActRules {
  try {
    const o = JSON.parse(String(raw || ""));
    const rules = Array.isArray(o.rules)
      ? o.rules
          .map((r: any) => ({ kind: r.kind === "invites" ? "invites" : "posts", min: Math.max(0, Math.floor(Number(r.min) || 0)), bonus: Math.max(0, Math.min(100, Number(r.bonus) || 0)) }))
          .filter((r: ActRule) => r.min > 0 && r.bonus > 0)
      : ACT_DEFAULT.rules;
    return { regular: !!o.regular, amb: !!o.amb, max: Math.max(0, Math.min(100, Number(o.max) || 0)), rules };
  } catch {
    return ACT_DEFAULT;
  }
}

