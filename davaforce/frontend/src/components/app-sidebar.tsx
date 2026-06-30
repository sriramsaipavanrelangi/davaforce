"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Briefcase,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Summary", view: "summary", url: "/dashboard?view=summary", icon: LayoutDashboard },
  { title: "Supply", view: "supply", url: "/dashboard?view=supply", icon: Users },
  { title: "Demand", view: "demand", url: "/dashboard?view=demand", icon: Briefcase },
  { title: "Staffing Fit", view: "staffing-fit", url: "/dashboard?view=staffing-fit", icon: Sparkles },
  { title: "Skills", view: "skills", url: "/dashboard?view=skills", icon: Wrench },
  { title: "EWA", view: "ewa", url: "/dashboard?view=ewa", icon: ShieldCheck },
];

function SidebarCollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 rounded-full bg-transparent p-0 text-[var(--home-muted)] shadow-none hover:bg-transparent hover:text-[var(--home-text)] focus-visible:ring-0 focus-visible:ring-offset-0"
      onClick={toggleSidebar}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
    </Button>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") ?? "summary";
  const collapsed = state === "collapsed";
  const toggleSizeRem = 2.25;
  const collapsedSidebarWidthRem = 4.5;
  const toggleInsetRem = collapsed ? (collapsedSidebarWidthRem - toggleSizeRem) / 2 : 0.85;
  const toggleTopRem = collapsed ? 0.7 : 0.85;
  const contentTopRem = collapsed ? toggleTopRem + toggleSizeRem + 0.45 : 1;

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      style={{ "--sidebar-width-icon": "4.5rem" } as CSSProperties}
      className="top-24 h-[calc(100svh-6rem)] [&_[data-sidebar=sidebar]]:rounded-[1.75rem] [&_[data-sidebar=sidebar]]:border [&_[data-sidebar=sidebar]]:border-[var(--home-border)] [&_[data-sidebar=sidebar]]:bg-[var(--home-panel)] [&_[data-sidebar=sidebar]]:shadow-[0_24px_70px_rgba(25,43,55,0.14)] [&_[data-sidebar=sidebar]]:backdrop-blur-xl"
    >
      <SidebarHeader className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0 p-0">
        <div
          className="absolute"
          style={{
            right: `${toggleInsetRem}rem`,
            top: `${toggleTopRem}rem`,
          }}
        >
          <div className="pointer-events-auto">
            <SidebarCollapseButton />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent
        className="smooth-chat-scroll px-3 pb-3 group-data-[collapsible=icon]:px-2"
        style={{ paddingTop: `${contentTopRem}rem` }}
      >
        <SidebarGroup className="group-data-[collapsible=icon]:px-0">
          <SidebarGroupContent>
            <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--home-muted)] group-data-[collapsible=icon]:hidden">
              Dashboard
            </div>
            <SidebarMenu className="gap-2">
              {primary.map((item) => {
                const active = pathname === "/dashboard" && activeView === item.view;

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="h-12 rounded-2xl border border-transparent px-3.5 text-[var(--home-muted)] transition-all duration-200 hover:border-[var(--home-border)] hover:bg-[var(--home-soft)] hover:text-[var(--home-text)] hover:shadow-[0_10px_24px_rgba(25,43,55,0.08)] data-[active=true]:border-[var(--home-border)] data-[active=true]:bg-[var(--home-panel-strong)] data-[active=true]:text-[var(--home-text)] data-[active=true]:font-semibold data-[active=true]:shadow-[0_14px_34px_rgba(25,43,55,0.1)] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-[1rem]"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
