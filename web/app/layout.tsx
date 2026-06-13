import type { Metadata } from "next";
import "./globals.css";
import "./a2ui.css";
import { NavProgress } from "@/components/nav-progress";

export const metadata: Metadata = {
  title: "OpenPlanner",
  description: "Multi-project resource planning",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
