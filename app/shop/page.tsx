import BottomNav from "@/components/BottomNav";

export default function ShopPage() {
  return (
    <main className="min-h-screen px-6 py-12 pb-24 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-semibold text-gold mb-4">
        Магазин подарков
      </h1>
      <p className="text-muted max-w-sm">
        Здесь скоро появятся виртуальные подарки, которые можно дарить
        участницам. Раздел в разработке.
      </p>
      <BottomNav />
    </main>
  );
}
