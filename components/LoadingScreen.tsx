import Logo from "./Logo";

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-bgPrimary">
      <Logo size={56} />
      <div className="w-10 h-10 rounded-full border-4 border-bgSurface border-t-gold animate-spin" />
    </div>
  );
}
