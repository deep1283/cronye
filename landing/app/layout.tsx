import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cronye.app"),
  title: "Cronye | Open-Source Cron Automation",
  description:
    "A local-first open-source automation daemon engineered in Go. Run reliable schedules with clear logs and retries on your own system.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: ["/icon.png"],
    apple: [{ url: "/apple-icon.png", type: "image/png" }]
  },
  openGraph: {
    title: "Cronye | Open-Source Cron Automation",
    description:
      "Reliable local-first automation. Control your ecosystem with precision.",
    type: "website",
    url: "https://cronye.app",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Cronye open-source cron automation"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Cronye | Open-Source Cron Automation",
    description:
      "A local-first open-source automation daemon engineered in Go.",
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
