import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cronye.app"),
  title: "Cronye | Premium Cron Automation",
  description:
    "A premium, local-first automation daemon engineered in Go. Control your ecosystem with precision timing, beautiful logs, and zero latency.",
  openGraph: {
    title: "Cronye | Premium Cron Automation",
    description:
      "Reliable local-first automation. Control your ecosystem with precision.",
    type: "website",
    url: "https://cronye.app",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cronye premium cron automation"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Cronye | Premium Cron Automation",
    description:
      "A premium, local-first automation daemon engineered in Go.",
    images: ["/opengraph-image"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
