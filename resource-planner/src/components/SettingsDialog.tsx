import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlanner } from "@/store";

export function SettingsDialog() {
  const { settings, saveSettings } = usePlanner();
  const [open, setOpen] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(settings.aiEnabled);
  const [apiKey, setApiKey] = useState(settings.aiApiKey);

  function handleOpen() {
    // Sync form state from store when opening
    setAiEnabled(settings.aiEnabled);
    setApiKey(settings.aiApiKey);
    setOpen(true);
  }

  function save() {
    saveSettings({ aiEnabled, aiApiKey: apiKey.trim() });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Settings2 className="h-4 w-4" />
        <span>Settings</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* AI assistant toggle */}
            <div className="flex items-center justify-between rounded-md border px-3 py-3">
              <div>
                <div className="text-sm font-medium">AI Planning Assistant</div>
                <div className="text-xs text-muted-foreground">
                  Chat panel powered by Claude via a2ui
                </div>
              </div>
              <button
                role="switch"
                aria-checked={aiEnabled}
                onClick={() => setAiEnabled((v) => !v)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  aiEnabled ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    aiEnabled ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* API key — only shown when enabled */}
            {aiEnabled && (
              <div className="grid gap-1.5">
                <Label>Anthropic API key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Stored in localStorage only. Used for direct calls to the
                  Anthropic API from your browser — never sent anywhere else.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
