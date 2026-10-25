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
        <script dangerouslySetInnerHTML={{ __html: '(function(){var L=[];function add(x){try{L.push(String(x).slice(0,200))}catch(e){}}\nwindow.addEventListener("error",function(e){add("err: "+(e.message||"")+" "+((e.target&&(e.target.src||e.target.href))||""))},true);\nwindow.addEventListener("unhandledrejection",function(e){add("rej: "+(e.reason&&(e.reason.message||e.reason)))});\ndocument.addEventListener("securitypolicyviolation",function(e){add("csp: "+e.violatedDirective+" "+e.blockedURI)});\nsetTimeout(function(){try{var t=(document.body.innerText||"").trim().length;if(t>15)return;\nvar d=document.createElement("div");d.setAttribute("data-notranslate","1");\nd.style.cssText="position:fixed;left:0;right:0;top:0;z-index:99999;background:#fff;color:#000;font:12px monospace;padding:12px;white-space:pre-wrap";\nd.textContent="VETOKS диагностика (пустая страница)\\n"+location.pathname+"\\nstate="+document.readyState+" text="+t+" html="+document.body.innerHTML.length+"\\n"+L.join("\\n");\ndocument.body.appendChild(d)}catch(e){}},5000)})();' }} />
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
