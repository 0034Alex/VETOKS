import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-wide text-gold mb-4">
        VETOKS
      </h1>
      <p className="text-muted max-w-md mb-8">
        Платформа цифровых конкурсов. Регистрируйся и выбирай свой регион.
      </p>
      <Link
        href="/register"
        className="bg-gold text-bgPrimary font-semibold px-8 py-3 rounded-full hover:bg-goldSoft transition-colors"
      >
        Начать
      </Link>
    </main>
  );
}
