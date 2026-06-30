import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WorkforceParticleCanvas } from "@/components/workforce-particle-canvas";
import { WorkspaceTopNav } from "@/components/shell/workspace-top-nav";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--home-bg)] text-[var(--home-text)]">
      <WorkforceParticleCanvas />
      <WorkspaceTopNav />
      <SidebarProvider className="relative z-10 h-[calc(100vh-6rem)] min-h-0">
        <div className="flex h-full w-full min-h-0">
          <AppSidebar />
          <SidebarInset className="min-w-0 flex-1 overflow-y-auto bg-transparent transition-[margin] duration-200 ease-linear md:peer-data-[state=collapsed]:ml-2">
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
