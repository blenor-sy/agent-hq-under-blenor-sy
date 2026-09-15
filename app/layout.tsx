import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent HQ",
  description: "Live control room for your agents"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
