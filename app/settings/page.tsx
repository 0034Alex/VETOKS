"use client";

import { useCardsEnabled } from "@/lib/useCardsEnabled";
import LoadingScreen from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";
import { useT, LANGS } from "@/lib/i18n";
import { useCountryLangs } from "@/lib/useCountryLangs";
import { apiPost } from "@/lib/authClient";
import { cleanNick, nickProblem, NICK_MESSAGES } from "@/lib/nick";
import { SocialIcon, socialKind, normalizeLink, parseLinks } from "@/lib/socialLinks";
import ShopLinkCard from "@/components/ShopLinkCard";

const TOGGLES: string[] = ["gifts", "votes", "rating", "tasks", "support"];

// Приватность: true = открыто (по умолчанию всё открыто).
const PRIVACY: { key: string; label: string; hint?: string }[] = [
  { key: "feed", label: "Показывать моё имя в живой ленте подарков", hint: "Если выключить — в ленте будет «Аноним»" },
  { key: "region", label: "Показывать мой регион в профиле" },
  { key: "online", label: "Показывать, что я в сети" },
  { key: "follows", label: "Показывать другим мои подписки и подписчиков", hint: "Если выключить — списки увидите только вы" },
  { key: "gifts", label: "Показывать витрину подарков в моём профиле", hint: "Если выключить — подарки увидите только вы" },
  { key: "dm", label: "Разрешить писать мне личные сообщения", hint: "Если выключить — писать вам не смогут" },
];

