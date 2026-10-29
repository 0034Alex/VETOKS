"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { giftSvgFlat, resolveArt } from "@/lib/giftArt";
import { ACCENT, FxEngine, GiftFxEvent, GiftFxLevel, levelOf, playSound, setGlobalSound, setSoundOn, soundOn, themeOf, vibrate } from "@/lib/giftFx";

type St = { e: GiftFxEvent; level: GiftFxLevel; theme: string; svg: string | null; combo: number; seq: number };

// Один на всё приложение (стоит в layout): слушает событие «vt-gift-fx» и показывает подарок.
export default function GiftFxHost() {
  const [st, setSt] = useState<St | null>(null);
  const [snd, setSnd] = useState(true);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<FxEngine | null>(null);
  const timer = useRef<any>(null);
  const last = useRef<{ name: string; t: number; combo: number }>({ name: "", t: 0, combo: 0 });
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("platform_settings").select("value").eq("key", "gift_fx_sound").maybeSingle();
        if (data && String(data.value) === "false") setGlobalSound(false);
      } catch {}
    })();
    const on = (ev: Event) => {
      const e = (ev as CustomEvent<GiftFxEvent>).detail;
      if (!e?.name) return;
      const level = levelOf(e);
      if (level === "off") return;
      const qty = Math.max(1, Number(e.qty) || 1);
      const now = Date.now();
      const l = last.current;
      const combo = l.name === e.name && now - l.t < 5200 ? l.combo + qty : qty;
      last.current = { name: e.name, t: now, combo };
      const key = resolveArt(e.name, e.art);
      const theme = themeOf(key ?? e.name, e.category);
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      seq.current += 1;
      setSnd(soundOn());
      setSt({ e, level, theme, svg: key ? giftSvgFlat(key) : null, combo, seq: seq.current });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSt(null), level === "full" ? 4400 : 2600);
      playSound(theme, level);
      vibrate(level);
      setTimeout(() => {
        if (reduce || !cvRef.current) return;
        if (!eng.current) eng.current = new FxEngine(cvRef.current);
        eng.current.play(theme, level, combo > qty);
      }, 30);
    };
    window.addEventListener("vt-gift-fx", on);
    return () => { window.removeEventListener("vt-gift-fx", on); clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    if (!st) { eng.current?.stop(); eng.current = null; }
  }, [st]);

  if (!st) return null;
  const full = st.level === "full";
  const vip = st.e.category === "vip" || (full && st.combo >= 5);
  const acc = ACCENT[st.theme] ?? "#ffd54a";
  const close = () => { clearTimeout(timer.current); setSt(null); };
  return (
    <div className={`gfx ${full ? "gfx-full" : "gfx-mini"} ${vip ? "gfx-shake" : ""}`} style={{ ["--ac" as any]: acc }} onClick={full ? close : undefined}>
      {full && <div className="gfx-bg" />}
      {full && <div className="gfx-rays" />}
      <canvas ref={cvRef} className="gfx-cv" />
      {vip && <div key={"f" + st.seq} className="gfx-flash" />}
      <div key={"a" + st.seq} className="gfx-art">
        {st.svg ? <span dangerouslySetInnerHTML={{ __html: st.svg }} /> : <span className="gfx-emoji">{st.e.emoji || "🎁"}</span>}
      </div>
      <div key={"c" + st.seq} className="gfx-cap">
        <div className="gfx-who">
          {st.e.avatar ? <img src={st.e.avatar} alt="" /> : null}
          <i>{st.e.to ? `Вы подарили · ${st.e.to}` : "Вы подарили"}</i>
        </div>
        <b>{st.e.name}</b>
        {st.combo > 1 && <em key={"n" + st.combo}>×{st.combo}</em>}
      </div>
      {full && (
        <button
          className="gfx-snd"
          onClick={(ev) => { ev.stopPropagation(); const v = !snd; setSnd(v); setSoundOn(v); }}
          aria-label="Звук"
        >
          {snd ? "🔊" : "🔇"}
        </button>
      )}
    </div>
  );
}
