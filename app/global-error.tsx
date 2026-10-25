"use client";

import { useEffect, useState } from "react";
import { sendClientError } from "@/lib/errorReport";
import FunError from "@/components/FunError";

// Самая последняя страховка: если упало что-то на уровне всего приложения (раньше тут был белый экран).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [info, setInfo] = useState("");
  useEffect(() => {
    const msg = String(error?.message);
    sendClientError(`Приложение упало целиком: ${msg}`, { stack: error?.stack, where: window.location.pathname });
    setInfo(`${window.location.pathname} · ${error?.name ?? "Error"}: ${msg}`.slice(0, 160));
  }, [error]);
  return (
    <html lang="uk">
      <body style={{ margin: 0, background: "#0d0d0f" }}>
        <FunError info={info} />
      </body>
    </html>
  );
}
