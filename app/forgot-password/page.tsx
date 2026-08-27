import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <PageHeader />
      <h1 className="text-2xl font-semibold text-gold mb-4">
        Восстановление пароля
      </h1>
      <p className="text-muted text-sm max-w-sm mb-6">
        Этот раздел скоро заработает через нашего Telegram-бота. Пока — если
        забыли пароль, напишите в раздел «Помощь и поддержка» из профиля, и
        мы поможем вручную.
      </p>
      <Link href="/support" className="text-gold underline text-sm">
        Перейти в поддержку
      </Link>
    </main>
  );
}
