"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SocialIcon, socialKind, normalizeLink, parseLinks } from "@/lib/socialLinks";

// Ссылки на соцсети и сайты: вставил адрес, и в профиле появился значок сети. До 6 ссылок.
export default function SocialLinksEditor({ userId }: { userId: string }) {
  const [links, setLinks] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("users")
      .select("social_links")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setLinks(parseLinks((data as any)?.social_links)));
  }, [userId]);

  async function save(next: string[]) {
    setLinks(next);
    await supabase.from("users").update({ social_links: next }).eq("id", userId);
  }

  function add() {
    setErr("");
    const v = normalizeLink(input);
    if (!v) return setErr("Это не похоже на ссылку. Вставьте адрес страницы.");
    if (links.includes(v)) return setErr("Эта ссылка уже добавлена.");
    if (links.length >= 6) return setErr("Можно добавить до 6 ссылок.");
    save([...links, v]);
    setInput("");
  }

  return (
    <div className="bg-bgSurface border border-muted rounded-xl p-4">
      <p className="text-offwhite font-semibold text-sm mb-1">Соцсети и сайты магазина</p>
      <p className="text-muted text-xs mb-3">Вставьте ссылку на Instagram, Telegram, TikTok, YouTube и другие. На странице магазина появится значок каждой сети. Можно добавить до 6.</p>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="https://instagram.com/ваш_магазин" className="flex-1 min-w-0 bg-bgPrimary text-offwhite border border-muted rounded-xl px-3 py-2.5 text-sm" />
        <button onClick={add} className="bg-gold text-bgPrimary font-semibold rounded-xl px-4 text-sm">Добавить</button>
      </div>
      {err && <p className="text-danger text-xs mt-2">{err}</p>}
      {links.length > 0 && (
        <div className="mt-3 flex flex-col">
          {links.map((u) => (
            <div key={u} className="flex items-center gap-3 py-2.5 border-t border-muted/40">
              <span className="w-9 h-9 rounded-full bg-bgPrimary border border-muted/60 flex items-center justify-center text-offwhite flex-none">
                <SocialIcon kind={socialKind(u)} size={18} />
              </span>
              <span className="flex-1 min-w-0 truncate text-muted text-xs">{u.replace(/^https?:\/\//, "")}</span>
              <button onClick={() => save(links.filter((x) => x !== u))} className="text-danger text-xs">Убрать</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
