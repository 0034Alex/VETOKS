"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Главная", icon: "👑" },
  { href: "/participants", label: "Участницы", icon: "👤" },
  { href: "/media", label: "Медиа", icon: "▶" },
  { href: "/tasks", label: "Задания", icon: "⭐" },
  { href: "/rating", label: "Рейтинг", icon: "📊" },
  { href: "/profile", label: "Профиль", icon: "👤" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bgSurface border-t border-muted flex justify-around py-2 z-50">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 text-[11px] font-medium px-1 ${
              active ? "text-gold" : "text-muted"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
