"use client";

import Link from "next/link";

export default function OfferPage() {
  return (
    <main className="min-h-screen px-6 py-10 text-offwhite">
      <div className="max-w-2xl mx-auto">
        <Link href="/register" className="text-gold text-sm underline">
          ← Назад к регистрации
        </Link>

        <h1 className="text-2xl font-semibold text-gold mt-6 mb-4">
          Пользовательское соглашение и публичная оферта
        </h1>

        <p className="text-muted text-sm leading-relaxed mb-4">
          Это предварительный текст-заглушка. Здесь будет размещён
          официальный текст пользовательского соглашения и публичной
          оферты платформы VETOKS — условия использования приложения,
          порядок оплаты внутренних покупок (голоса, подарки, бусты и
          т.п.), права и обязанности пользователя и правила возврата
          средств.
        </p>
        <p className="text-muted text-sm leading-relaxed">
          Текст можно заменить на окончательный в любой момент — просто
          замените содержимое этой страницы, ссылка на неё и галочка при
          регистрации останутся рабочими.
        </p>
      </div>
    </main>
  );
}
