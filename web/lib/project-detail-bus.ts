type Listener = (projectId: string) => void;
const listeners: Set<Listener> = new Set();

export function onOpenProjectDetail(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openProjectDetail(projectId: string) {
  listeners.forEach((fn) => fn(projectId));
}
