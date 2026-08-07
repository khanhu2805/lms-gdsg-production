import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "katex/dist/katex.min.css";
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LMS GDSG",
    template: "%s | LMS GDSG",
  },
  description:
    "Hệ thống quản lý học tập tự lưu trữ của Công ty Giáo dục Sài Gòn.",
  applicationName: "LMS GDSG",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#243467",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full bg-[#F5F7FB]">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
