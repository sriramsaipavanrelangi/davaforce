import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "DavaForce",
  description: "AI-assisted workforce planning with Excel upload and DavaForce APIs.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/assets/davaforce-logo-mark.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-14">
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
