"use client";

import { useEffect, useState } from "react";
import { sendClientError } from "@/lib/errorReport";
import FunError from "@/components/FunError";

// Если страница упала — весёлая заглушка с одной кнопкой «Перезагрузить»; причину отправляем разработчику.
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const [info, setInfo] = useState("");

  useEffect(() => {
    const msg = String(error?.message);
    // Устаревшие файлы после обновления — один раз перезагружаем страницу.
    if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("vt_chunk_reload")) {
          sessionStorage.setItem("vt_chunk_reload", "1");
          window.location.reload();
        }
      } catch {}
    } else {
      sendClientError(`Страница упала: ${msg}`, { stack: error?.stack, where: window.location.pathname });
    }
    setInfo(`${window.location.pathname} · ${error?.name ?? "Error"}: ${msg}`.slice(0, 160));
  }, [error]);

  return <FunError info={info} />;
}
