"use client";

import Link from "next/link";

export default function ParticipationAgreementPage() {
  return (
    <main className="min-h-screen px-6 py-10 text-offwhite">
      <div className="max-w-2xl mx-auto">
        <Link href="/apply" className="text-gold text-sm underline">
          ← Назад к анкете
        </Link>

        <h1 className="text-2xl font-semibold text-gold mt-6 mb-4">
          Соглашение об участии и лицензия на контент
        </h1>

        <p className="text-muted text-sm leading-relaxed mb-4">
          Это предварительный текст-заглушка. Здесь будет размещён
          официальный текст соглашения для участниц конкурса — правила
          участия, порядок выбывания, условия выплат, а также лицензия,
          по которой участница разрешает платформе VETOKS использовать
          её фото и видео, загруженные в рамках конкурса, для показа в
          приложении и продвижения платформы.
        </p>
        <p className="text-muted text-sm leading-relaxed">
          Текст можно заменить на окончательный в любой момент — просто
          замените содержимое этой страницы, ссылка на неё и галочка при
          подаче анкеты останутся рабочими.
        </p>
      </div>
    </main>
  );
}
