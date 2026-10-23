import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AuthGate from "@/components/AuthGate";
import VerifyPhonePopup from "@/components/VerifyPhonePopup";
import ReferralCapture from "@/components/ReferralCapture";
import { LangProvider } from "@/lib/i18n";
import AutoTranslate from "@/components/AutoTranslate";
import ChunkReload from "@/components/ChunkReload";
import ScrollGuard from "@/components/ScrollGuard";
import ErrorReporter from "@/components/ErrorReporter";
import PresenceBeat from "@/components/PresenceBeat";
import BirthPopup from "@/components/BirthPopup";
import BroadcastPopup from "@/components/BroadcastPopup";

export const metadata: Metadata = {
  title: "VETOKS",
  description: "Платформа цифровых конкурсов VETOKS",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VETOKS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body className="bg-bgPrimary">
        <LangProvider>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <AuthGate>{children}</AuthGate>
        <VerifyPhonePopup />
        <ReferralCapture />
        <AutoTranslate />
        <ServiceWorkerRegister />
        <ChunkReload />
        <ScrollGuard />
        <ErrorReporter />
        <PresenceBeat />
        <BirthPopup />
        <BroadcastPopup />
      </LangProvider>
      </body>
    </html>
  );
}
