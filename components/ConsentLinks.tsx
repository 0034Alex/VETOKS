"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMyCountry } from "@/lib/myCountry";

type D = { id: string; title: string };

// Текст рядом с галочкой согласия: ссылки на документы, отмеченные в CRM.
// Пока в CRM ничего не отмечено — показываем прежнюю ссылку-заглушку.
export default function ConsentLinks({ place, fallbackHref, fallbackText, countryId }: { place: "register" | "apply"; fallbackHref: string; fallbackText: string; countryId?: string | null }) {
  const [docs, setDocs] = useState<D[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cid = countryId !== undefined ? countryId : (await getMyCountry()).countryId;
        const r = await fetch("/api/documents/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place, countryId: cid }),
        });
        const j = await r.json();
        setDocs(j?.ok ? j.docs : []);
      } catch {
        setDocs([]);
      }
    })();
  }, [place, countryId]);

  if (!docs || docs.length === 0) {
    return (
      <Link href={fallbackHref} className="text-gold underline">
        {fallbackText}
      </Link>
    );
  }
  return (
    <>
      {docs.map((d, i) => (
        <span key={d.id}>
          {i > 0 ? (i === docs.length - 1 ? " и " : ", ") : ""}
          <Link href={`/legal/doc/${d.id}`} className="text-gold underline">
            {d.title}
          </Link>
        </span>
      ))}
    </>
  );
}
