"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/authClient";

// Зелёная точка «в сети» или «был(а) недавно». Если человек скрыл статус — ничего не показываем.
export default function PresenceLine({ userId, className = "" }: { userId: string; className?: string }) {
  const [state, setState] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await apiPost("/api/presence/get", { userId });
      if (alive && r?.ok) setState(r.state || "");
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!state) return null;
  const text = state === "online" ? "в сети" : state === "recent" ? "был(а) недавно" : "был(а) давно";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${state === "online" ? "text-success" : "text-muted"} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${state === "online" ? "bg-success" : "bg-muted/60"}`} />
      {text}
    </span>
  );
}
