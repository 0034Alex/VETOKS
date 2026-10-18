"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyCountry } from "@/lib/myCountry";

// Сбор статистики рекламы. Что считаем:
//  impression — реклама отрисована на странице;
//  view       — её реально видели: ≥50% на экране не меньше 1 секунды;
//  dwell      — сколько миллисекунд реклама была на экране;
//  click      — нажали;  swipe — пролистали вручную;
//  skip       — отрисована, но так и не была увидена (промотали мимо);
//  close      — закрыли (окно при входе).
export type AdKind = "impression" | "view" | "dwell" | "click" | "swipe" | "skip" | "close";
export type AdType = "banner" | "logo" | "magazine" | "popup" | "ticker" | "directory";
export type AdMeta = { type: AdType; id: string; placement?: string; position?: number };

type Ev = {
  kind: AdKind;
  type: AdType;
  id: string;
  placement?: string;
  position?: number;
  value?: number;
  t: number;
};

// ---------- сессия и контекст ----------
function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
function ssGet(k: string): string | null {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
function ssSet(k: string, v: string) {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

function rnd() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sessionId(): string {
  let s = ssGet("ad_sid");
  if (!s) {
    s = rnd();
    ssSet("ad_sid", s);
  }
  return s;
}

// «Новый» — первый визит этого устройства за последние сутки.
function isNewVisitor(): boolean {
  const first = lsGet("ad_first");
  if (!first) {
    lsSet("ad_first", String(Date.now()));
    return true;
  }
  return Date.now() - Number(first) < 86400000;
}

function platform(): string {
  if (typeof window === "undefined") return "web";
  const w: any = window;
  const tg = w.Telegram?.WebApp;
  if (tg?.initData) return "tg-" + (tg.platform || "app");
  const ua = navigator.userAgent || "";
  const standalone = w.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as any).standalone;
  const base = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "desktop";
  return standalone ? base + "-pwa" : base;
}

function sourceOf(): string {
  const k = "ad_src";
  let s = ssGet(k);
  if (s === null) {
    try {
      const q = new URLSearchParams(location.search);
      s = q.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname : "") || "direct";
    } catch {
      s = "direct";
    }
    ssSet(k, s);
  }
  return s;
}

let ctxCache: { at: number; country: string | null; region: string | null; logged: boolean } | null = null;
async function context() {
  if (ctxCache && Date.now() - ctxCache.at < 60000) return ctxCache;
  let country: string | null = null;
  let region: string | null = null;
  let logged = false;
  try {
    const { data: s } = await supabase.auth.getSession();
    logged = !!s.session;
    if (s.session) {
      country = (await getMyCountry()).countryId;
      const { data: u } = await supabase.from("users").select("region_id").eq("id", s.session.user.id).maybeSingle();
      region = (u?.region_id as string) ?? null;
    }
  } catch {
    /* без контекста */
  }
  ctxCache = { at: Date.now(), country, region, logged };
  return ctxCache;
}

