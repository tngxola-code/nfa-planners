import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFA Planners Console",
  description:
    "Internal opportunity-intelligence console: OCDS eTenders ingestion, capability matching, and email digests.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
