"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

// Текст документа (соглашение, оферта, политика), который показывается при регистрации и подаче анкеты.
export default function PublicDocPage() {
  const params = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<{ title: string; content: string; version: number; updated_at: string | null } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/documents/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: params.id }),
        });
        const j = await r.json();
        if (j?.ok) setDoc(j.doc);
        else setMissing(true);
      } catch {
        setMissing(true);
      }
    })();
  }, [params.id]);

  if (!doc && !missing) return <LoadingScreen />;

  return (
    <main className="min-h-screen px-6 py-10 text-offwhite">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.back()} className="text-gold text-sm underline">
          ← Назад
        </button>
        {missing || !doc ? (
          <p className="text-muted mt-8">Документ не найден.</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gold mt-6 mb-1">{doc.title}</h1>
            <p className="text-muted text-xs mb-5">
              Версия {doc.version}
              {doc.updated_at ? ` · от ${new Date(doc.updated_at).toLocaleDateString("ru-RU")}` : ""}
            </p>
            <div className="text-offwhite/90 text-sm leading-relaxed whitespace-pre-wrap">{doc.content}</div>
          </>
        )}
      </div>
    </main>
  );
}
