import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;

export default async function Home() {
  const { data: regions, error } = await supabase
    .from("regions")
    .select("name, slug")
    .order("name");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-wide text-gold mb-4">
        VETOKS
      </h1>
      <p className="text-muted max-w-md mb-8">
        Платформа цифровых конкурсов.
      </p>

      {error && (
        <p className="text-danger max-w-md">
          Не удалось подключиться к базе: {error.message}
        </p>
      )}

      {!error && (
        <div className="text-offwhite">
          <p className="text-muted mb-2">Регионы в базе:</p>
          {regions && regions.length > 0 ? (
            <ul className="space-y-1">
              {regions.map((r) => (
                <li key={r.slug} className="text-gold">
                  {r.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Пока пусто — добавьте регионы через SQL Editor.</p>
          )}
        </div>
      )}
    </main>
  );
}
