"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

/**
 * Переводит весь интерфейс «на лету»: берёт русские тексты на экране и подменяет их
 * на украинский / английский по словарю /i18n/{lang}.json.
 * Админка (/admin) не переводится — CRM остаётся на русском.
 */

type Entry = { orig: string; out: string };
type Dict = { exact: Map<string, string>; patterns: { re: RegExp; tpl: string }[] };

const cache: Record<string, Dict | undefined> = {};
const texts = new WeakMap<Node, Entry>();
const attrs = new WeakMap<Element, Record<string, Entry>>();
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE"]);

const norm = (s: string) => s.replace(/\{[a-zA-Z]+\}/g, "{}");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildDict(raw: Record<string, string>): Dict {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; tpl: string }[] = [];
  for (const k of Object.keys(raw)) {
    const nk = norm(k);
    const v = norm(raw[k]);
    if (nk.includes("{}")) {
      const re = new RegExp("^" + nk.split("{}").map(esc).join("(.+?)") + "$");
      let i = 0;
      patterns.push({ re, tpl: v.replace(/\{\}/g, () => "$" + ++i) });
    } else {
      exact.set(nk, v);
    }
  }
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, patterns };
}

function tr(text: string, d: Dict): string | null {
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  const core = text.trim().replace(/\s+/g, " ");
  if (!core || !/[А-Яа-яЁёІіЇїЄєҐґ]/.test(core)) return null;
  const hit = d.exact.get(core);
  if (hit != null) return lead + hit + trail;
  for (const p of d.patterns) {
    const pm = core.match(p.re);
    if (pm) {
      const out2 = p.tpl.replace(/\$(\d+)/g, (_x, i) => {
        const v = pm[Number(i)] ?? "";
        const h = d.exact.get(v.trim());
        return h != null ? h : v;
      });
      return lead + out2 + trail;
    }
  }
  // текст с хвостовой пунктуацией: «Подарков получено:» → ищем без «:»
  const tm = core.match(/^([\s\S]*?)([\s:.,;!?…]+)$/);
  if (tm && tm[1]) {
    const h2 = d.exact.get(tm[1]);
    if (h2 != null) return lead + h2 + tm[2] + trail;
  }
  // составные тексты: «Киев, Украина», «Поцелуй ×3», «Харьков · 12» — переводим по частям
  const parts = core.split(/(\s*[,·•—|/]\s*|\s*[×x]\s*(?=\d))/);
  if (parts.length > 1) {
    let any = false;
    const out = parts.map((x, i) => {
      if (i % 2 === 1 || !/[А-Яа-яЁёІіЇїЄєҐґ]/.test(x)) return x;
      const h = d.exact.get(x.trim());
      if (h != null) { any = true; return h; }
      return x;
    });
    if (any) return lead + out.join("") + trail;
  }
  return null;
}

// ── Автоперевод текстов из CRM (внутри элементов с data-tr) ──────────────────
const dyn = new Map<string, string>(); // "lang|текст" -> перевод (или он же, если перевода нет)
const dynQueue = new Map<string, Set<string>>();
let dynTimer: any = null;
let dynListeners = new Set<() => void>();

const UK_ONLY = /[іїєґІЇЄҐ]/;
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;

function needsDyn(core: string, lang: string): boolean {
  if (lang === "ru") return UK_ONLY.test(core);
  if (lang === "uk") return CYR.test(core) && !UK_ONLY.test(core);
  return CYR.test(core);
}

function dynLookup(core: string, lang: string): string | null {
  const k = lang + "|" + core;
  const v = dyn.get(k);
  if (v !== undefined) return v;
  let set = dynQueue.get(lang);
  if (!set) { set = new Set(); dynQueue.set(lang, set); }
  set.add(core);
  if (!dynTimer) dynTimer = setTimeout(flushDyn, 80);
  return null;
}

async function flushDyn() {
  dynTimer = null;
  const jobs = Array.from(dynQueue.entries());
  dynQueue.clear();
  for (const [lang, set] of jobs) {
    const all = Array.from(set);
    for (let i = 0; i < all.length; i += 40) {
      const chunk = all.slice(i, i + 40);
      let map: Record<string, string> = {};
      try {
        const r = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang, texts: chunk }),
        });
        const j = await r.json();
        map = j?.map ?? {};
      } catch {}
      for (const t of chunk) dyn.set(lang + "|" + t, map[t] ?? t);
    }
  }
  dynListeners.forEach((f) => f());
}

