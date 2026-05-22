import type { Metadata } from "next";
import { Rajdhani, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NoticeProvider } from "@/components/NoticeProvider";
import { TabContextProvider } from "@/contexts/TabContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AppShell from "@/components/AppShell";

const rajdhani = Rajdhani({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sofunny ArtFlow - AI 创作平台",
  description: "AI 驱动的图像创作平台",
  icons: {
    icon: "/brand/logo.png",
    shortcut: "/brand/logo.png",
    apple: "/brand/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`dark ${rajdhani.variable} ${inter.variable}`}>
      <body className="h-screen overflow-hidden">
        <ThemeProvider>
          <AuthProvider>
            <NoticeProvider>
              <TabContextProvider>
                <AppShell>{children}</AppShell>
              </TabContextProvider>
            </NoticeProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
