"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import {
  IconHome,
  IconUsers,
  IconPlay,
  IconGift,
  IconChart,
  IconProfile,
} from "./Icons";

const items = [
  { href: "/", label: "nav.home", Icon: IconHome },
  { href: "/participants", label: "nav.participants", Icon: IconUsers },
  { href: "/media", label: "nav.media", Icon: IconPlay },
  { href: "/shop", label: "nav.shop", Icon: IconGift },
  { href: "/rating", label: "nav.rating", Icon: IconChart },
  { href: "/profile", label: "nav.profile", Icon: IconProfile },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="bg-bgSurface border-t border-muted flex justify-center"
    >
      <div className="w-full max-w-3xl flex items-stretch">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${
                active ? "text-gold" : "text-muted"
              }`}
            >
              <span
                style={
                  active
                    ? { filter: "drop-shadow(0 0 4px rgba(201,162,39,0.8))" }
                    : undefined
                }
              >
                <item.Icon active={active} />
              </span>
              <span
                className="font-medium text-center leading-none"
                style={{ fontSize: "9px" }}
              >
                {t(item.label)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
