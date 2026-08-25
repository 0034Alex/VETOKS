import Logo from "./Logo";

export default function PageHeader() {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
    >
      <Logo size={28} />
    </div>
  );
}
