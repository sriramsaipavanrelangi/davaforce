"use client";

import { Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";

type Props = {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  action?: React.ReactNode;
};

export function AppTopbar({ title, subtitle, showSearch = false, action }: Props) {
  return (
    <header className="relative z-20 mx-5 mt-5 flex items-center gap-4 rounded-2xl border border-[var(--home-border)] bg-[var(--home-panel)] px-5 py-4 shadow-2xl shadow-black/10 backdrop-blur md:mx-6">
      <SidebarTrigger className="shrink-0 text-[var(--home-text)] hover:bg-[var(--home-soft)]" />
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl font-semibold tracking-tight text-[var(--home-text)]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 truncate text-sm text-[var(--home-muted)]">{subtitle}</p> : null}
      </div>
      {showSearch ? (
        <div className="relative hidden w-72 lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
          <Input
            placeholder="Search people, opportunities..."
            className="h-10 border-[var(--home-border)] bg-[var(--home-soft)] pl-9 text-[var(--home-text)]"
          />
        </div>
      ) : null}
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </header>
  );
}
