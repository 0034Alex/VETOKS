"use client";
import { giftSvg } from "@/lib/giftArt";

// Нарисованный подарок по названию. Если рисунка нет — показывает запасной эмодзи.
export default function GiftArt({
  name,
  size = 48,
  fallback = "🎁",
  className = "",
}: {
  name: string;
  size?: number;
  fallback?: string;
  className?: string;
}) {
  const svg = giftSvg(name);
  if (!svg) {
    return (
      <span className={className} style={{ fontSize: size * 0.8, lineHeight: 1 }}>
        {fallback}
      </span>
    );
  }
  return (
    <span
      className={`ga ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
