"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, openSession } from "@/lib/authClient";

// Переключатель «Личный / Бизнес». Виден только одобренным партнёрам.
export default function BusinessSwitch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [st, setSt] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiPost("/api/business/state").then((r) => r?.ok && setSt(r));
  }, []);

  if (!st?.eligible) return null;
  const biz = !!st.isBusinessNow;

  async function go(toBusiness: boolean) {
    if (busy || toBusiness === biz) return;
    setBusy(true);
    let r: any;
    if (toBusiness) {
      // Бизнес-аккаунт ещё не создан: открываем страницу, где его включают.
      if (!st.hasBusiness) {
        router.push("/business");
        return;
      }
      r = await apiPost("/api/accounts/switch", { targetId: st.businessUserId });
    } else {
      r = await apiPost("/api/accounts/switch", { targetId: st.rootId });
    }
    if (r?.status === "ok" && (await openSession(r.token_hash))) {
      window.location.href = toBusiness ? "/business" : "/profile";
    } else setBusy(false);
  }

  const seg = (on: boolean) => `px-4 py-1.5 rounded-full text-xs font-semibold ${on ? "bg-gold text-bgPrimary" : "text-offwhite"}`;
  return (
    <div className={`inline-flex bg-black/45 backdrop-blur border border-white/15 rounded-full p-0.5 ${className}`}>
      <button onClick={() => go(false)} className={seg(!biz)} disabled={busy}>Личный</button>
      <button onClick={() => go(true)} className={seg(biz)} disabled={busy}>Бизнес</button>
    </div>
  );
}
