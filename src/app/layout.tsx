import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "katex/dist/katex.min.css";
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default:
      "Hệ thống học tập | Luyện thi Giáo dục Sài Gòn",
    template:
      "%s | Luyện thi Giáo dục Sài Gòn",
  },

  description:
    "Nền tảng học tập trực tuyến dành cho học sinh, giáo viên và phụ huynh của Luyện thi Giáo dục Sài Gòn.",

  applicationName:
    "Luyện thi Giáo dục Sài Gòn",

  authors: [
    {
      name: "Luyện thi Giáo dục Sài Gòn",
    },
  ],

  creator:
    "Luyện thi Giáo dục Sài Gòn",

  publisher:
    "Luyện thi Giáo dục Sài Gòn",

  robots: {
    index: false,
    follow: false,
  },
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
