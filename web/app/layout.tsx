import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";

import { SessionProvider } from "@/components/session-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ULS Stage Director PRO",
  description:
    "Universal Light & Sound — internal production desk and branded director portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} antialiased`}>
      <body className="min-h-full flex flex-col bg-transparent font-sans text-uls-text">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
