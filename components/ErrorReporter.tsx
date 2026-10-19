"use client";

import { useEffect } from "react";
import { sendClientError } from "@/lib/errorReport";

// Ловит ошибки в приложении у людей и сообщает владельцу (без личных данных).
const IGNORE = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|_next\/static|ResizeObserver|Script error|extension:|Non-Error promise rejection|AbortError|NetworkError|Failed to fetch|Load failed|cancelled/i;

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = String(e.message || "");
      if (!msg || IGNORE.test(msg) || IGNORE.test(String(e.filename || ""))) return;
      sendClientError(msg, { stack: (e.error && e.error.stack) || `${e.filename}:${e.lineno}` });
    };
    const onRej = (e: PromiseRejectionEvent) => {
      const r: any = e.reason;
      const msg = String((r && (r.message || r)) || "");
      if (!msg || IGNORE.test(msg)) return;
      sendClientError(msg, { stack: r && r.stack });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRej);
    };
  }, []);
  return null;
}
