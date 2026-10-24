import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import DevSwitcher from "@/components/DevSwitcher";

const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "בא לי - מה אוכלים היום?",
  description: "בא לי - עוזר תזונה אישי וחברותי לילדי המשפחה: כריכים לבית הספר, ארוחות ונשנושים מזינים.",
  manifest: "/manifest.json",
  applicationName: "בא לי",
  appleWebApp: { capable: true, title: "בא לי", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ff7d10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const devBypass = process.env.DEV_BYPASS_AUTH === "true";
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-sans antialiased">
        {devBypass && <DevSwitcher />}
        {children}
      </body>
    </html>
  );
}
