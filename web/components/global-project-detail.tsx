"use client";

import { useEffect, useState } from "react";
import { ProjectProfile } from "@/components/project-profile";
import { onOpenProjectDetail } from "@/lib/project-detail-bus";

// Mounted once in the app shell so the AI chat (or anything else) can open a
// project's detail slide-out from anywhere via the project-detail bus.
export function GlobalProjectDetail() {
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => onOpenProjectDetail((id) => setProjectId(id)), []);

  return (
    <ProjectProfile
      projectId={projectId}
      onOpenChange={(open) => {
        if (!open) setProjectId(null);
      }}
    />
  );
}
