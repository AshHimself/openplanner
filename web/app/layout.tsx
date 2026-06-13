import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenPlanner",
  description: "Multi-project resource planning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
