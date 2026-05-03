import type { Metadata } from "next";
import "./globals.css";

import { SessionProvider } from "@/components/session-provider";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-neutral-50">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