export default function SettingsPage() {
  const cardsOn = useCardsEnabled();
  const router = useRouter();
  const { t, lang, setLang } = useT();
  const langsAllowed = useCountryLangs();
  const [loading, setLoading] = useState(true);
  const [delOpen, setDelOpen] = useState(false);
  const [delSure, setDelSure] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [userId, setUserId] = useState("");
  const [verified, setVerified] = useState(false);
  const [tgLinked, setTgLinked] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [priv, setPriv] = useState<Record<string, boolean>>({});
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkErr, setLinkErr] = useState("");
  const [nick, setNick] = useState<string | null>(null);
  const [nickInput, setNickInput] = useState("");
  const [nickState, setNickState] = useState<"" | "checking" | "ok" | "bad">("");
  const [nickMsg, setNickMsg] = useState("");
  const [nickLockUntil, setNickLockUntil] = useState<string | null>(null);
  const [nickSaving, setNickSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      if (!u) {
        router.push("/login?redirect=/settings");
        return;
      }
      setUserId(u.id);
      setVerified(!!u.phone_verified);
      setPhone(u.phone);
      const { data } = await supabase.from("users").select("notify_tg, privacy, social_links").eq("id", u.id).maybeSingle();
      setTgLinked(!!u.telegram_id);
      setPrefs((data?.notify_tg as Record<string, boolean>) ?? {});
      setPriv((data?.privacy as Record<string, boolean>) ?? {});
      setLinks(parseLinks((data as any)?.social_links));
      const nr = await apiPost("/api/profile/nick", { action: "get" });
      if (nr?.ok) {
        setNick(nr.nick ?? null);
        setNickInput(nr.nick ?? "");
        setNickLockUntil(nr.canChangeAt ?? null);
      }
      setLoading(false);
    })();
    const onVerified = () => setVerified(true);
    window.addEventListener("vetoks:verified", onVerified);
    return () => window.removeEventListener("vetoks:verified", onVerified);
  }, [router]);

  async function toggle(key: string) {
    const next = { ...prefs, [key]: prefs[key] === false };
    setPrefs(next);
    await supabase.from("users").update({ notify_tg: next }).eq("id", userId);
  }

  async function togglePriv(key: string) {
    const next = { ...priv, [key]: priv[key] === false };
    setPriv(next);
    await supabase.from("users").update({ privacy: next }).eq("id", userId);
  }

  // Проверка ника на лету: сначала правила, потом «свободен ли».
  useEffect(() => {
    const n = cleanNick(nickInput);
    if (!n || n === (nick ?? "")) {
      setNickState("");
      setNickMsg("");
      return;
    }
    const problem = nickProblem(n);
    // «Служебные» слова проверяет сервер: помеченным галочкой аккаунтам их можно.
    if (problem && problem !== "reserved") {
      setNickState("bad");
      setNickMsg(NICK_MESSAGES[problem]);
      return;
    }
    setNickState("checking");
    setNickMsg("");
    const t = setTimeout(async () => {
      const r = await apiPost("/api/profile/nick", { action: "check", nick: n });
      if (r?.ok && r.available) {
        setNickState("ok");
        setNickMsg("Ник свободен.");
      } else {
        setNickState("bad");
        setNickMsg(NICK_MESSAGES[r?.error ?? "error"] ?? NICK_MESSAGES.error);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [nickInput, nick]);

  async function saveNick() {
    setNickSaving(true);
    const r = await apiPost("/api/profile/nick", { action: "set", nick: cleanNick(nickInput) });
    setNickSaving(false);
    if (r?.ok) {
      setNick(r.nick);
      setNickInput(r.nick);
      setNickState("");
      setNickMsg("Ник сохранён.");
      setNickLockUntil(new Date(Date.now() + 30 * 86400000).toISOString());
    } else {
      setNickState("bad");
      setNickMsg(NICK_MESSAGES[r?.error ?? "error"] ?? NICK_MESSAGES.error);
      if (r?.canChangeAt) setNickLockUntil(r.canChangeAt);
    }
  }

  async function saveLinks(next: string[]) {
    setLinks(next);
    await supabase.from("users").update({ social_links: next }).eq("id", userId);
  }

  async function addLink() {
    setLinkErr("");
    const v = normalizeLink(linkInput);
    if (!v) {
      setLinkErr("Это не похоже на ссылку. Вставьте адрес вашей страницы.");
      return;
    }
    if (links.includes(v)) {
      setLinkErr("Эта ссылка уже добавлена.");
      return;
    }
    if (links.length >= 6) {
      setLinkErr("Можно добавить до 6 ссылок.");
      return;
    }
    await saveLinks([...links, v]);
    setLinkInput("");
  }

  async function deleteAccount() {
    if (!delSure || delBusy) return;
    setDelBusy(true);
    setDelErr("");
    const r = await apiPost("/api/account/delete", { confirm: true });
    if (r?.ok) {
      try { await supabase.auth.signOut(); } catch {}
      try { localStorage.clear(); sessionStorage.clear(); } catch {}
      window.location.href = "/login";
      return;
    }
    setDelErr(r?.error === "staff" ? t("settings.del.staff") : t("settings.del.fail"));
    setDelBusy(false);
  }

  if (loading) return <LoadingScreen />;

  return (
    <main className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto">
        <PageHeader />
        <div className="px-6 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold text-offwhite">{t("settings.title")}</h1>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-2">{t("settings.phone")}</p>
            {verified ? (
              <p className="text-success text-sm">{t("settings.verified")}{phone ? ` (${phone})` : ""}</p>
            ) : (
              <>
                <p className="text-muted text-xs mb-2">
                  {t("settings.verifyHint")}
                </p>
                <button
                  onClick={() => window.dispatchEvent(new Event("vetoks:verify-phone"))}
                  className="bg-gold text-bgPrimary font-semibold px-5 py-2 rounded-full text-sm"
                >
                  {t("settings.verifyBtn")}
                </button>
              </>
            )}
            <p className="text-muted text-[11px] mt-3">
              {t("settings.phoneNote")}
            </p>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-1">{t("settings.notif")}</p>
            {tgLinked ? (
              <p className="text-muted text-xs mb-3">{t("settings.notifLinked")}</p>
            ) : (
              <p className="text-muted text-xs mb-3">
                {t("settings.notifNotLinked")}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {TOGGLES.map((k) => (
                <label key={k} className="flex items-center justify-between gap-3 text-offwhite text-sm">
                  <span>{k === "gifts" && !cardsOn ? t("settings.n.giftsNoCards") : t("settings.n." + k)}</span>
                  <input type="checkbox" checked={prefs[k] !== false} onChange={() => toggle(k)} />
                </label>
              ))}
              <label className="flex items-center justify-between gap-3 text-offwhite text-sm">
                <span>Новые посты в каналах — в приложении</span>
                <input type="checkbox" checked={prefs.ch_app !== false} onChange={() => toggle("ch_app")} />
              </label>
              <label className="flex items-center justify-between gap-3 text-offwhite text-sm">
                <span>Новые посты в каналах — в Telegram-боте</span>
                <input type="checkbox" checked={prefs.ch_tg === true} onChange={() => { const next = { ...prefs, ch_tg: prefs.ch_tg !== true }; setPrefs(next); supabase.from("users").update({ notify_tg: next }).eq("id", userId); }} />
              </label>
            </div>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-1">Ник</p>
            <p className="text-muted text-xs mb-3">
              Ваше имя в VETOKS: по нему вас найдут, а ссылка на профиль и приглашение друзьям будут красивыми. Латиница, цифры и подчёркивание, от 3 до 20 символов. Менять можно раз в 30 дней.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 flex items-center bg-bgPrimary border border-muted rounded-xl px-3">
                <span className="text-muted text-sm mr-1">@</span>
                <input
                  value={nickInput}
                  onChange={(e) => setNickInput(e.target.value.replace(/^@/, ""))}
                  disabled={!!nickLockUntil}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="alina_vetoks"
                  className="flex-1 min-w-0 bg-transparent text-offwhite py-2.5 text-sm outline-none disabled:opacity-60"
                />
              </div>
              <button
                onClick={saveNick}
                disabled={nickState !== "ok" || nickSaving || !!nickLockUntil}
                className="bg-gold text-bgPrimary font-semibold rounded-xl px-4 text-sm disabled:opacity-40"
              >
                {nickSaving ? "..." : "Сохранить"}
              </button>
            </div>
            {nickLockUntil ? (
              <p className="text-muted text-xs mt-2">
                {nick ? "Ваш ник сохранён. " : ""}Сменить можно после {new Date(nickLockUntil).toLocaleDateString("ru-RU")}.
              </p>
            ) : nickState === "checking" ? (
              <p className="text-muted text-xs mt-2">Проверяем...</p>
            ) : nickMsg ? (
              <p className={`text-xs mt-2 ${nickState === "bad" ? "text-danger" : "text-success"}`}>{nickMsg}</p>
            ) : null}
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-1">Соцсети</p>
            <p className="text-muted text-xs mb-3">
              Вставьте ссылку на свою страницу. Значок сети появится в вашем профиле сам.
            </p>
            <div className="flex gap-2">
              <input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLink()}
                placeholder="https://instagram.com/ваш_ник"
                className="flex-1 min-w-0 bg-bgPrimary text-offwhite border border-muted rounded-xl px-3 py-2.5 text-sm"
              />
              <button onClick={addLink} className="bg-gold text-bgPrimary font-semibold rounded-xl px-4 text-sm">
                Добавить
              </button>
            </div>
            {linkErr && <p className="text-danger text-xs mt-2">{linkErr}</p>}
            {links.length > 0 && (
              <div className="mt-3 flex flex-col">
                {links.map((u) => (
                  <div key={u} className="flex items-center gap-3 py-2.5 border-t border-muted/40">
                    <span className="w-9 h-9 rounded-full bg-bgPrimary border border-muted/60 flex items-center justify-center text-offwhite flex-none">
                      <SocialIcon kind={socialKind(u)} size={18} />
                    </span>
                    <span className="flex-1 min-w-0 truncate text-muted text-xs">{u.replace(/^https?:\/\//, "")}</span>
                    <button onClick={() => saveLinks(links.filter((x) => x !== u))} className="text-danger text-xs">
                      Убрать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ShopLinkCard picker />

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-3">Приватность</p>
            <div className="flex flex-col gap-3">
              {PRIVACY.map((p) => (
                <label key={p.key} className="flex items-start justify-between gap-3 text-offwhite text-sm">
                  <span>
                    {p.label}
                    {p.hint && <span className="block text-muted text-xs mt-0.5">{p.hint}</span>}
                  </span>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={priv[p.key] !== false}
                    onChange={() => togglePriv(p.key)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-bgSurface border border-muted rounded-xl p-4">
            <p className="text-offwhite font-semibold text-sm mb-2">{t("settings.language")}</p>
            <div className="flex flex-wrap gap-2">
              {LANGS.filter((l) => langsAllowed.includes(l.code) || l.code === lang).map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`px-4 py-2 rounded-full text-sm border ${
                    lang === l.code ? "bg-gold text-bgPrimary border-gold" : "border-muted text-offwhite"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-bgSurface border border-danger/40 rounded-xl p-4">
            <p className="text-muted text-xs mb-3">{t("settings.del.hint")}</p>
            <button onClick={() => { setDelSure(false); setDelErr(""); setDelOpen(true); }} className="text-danger text-sm font-semibold underline">
              {t("settings.del.btn")}
            </button>
          </div>
        </div>
      </div>
      {delOpen && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center px-5" onClick={() => !delBusy && setDelOpen(false)}>
          <div className="w-full max-w-sm bg-bgSurface border border-danger/50 rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-danger font-semibold text-base mb-2">{t("settings.del.title")}</p>
            <p className="text-offwhite text-sm mb-4">{t("settings.del.body")}</p>
            <label className="flex items-start gap-2 text-offwhite text-sm mb-4">
              <input type="checkbox" className="mt-1" checked={delSure} onChange={(e) => setDelSure(e.target.checked)} />
              <span>{t("settings.del.sure")}</span>
            </label>
            {delErr && <p className="text-danger text-xs mb-3">{delErr}</p>}
            <div className="flex gap-2">
              <button disabled={delBusy} onClick={() => setDelOpen(false)} className="flex-1 border border-muted text-offwhite rounded-full py-2.5 text-sm">
                {t("settings.del.cancel")}
              </button>
              <button disabled={!delSure || delBusy} onClick={deleteAccount} className="flex-1 bg-danger text-white font-semibold rounded-full py-2.5 text-sm disabled:opacity-40">
                {delBusy ? t("settings.del.busy") : t("settings.del.go")}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </main>
  );
}
