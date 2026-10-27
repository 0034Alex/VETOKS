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
import ShowTheme from "@/components/ShowTheme";
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(location.pathname.indexOf('/admin')===0)return;var pv=localStorage.getItem('vt_preview_token')||localStorage.getItem('vt_preview_id');var t=JSON.parse(localStorage.getItem(pv?'vt_show_theme_pv':'vt_show_theme')||'{}');var m={gold:'--c-gold',goldSoft:'--c-goldSoft',sec:'--c-sec',sec2:'--c-sec2',bg:'--c-bg',surface:'--c-surface'};for(var k in m){var h=t[k];if(h&&/^#[0-9a-f]{6}$/i.test(h)){var n=parseInt(h.slice(1),16);document.documentElement.style.setProperty(m[k],((n>>16)&255)+' '+((n>>8)&255)+' '+(n&255));}}}catch(e){}})();",
          }}
        />
      </head>
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
        <ShowTheme />
        <BroadcastPopup />
      </LangProvider>
      </body>
    </html>
  );
}
