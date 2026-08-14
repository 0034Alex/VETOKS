import BottomNav from "@/components/BottomNav";

export default function MediaPage() {
  return (
    <main className="min-h-screen px-6 py-12 pb-24 flex flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-semibold text-gold mb-4">Медиа</h1>
      <p className="text-muted max-w-sm">
        Здесь будут ролики и фото участниц из соцсетей. Раздел появится,
        когда участницы начнут выкладывать контент.
      </p>
      <BottomNav />
    </main>
  );
}
