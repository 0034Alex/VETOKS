"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconUsers,
  IconPlay,
  IconStar,
  IconChart,
  IconProfile,
} from "./Icons";

const items = [
  { href: "/", label: "Главная", Icon: IconHome },
  { href: "/participants", label: "Участницы", Icon: IconUsers },
  { href: "/media", label: "Медиа", Icon: IconPlay },
  { href: "/tasks", label: "Задания", Icon: IconStar },
  { href: "/rating", label: "Рейтинг", Icon: IconChart },
  { href: "/profile", label: "Профиль", Icon: IconProfile },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-bgSurface border-t border-muted flex justify-center z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-3xl flex justify-around py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[11px] font-medium px-2 ${
                active ? "text-gold" : "text-muted"
              }`}
            >
              <item.Icon active={active} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
