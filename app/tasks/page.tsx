import BottomNav from "@/components/BottomNav";

export default function TasksPage() {
  return (
    <main className="min-h-screen px-6 py-12 pb-24 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-semibold text-gold mb-4">Задания</h1>
      <p className="text-muted max-w-sm">
        Здесь появятся ежедневные задания для участниц и зрителей —
        приглашения друзей, активность, челленджи.
      </p>
      <BottomNav />
    </main>
  );
}
