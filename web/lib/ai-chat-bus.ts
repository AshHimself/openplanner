type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function onOpenAiChat(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function openAiChat() {
  listeners.forEach((fn) => fn());
}
