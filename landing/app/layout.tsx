import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cronye.app"),
  title: "Cronye | Local-First Cron Automation",
  description:
    "Reliable automations on your own machine. Schedule shell and webhook jobs, retries, logs, and cleanup controls without cloud lock-in.",
  openGraph: {
    title: "Cronye | Local-First Cron Automation",
    description:
      "Reliable automations on your own machine. No cloud lock-in.",
    type: "website",
    url: "https://cronye.app",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cronye local-first cron automation"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Cronye | Local-First Cron Automation",
    description:
      "Schedule shell and webhook automations with retries, logs, and retention controls.",
    images: ["/opengraph-image"]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
