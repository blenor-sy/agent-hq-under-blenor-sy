import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Agent HQ", template: "%s · Agent HQ" },
  description: "A secure, truthful control room for your AI agents.",
  applicationName: "Agent HQ",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
