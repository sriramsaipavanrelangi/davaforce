import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { AppFooter } from "../../frontend/src/components/app-footer";
import "../../frontend/src/app/globals.css";

export const metadata: Metadata = {
  title: "DavaForce",
  description: "AI-assisted workforce planning with Excel upload and DavaForce APIs.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/assets/davaforce-logo-mark.png",
  },
};

const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("workforceTheme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme === "dark" || (storedTheme !== "light" && prefersDark) ? "dark" : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="pb-14">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {children}
        <AppFooter />
      </body>
    </html>
  );
}
