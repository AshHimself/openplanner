import { useState } from "react";
import { Briefcase, CalendarRange, LayoutDashboard, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlannerProvider, usePlanner } from "@/store";
import { Dashboard } from "@/components/Dashboard";
import { CapacityGrid } from "@/components/CapacityGrid";
import { ProjectsView } from "@/components/ProjectsView";
import { ResourcesView } from "@/components/ResourcesView";

type View = "dashboard" | "capacity" | "projects" | "resources";

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "capacity", label: "Capacity plan", icon: CalendarRange },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "resources", label: "Resources", icon: Users },
];

function Shell() {
  const [view, setView] = useState<View>("dashboard");
  const { resetToSeed } = usePlanner();

  return (
    <div className="flex min-h-screen bg-stone-100 text-stone-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-stone-800 bg-stone-900 text-stone-100">
        <div className="border-b border-stone-800 px-4 py-4">
          <div className="font-semibold tracking-tight">OpenPlanner</div>
          <div className="text-xs text-stone-400">Portfolio resource planning</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                view === id
                  ? "bg-teal-700 text-white"
                  : "text-stone-300 hover:bg-stone-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-stone-800 p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2.5 text-stone-400 hover:bg-stone-800 hover:text-white"
            onClick={resetToSeed}
          >
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </Button>
          <div className="px-3 pt-2 text-[10px] text-stone-500">v1 · local data only</div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6">
        {view === "dashboard" && <Dashboard onGoToCapacity={() => setView("capacity")} />}
        {view === "capacity" && <CapacityGrid />}
        {view === "projects" && <ProjectsView />}
        {view === "resources" && <ResourcesView />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <PlannerProvider>
      <Shell />
    </PlannerProvider>
  );
}
