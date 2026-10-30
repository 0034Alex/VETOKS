// Общая часть правил активности: без серверного кода, безопасно для браузера (CRM).
// Повышение доли обычной участницы за активность за весь сезон шоу. Правила — в CRM «Цены и выплаты».
export const ACT_KEY = "activity_bonus";
export type ActKind = "subscribers" | "views" | "gifts" | "votes" | "posts" | "invites";
export const ACT_KINDS: { kind: ActKind; label: string; unit: string }[] = [
  { kind: "subscribers", label: "Подписчики", unit: "человек" },
  { kind: "views", label: "Просмотры роликов", unit: "просмотров" },
  { kind: "gifts", label: "Подарки получено", unit: "монет" },
  { kind: "votes", label: "Голоса получено", unit: "голосов" },
  { kind: "posts", label: "Опубликовано роликов", unit: "шт." },
  { kind: "invites", label: "Приглашено друзей", unit: "человек" },
];
export type ActRule = { kind: ActKind; min: number; bonus: number };
// amb оставлено для совместимости со старыми записями: у амбассадора фиксированный процент, бонусов активности нет.
export type ActRules = { regular: boolean; amb: boolean; max: number; rules: ActRule[] };

export const ACT_DEFAULT: ActRules = {
  regular: false,
  amb: false,
  max: 10,
  rules: [
    { kind: "subscribers", min: 100, bonus: 2 },
    { kind: "views", min: 10000, bonus: 2 },
    { kind: "posts", min: 10, bonus: 1 },
    { kind: "invites", min: 50, bonus: 2 },
  ],
};

const KIND_SET = new Set<string>(ACT_KINDS.map((k) => k.kind));

export function parseAct(raw?: string | null): ActRules {
  try {
    const o = JSON.parse(String(raw || ""));
    const rules: ActRule[] = Array.isArray(o.rules)
      ? o.rules
          .map((r: any) => ({
            kind: (KIND_SET.has(r.kind) ? r.kind : "posts") as ActKind,
            min: Math.max(0, Math.floor(Number(r.min) || 0)),
            bonus: Math.max(0, Math.min(100, Number(r.bonus) || 0)),
          }))
          .filter((r: ActRule) => r.min > 0 && r.bonus > 0)
      : ACT_DEFAULT.rules;
    return { regular: !!o.regular, amb: false, max: Math.max(0, Math.min(100, Number(o.max) || 0)), rules };
  } catch {
    return ACT_DEFAULT;
  }
}
