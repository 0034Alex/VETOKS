"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser } from "@/lib/currentUser";

type Settings = {
  enabled: boolean;
  image_url: string | null;
  text: string | null;
  button_text: string | null;
  button_link: string | null;
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export default function EntryPopup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [show, setShow] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("popup_settings")
        .select("enabled, image_url, text, button_text, button_link")
        .eq("id", 1)
        .maybeSingle();

      if (!data || !data.enabled) return;
      setSettings(data as Settings);

      const u = await getCurrentUser();
      if (!u) return;
      setUserId(u.id);

      const { data: lastShow } = await supabase
        .from("popup_shows")
        .select("shown_at")
        .eq("user_id", u.id)
        .maybeSingle();

      const lastShownTime = lastShow ? new Date(lastShow.shown_at).getTime() : 0;
      const dueAgain = Date.now() - lastShownTime > THREE_DAYS_MS;

      if (dueAgain) {
        setShow(true);
        await supabase
          .from("popup_shows")
          .upsert({ user_id: u.id, shown_at: new Date().toISOString() });
      }
    })();
  }, []);

  if (!show || !settings) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center px-6"
      onClick={() => setShow(false)}
    >
      <div
        className="bg-bgSurface border border-gold/40 rounded-2xl overflow-hidden w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {settings.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.image_url} alt="" className="w-full aspect-square object-cover" />
        )}
        <div className="p-5">
          {settings.text && (
            <p className="text-offwhite text-sm mb-4">{settings.text}</p>
          )}
          {settings.button_text && settings.button_link && (
            <a
              href={settings.button_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gold text-bgPrimary font-semibold text-center py-3 rounded-full text-sm mb-2"
            >
              {settings.button_text}
            </a>
          )}
          <button
            onClick={() => setShow(false)}
            className="w-full text-muted text-xs py-2"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