// ---------- отправка пачками ----------
let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush(useBeacon = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const events = queue.slice(0, 60);
  queue = queue.slice(60);
  const c = await context();
  const payload = {
    events,
    session: sessionId(),
    platform: platform(),
    isNew: isNewVisitor(),
    loggedIn: c.logged,
    country: c.country,
    region: c.region,
    source: sourceOf(),
  };
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const body = JSON.stringify(payload);
    if (useBeacon && !token && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
  if (queue.length) setTimeout(() => flush(useBeacon), 200);
}

function enqueue(e: Omit<Ev, "t">) {
  if (typeof window === "undefined") return;
  queue.push({ ...e, t: Date.now() });
  if (queue.length >= 30) flush();
  else if (!timer) timer = setTimeout(() => flush(), 3000);
}

// ---------- «один раз за визит» ----------
function seen(key: string): boolean {
  try {
    const list: string[] = JSON.parse(ssGet("ad_seen2") || "[]");
    return list.includes(key);
  } catch {
    return false;
  }
}
function markSeen(key: string) {
  try {
    const list: string[] = JSON.parse(ssGet("ad_seen2") || "[]");
    if (!list.includes(key)) ssSet("ad_seen2", JSON.stringify(list.concat(key).slice(-400)));
  } catch {
    /* ignore */
  }
}
const keyOf = (m: AdMeta) => `${m.type}:${m.id}:${m.placement ?? ""}`;

// ---------- наблюдатель за одной рекламой ----------
const live = new Set<AdWatch>();

export class AdWatch {
  private intersect = false;
  private since = 0;
  private acc = 0;
  private viewTimer: ReturnType<typeof setTimeout> | null = null;
  private viewedHere = false;
  private ended = false;

  constructor(private meta: AdMeta) {
    live.add(this);
    if (!seen("i:" + keyOf(meta))) {
      markSeen("i:" + keyOf(meta));
      enqueue({ kind: "impression", ...meta });
    }
  }

  /** Реклама сейчас на экране (≥50%). */
  setIntersecting(v: boolean) {
    this.intersect = v;
    this.recheck();
  }

  recheck() {
    if (this.ended) return;
    const visible = this.intersect && (typeof document === "undefined" || !document.hidden);
    const now = Date.now();
    if (visible && !this.since) {
      this.since = now;
      if (!this.viewedHere && !this.viewTimer) {
        this.viewTimer = setTimeout(() => {
          this.viewTimer = null;
          this.viewedHere = true;
          if (!seen("v:" + keyOf(this.meta))) {
            markSeen("v:" + keyOf(this.meta));
            enqueue({ kind: "view", ...this.meta });
          }
        }, 1000);
      }
    } else if (!visible && this.since) {
      this.acc += now - this.since;
      this.since = 0;
      if (this.viewTimer) {
        clearTimeout(this.viewTimer);
        this.viewTimer = null;
      }
    }
  }

  click() {
    enqueue({ kind: "click", ...this.meta });
    flush(true);
  }
  swipe() {
    enqueue({ kind: "swipe", ...this.meta });
  }
  close() {
    enqueue({ kind: "close", ...this.meta });
  }

  /** Реклама ушла со страницы: фиксируем время на экране и «промотали мимо». */
  end() {
    if (this.ended) return;
    this.intersect = false;
    this.recheck();
    this.ended = true;
    live.delete(this);
    if (this.acc >= 300) enqueue({ kind: "dwell", ...this.meta, value: Math.min(this.acc, 600000) });
    if (!this.viewedHere && !seen("v:" + keyOf(this.meta)) && this.acc < 1000) enqueue({ kind: "skip", ...this.meta });
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    live.forEach((w) => w.recheck());
    if (document.hidden) flush(true);
  });
  window.addEventListener("pagehide", () => {
    live.forEach((w) => w.end());
    flush(true);
  });
}

// ---------- хук: следит за блоком на экране ----------
export function useAdWatch<T extends HTMLElement>(meta: AdMeta | null, deps: unknown[] = []) {
  const ref = useRef<T | null>(null);
  const watch = useRef<AdWatch | null>(null);
  useEffect(() => {
    if (!meta || !ref.current) return;
    const w = new AdWatch(meta);
    watch.current = w;
    const io = new IntersectionObserver((es) => es.forEach((e) => w.setIntersecting(e.isIntersecting && e.intersectionRatio >= 0.5)), {
      threshold: [0, 0.5, 1],
    });
    io.observe(ref.current);
    return () => {
      io.disconnect();
      w.end();
      watch.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.type, meta?.id, meta?.placement, ...deps]);
  return { ref, watch };
}

/** Разовый клик по рекламе, у которой нет своего наблюдателя. */
export function trackAdClick(meta: AdMeta) {
  enqueue({ kind: "click", ...meta });
  flush(true);
}

// Ссылка с метками, чтобы рекламодатель видел переходы у себя в аналитике.
export function withUtm(url: string | null | undefined, m: AdMeta): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "vetoks");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", m.type);
    if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", m.id.slice(0, 8));
    return u.toString();
  } catch {
    return url;
  }
}
