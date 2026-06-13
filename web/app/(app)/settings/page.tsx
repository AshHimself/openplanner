"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEY = "openplanner_anthropic_key";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored) setApiKey(stored);
  }, []);

  function save() {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem(KEY, trimmed);
    } else {
      localStorage.removeItem(KEY);
    }
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  }

  function remove() {
    localStorage.removeItem(KEY);
    setApiKey("");
    setTestResult(null);
  }

  async function test() {
    const key = apiKey.trim();
    if (!key) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Say only: ok" }],
          context: "You are a test assistant.",
        }),
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  }

  const hasKey = !!apiKey.trim();

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your OpenPlanner preferences.
        </p>
      </div>

      {/* AI section */}
      <div className="space-y-4 rounded-lg border p-5">
        <div>
          <h3 className="font-medium">AI assistant</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Paste your Anthropic API key to enable the AI chat. The key is stored only in your
            browser&apos;s localStorage — it is never sent to or stored on our servers.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="api-key">Anthropic API key</Label>
          <div className="relative">
            <Input
              id="api-key"
              type={show ? "text" : "password"}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
              placeholder="sk-ant-api03-…"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Get a key at{" "}
            <span className="font-medium text-foreground">console.anthropic.com</span>. Starts with{" "}
            <code className="rounded bg-muted px-1 py-0.5">sk-ant-</code>.
          </p>
        </div>

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              testResult === "ok"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {testResult === "ok" ? "✓ API key is valid" : "✗ API key is invalid or has no credits"}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={save} size="sm" disabled={!hasKey}>
            {saved ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Saved
              </>
            ) : (
              "Save key"
            )}
          </Button>
          <Button onClick={test} size="sm" variant="outline" disabled={!hasKey || testing}>
            {testing ? "Testing…" : "Test connection"}
          </Button>
          {hasKey && (
            <Button
              onClick={remove}
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove key
            </Button>
          )}
        </div>
      </div>

      {/* Account info */}
      <div className="space-y-4 rounded-lg border p-5">
        <div>
          <h3 className="font-medium">Account</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            If you are using the default admin credentials, change your password immediately.
          </p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Default credentials: <code className="font-mono">admin@example.com</code> /{" "}
          <code className="font-mono">changeme123</code>. Update them in your database directly
          via <code className="font-mono">UPDATE users SET password_hash = … WHERE email = …</code>.
        </div>
      </div>
    </div>
  );
}
