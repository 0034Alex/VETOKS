"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";
import { getCrmCountry, crmCur } from "@/lib/crmCountry";

// CRM → «Рефералы»: награды, лимиты и лучшие приглашающие.
export default function AdminReferralsPanel() {
  const [d, setD] = useState<any>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  async function load() {
    const r = await apiPost("/api/admin/referrals", { action: "get", countryId: getCrmCountry() });
    setD(r);
    if (r?.settings) {
      const st = r.settings;
      setV({
        referral_enabled: st.enabled ? "true" : "false",
        referral_rewards_on: st.rewardsOn ? "true" : "false",
        referral_reward_referrer: String(st.raw.rewardReferrer),
        referral_reward_invited: String(st.raw.rewardInvited),
        referral_max_on: st.maxOn ? "true" : "false",
        referral_max_rewarded: String(st.raw.maxRewarded),
        referral_percent_on: st.percentOn ? "true" : "false",
        referral_percent: String(st.raw.percent),
        referral_percent_days: String(st.percentDays),
        adv_referral_on: st.advOn ? "true" : "false",
        adv_referral_percent: String(st.advPercent),
      });
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    await apiPost("/api/admin/referrals", { action: "save", values: v, countryId: getCrmCountry() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function reject(id: string) {
    await apiPost("/api/admin/referrals", { action: "reject", id });
    load();
  }

  if (!d?.ok) return <p className="text-muted">Загрузка...</p>;

  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-offwhite text-sm mb-3">
      <input type="checkbox" checked={v[k] === "true"} onChange={(e) => setV((p) => ({ ...p, [k]: e.target.checked ? "true" : "false" }))} />
      {label}
    </label>
  );

  const Field = ({ k, label, hint }: { k: string; label: string; hint?: string }) => (
    <label className="block mb-3">
      <span className="text-offwhite text-sm">{label}</span>
      <input
        type="number"
        value={v[k] ?? ""}
        onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))}
        className="w-full bg-bgPrimary border border-muted rounded-lg px-3 py-2 text-sm mt-1"
      />
      {hint && <span className="text-muted text-[11px]">{hint}</span>}
    </label>
  );

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-3">Настройки программы</p>
        <label className="flex items-center gap-2 text-offwhite text-sm mb-3">
          <input type="checkbox" checked={v.referral_enabled === "true"} onChange={(e) => setV((p) => ({ ...p, referral_enabled: e.target.checked ? "true" : "false" }))} />
          Приглашения включены
        </label>
        <p className="text-muted text-[11px] mb-4">Ссылки и учёт работают всегда, пока это включено. Лимита приглашений в сутки нет. Монеты платятся только после подтверждения номера в Telegram.</p>

        <div className="border border-muted/60 rounded-xl p-3 mb-3">
          <Toggle k="referral_rewards_on" label="Награды монетами (пригласившему и другу)" />
          <Field k="referral_reward_referrer" label={`Награда пригласившему, ${crmCur}`} hint="Начисляется, когда друг подтвердил номер." />
          <Field k="referral_reward_invited" label={`Бонус приглашённому, ${crmCur}`} hint="Начисляется при подтверждении номера." />
          <Toggle k="referral_max_on" label="Ограничить число оплачиваемых приглашений" />
          <Field k="referral_max_rewarded" label="Максимум оплачиваемых приглашений на человека" hint="Сверх этого числа приглашения считаются, но монеты не платятся. Если выключено, ограничения нет." />
        </div>

        <div className="border border-muted/60 rounded-xl p-3 mb-3">
          <Toggle k="referral_percent_on" label="Процент от покупок друга" />
          <Field k="referral_percent" label="Процент, %" hint="Пригласивший получает этот процент от трат друга. Платит платформа, друг ничего не теряет." />
          <Field k="referral_percent_days" label="Сколько дней после подтверждения номера друга" hint="Например 30. Потом процент перестаёт начисляться." />
        </div>

        <div className="border border-muted/60 rounded-xl p-3 mb-3">
          <Toggle k="adv_referral_on" label="Бонус за привёденного рекламодателя" />
          <Field k="adv_referral_percent" label="Процент от первой оплаты рекламы, %" hint="Платится один раз, с первой оплаты рекламодателя, участнице или амбассадору, которая его привела. Повторные оплаты и докупки ничего не дают. Условия одинаковы для всех." />
        </div>
        <button onClick={save} className="w-full bg-gold text-bgPrimary font-semibold py-2.5 rounded-full text-sm">
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>

      <div className="bg-bgSurface border border-muted rounded-xl p-4">
        <p className="text-offwhite font-semibold text-sm mb-1">Итого</p>
        <p className="text-muted text-sm">Пришло по ссылкам: {d.totals.invited} · подтвердили номер: {d.totals.qualified}</p>
      </div>

      <div>
        <p className="text-offwhite font-semibold text-sm mb-2">Последние приглашения</p>
        {(d.recent ?? []).length === 0 && <p className="text-muted text-sm">Пока нет.</p>}
        <div className="flex flex-col gap-2">
          {(d.recent ?? []).map((r: any) => (
            <div key={r.id} className="bg-bgSurface border border-muted rounded-xl px-3 py-2 flex justify-between items-center gap-2 text-sm">
              <span className="text-offwhite min-w-0 truncate">{r.referrer} → {r.invited}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className={`text-xs ${r.status === "qualified" ? "text-success" : r.status === "rejected" ? "text-danger" : "text-muted"}`}>
                  {r.status === "qualified" ? "засчитан" : r.status === "rejected" ? "отклонён" : "ждёт номер"}
                </span>
                {r.status === "pending" && (
                  <button onClick={() => reject(r.id)} className="text-danger text-xs border border-danger rounded-full px-2 py-0.5">Отклонить</button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-offwhite font-semibold text-sm mb-2">Кто приглашает больше всех</p>
        {d.top.length === 0 && <p className="text-muted text-sm">Пока никого.</p>}
        <div className="flex flex-col gap-2">
          {d.top.map((t: any) => (
            <div key={t.id} className={`bg-bgSurface border rounded-xl px-3 py-2 flex justify-between text-sm ${t.suspicious ? "border-danger" : "border-muted"}`}>
              <span className="text-offwhite">
                {t.name} {t.suspicious && <span className="text-danger text-xs">⚠ мало подтверждений</span>}
              </span>
              <span className="text-muted text-xs">{t.ok} из {t.total} · за сутки {t.last24}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
