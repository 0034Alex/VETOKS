/** @type {import('next').NextConfig} */

// Защитные заголовки для всех страниц.
// frame-ancestors: сайт можно встраивать только в Telegram (мини-приложение), чужим сайтам нельзя.
// Откуда странице разрешено грузить скрипты, картинки и куда ходить за данными.
// Всё остальное браузер блокирует: чужой скрипт не запустится и данные на чужой сайт не уйдут.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://telegram.org https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://video.bunnycdn.com https://*.b-cdn.net https://challenges.cloudflare.com https://telegram.org",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: CSP + "frame-ancestors 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://telegram.org; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Клан: не кэшируем страницу в браузере (после «назад» приходил пустой экран)
      { source: "/region-clan", headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
