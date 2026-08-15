import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

export default function ShopPage() {
  return (
    <main className="min-h-screen pb-28">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo size={28} />
      </div>
      <div className="px-6 flex flex-col items-center justify-center text-center pt-16">
        <h1 className="text-3xl font-semibold text-gold mb-4">
          Магазин подарков
        </h1>
        <p className="text-muted max-w-sm">
          Здесь скоро появятся виртуальные подарки, которые можно дарить
          участницам. Раздел в разработке.
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
