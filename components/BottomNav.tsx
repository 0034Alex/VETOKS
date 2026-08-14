"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/participants", label: "Конкурс" },
  { href: "/shop", label: "Магазин" },
  { href: "/profile", label: "Профиль" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bgSurface border-t border-muted flex justify-around py-3 z-50">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-medium ${
              active ? "text-gold" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
