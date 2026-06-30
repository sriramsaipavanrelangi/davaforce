"use client";

import { usePathname } from "next/navigation";

export function AppFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const shouldHideFooter = pathname === "/workspace" || pathname?.startsWith("/dashboard");
  const shellWidth = pathname === "/ask" ? "max-w-[92rem]" : "max-w-6xl";

  if (shouldHideFooter) {
    return null;
  }

  return (
    <footer className="app-footer pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 text-[var(--home-muted)] transition-[opacity,transform] duration-200 sm:px-6 lg:px-8">
      <div
        className={`pointer-events-auto mx-auto flex h-11 ${shellWidth} items-center justify-between gap-4 rounded-2xl border border-[var(--home-border)] bg-[var(--home-panel)] px-5 text-xs shadow-xl shadow-black/10 backdrop-blur`}
      >
        <p className="min-w-0 truncate font-medium tracking-normal">
          <span aria-hidden="true">&copy; </span>
          <span>{year} </span>
          <span className="font-bold text-brand">Dava</span>
          <span className="font-bold text-[var(--home-text)]">Force</span>
        </p>
        <div className="flex shrink-0 items-center" aria-label="Endava">
          <img src="/assets/endava-logo-pos.svg" alt="Endava" className="h-5 w-auto dark:hidden" />
          <img src="/assets/endava-logo-white.svg" alt="Endava" className="hidden h-5 w-auto dark:block" />
        </div>
      </div>
    </footer>
  );
}
