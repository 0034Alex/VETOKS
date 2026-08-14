import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VETOKS CRM",
  icons: {
    icon: "/admin-icon-192.png",
    apple: "/admin-apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VETOKS CRM",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
