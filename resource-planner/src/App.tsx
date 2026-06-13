import { useState } from "react";
import {
  Briefcase,
  CalendarRange,
  ChartColumn,
  ChartNoAxesGantt,
  Gauge,
  LayoutDashboard,
  RotateCcw,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PlannerProvider, usePlanner } from "@/store";
import { Dashboard } from "@/components/Dashboard";
import { CapacityGrid } from "@/components/CapacityGrid";
import { ProjectsView } from "@/components/ProjectsView";
import { ResourcesView } from "@/components/ResourcesView";
import { TimelineView } from "@/components/TimelineView";
import { ReportsView } from "@/components/ReportsView";

type View = "dashboard" | "timeline" | "capacity" | "projects" | "resources" | "reports";

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "timeline", label: "Timeline", icon: ChartNoAxesGantt },
  { id: "capacity", label: "Capacity plan", icon: CalendarRange },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "resources", label: "Resources", icon: Users },
  { id: "reports", label: "Reports", icon: ChartColumn },
];

function Shell() {
  const [view, setView] = useState<View>("dashboard");
  const { resetToSeed } = usePlanner();
  const current = NAV.find((n) => n.id === view)!;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Gauge className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">OpenPlanner</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Portfolio planning
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Planning</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={view === id}
                      onClick={() => setView(id)}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={resetToSeed} tooltip="Reset demo data">
                <RotateCcw />
                <span>Reset demo data</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {/* min-w-0 keeps wide children (timeline, capacity grid) scrolling inside
          their own containers instead of stretching the page past the viewport */}
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">{current.label}</span>
        </header>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
          {view === "dashboard" && <Dashboard onGoToCapacity={() => setView("capacity")} />}
          {view === "timeline" && <TimelineView />}
          {view === "capacity" && <CapacityGrid />}
          {view === "projects" && <ProjectsView />}
          {view === "resources" && <ResourcesView />}
          {view === "reports" && <ReportsView />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <PlannerProvider>
      <Shell />
    </PlannerProvider>
  );
}
