import BottomNav from "@/components/BottomNav";
import PageHeader from "@/components/PageHeader";

const STEPS = [
  { emoji: "🔍", title: "Найдите участницу", text: "Смотрите анкеты в разделе «Участницы» — по региону, поиску или рейтингу." },
  { emoji: "👥", title: "Подпишитесь", text: "Подписка помогает не пропустить её новости и держит вас в курсе, как она выступает." },
  { emoji: "❤️", title: "Поддержите", text: "Голосуйте бесплатно, дарите виртуальные подарки или пишите личное сообщение." },
  { emoji: "📊", title: "Следите за рейтингом", text: "Раздел «Рейтинг» показывает лидеров сразу в нескольких категориях — не только по голосам." },
  { emoji: "👑", title: "Узнайте победительницу", text: "В конце сезона в «Зале славы» появятся титулы этого сезона — Мисс, Вице-мисс и другие." },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen pb-28">
      <PageHeader />
      <div className="px-6">
        <h1 className="text-2xl font-semibold text-gold mb-6 text-center">
          Как это работает
        </h1>

        <div className="flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="bg-bgSurface border border-muted rounded-xl p-4 flex gap-3 items-start"
            >
              <span className="text-3xl">{s.emoji}</span>
              <div>
                <p className="text-offwhite font-semibold text-sm mb-1">
                  {i + 1}. {s.title}
                </p>
                <p className="text-muted text-xs">{s.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-bgSurface border border-gold/40 rounded-xl p-4 text-center">
          <p className="text-muted text-xs">
            Голоса и подарки честно суммируются в общем зачёте, но не являются
            единственным критерием — жюри и этапы конкурса тоже играют роль.
          </p>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
