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
    if (p.re.test(core)) return lead + core.replace(p.re, p.tpl) + trail;
  }
  return null;
}

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
      if (lang !== "ru" && dict) {
        const r = tr(ent.orig, dict);
        if (r != null) want = r;
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
        if (lang !== "ru" && dict) {
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
            // пропускаем всё поддерево
            let next: Node | null = el.nextSibling;
            let p: Node | null = el;
            while (!next && p && p !== root) { p = p.parentNode; next = p ? p.nextSibling : null; }
            node = next && root.contains(next) ? next : null;
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
      if (lang !== "ru") {
        if (!cache[lang]) {
          try {
            const r = await fetch(`/i18n/${lang}.json`);
            cache[lang] = buildDict(await r.json());
          } catch { cache[lang] = { exact: new Map(), patterns: [] }; }
        }
        dict = cache[lang]!;
      }
      if (cancelled) return;
      obs = new MutationObserver(schedule);
      run();
    };

    if (off) {
      return;
    }
    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      obs?.disconnect();
    };
  }, [lang, path, off]);

  return null;
}