const inTr = (el: Element | null) => !!el && !!el.closest("[data-tr]");

export default function AutoTranslate() {
  const { lang } = useT();
  const path = usePathname() || "";
  const off = path.startsWith("/admin");

  useEffect(() => {
    let dict: Dict | null = null;
    let cancelled = false;
    let timer: any = null;
    let obs: MutationObserver | null = null;

    const skipEl = (el: Element | null): boolean => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        if (SKIP_TAGS.has(e.tagName)) return true;
        if (e.hasAttribute("data-notranslate")) return true;
        if ((e as HTMLElement).isContentEditable) return true;
      }
      return false;
    };

    const doText = (n: Text) => {
      let ent = texts.get(n);
      const cur = n.data;
      if (ent && cur === ent.out) {
        // не менялся Реактом
      } else {
        ent = { orig: cur, out: cur };
        texts.set(n, ent);
      }
      let want = ent.orig;
      if (dict) {
        const r = tr(ent.orig, dict);
        if (r != null) want = r;
      }
      const par = n.parentElement;
      if (want === ent.orig && par && inTr(par)) {
        const core = ent.orig.trim().replace(/\s+/g, " ");
        if (core && needsDyn(core, lang)) {
          const d = dynLookup(core, lang);
          if (d == null) {
            // ждём перевод — текст на секунду скрыт, чтобы не мелькал чужой язык
            par.setAttribute("data-trpending", "1");
          } else {
            const lead = ent.orig.match(/^\s*/)![0];
            const trail = ent.orig.match(/\s*$/)![0];
            want = lead + d + trail;
            par.removeAttribute("data-trpending");
          }
        }
      }
      if (want !== n.data) n.data = want;
      ent.out = want;
    };

    const doAttrs = (el: Element) => {
      let rec = attrs.get(el);
      for (const a of ATTRS) {
        const cur = el.getAttribute(a);
        if (cur == null) continue;
        if (!rec) { rec = {}; attrs.set(el, rec); }
        let ent = rec[a];
        if (!ent || cur !== ent.out) { ent = { orig: cur, out: cur }; rec[a] = ent; }
        let want = ent.orig;
        if (dict) {
          const r = tr(ent.orig, dict);
          if (r != null) want = r;
        }
        if (want !== cur) el.setAttribute(a, want);
        ent.out = want;
      }
    };

    const walk = (root: Node) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node: Node | null = root.nodeType === 1 || root.nodeType === 9 ? w.nextNode() : root;
      while (node) {
        if (node.nodeType === 3) {
          if (!skipEl(node.parentElement)) doText(node as Text);
        } else if (node.nodeType === 1) {
          const el = node as Element;
          if (SKIP_TAGS.has(el.tagName) || el.hasAttribute("data-notranslate")) {
            // пропускаем всё поддерево: встаём на его последний узел и идём дальше
            let last: Node = el;
            while (last.lastChild) last = last.lastChild;
            w.currentNode = last;
            node = w.nextNode();
            continue;
          }
          doAttrs(el);
        }
        node = w.nextNode();
      }
    };

    const run = () => {
      timer = null;
      if (!document.body) return;
      obs?.disconnect();
      try { walk(document.body); } catch {}
      obs?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    const schedule = () => {
      if (timer == null) timer = setTimeout(run, 60);
    };

    const start = async () => {
      {
        if (!cache[lang]) {
          try {
            const r = await fetch(`/i18n/${lang}.json?v=${Math.floor(Date.now() / 600000)}`, { cache: "no-cache" });
            if (!r.ok) throw new Error("no dict");
            cache[lang] = buildDict(await r.json());
          } catch { cache[lang] = { exact: new Map(), patterns: [] }; }
        }
        dict = cache[lang]!;
      }
      if (cancelled) return;
      obs = new MutationObserver(schedule);
      dynListeners.add(schedule);
      run();
    };

    if (off) {
      return;
    }
    start();
    return () => {
      cancelled = true;
      dynListeners.delete(schedule);
      if (timer) clearTimeout(timer);
      obs?.disconnect();
    };
  }, [lang, path, off]);

  return <style>{"[data-trpending]{visibility:hidden}"}</style>;
}
