"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const MESSAGES = [
  "Reading capacity & roll-offs…",
  "Matching skills to demand…",
  "Working out the best moves…",
  "Spotting the staffing gaps…",
  "Drafting the action plan…",
];

const COLS = ["#0e7490", "#9a3412", "#4338ca"];

// Animated, on-theme placeholder: little "resource" tokens flow along a track
// and drop into "project" buckets while the AI computes the staffing plan.
export function ForecastAiLoader() {
  const [msg, setMsg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="overflow-hidden rounded-md border bg-gradient-to-br from-muted/30 to-background p-4">
      <style>{`
        @keyframes flowToken {
          0%   { transform: translateX(0) scale(1); opacity: 0; }
          12%  { opacity: 1; }
          70%  { transform: translateX(190px) scale(1); opacity: 1; }
          80%  { transform: translateX(205px) scale(0.4); opacity: 0; }
          100% { transform: translateX(205px) scale(0.4); opacity: 0; }
        }
        @keyframes bucketPulse {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(1.18); }
        }
        @keyframes sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
        @keyframes sparklePulse {
          0%,100% { opacity: .5; transform: scale(1); }
          50%     { opacity: 1; transform: scale(1.15); }
        }
        .ai-token { animation: flowToken 2.6s cubic-bezier(.5,0,.5,1) infinite; }
        .ai-bucket { animation: bucketPulse 1.3s ease-in-out infinite; transform-origin: bottom; }
        .ai-sweep { animation: sweep 2s linear infinite; }
        .ai-spark { animation: sparklePulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ai-token, .ai-bucket, .ai-sweep, .ai-spark { animation: none; }
        }
      `}</style>

      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="ai-spark h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI is planning your capacity</span>
      </div>

      <div className="relative" style={{ height: 92 }}>
        {/* sweeping shimmer */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="ai-sweep absolute inset-y-0 w-24"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
          />
        </div>

        {/* track + flowing resource tokens (3 lanes) */}
        {[0, 1, 2].map((lane) => (
          <div key={lane} className="absolute left-2" style={{ top: 8 + lane * 28 }}>
            <div className="relative h-5 w-[210px]">
              {/* dashed track */}
              <div
                className="absolute top-1/2 h-px w-[200px] -translate-y-1/2"
                style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--border)) 0 6px, transparent 6px 12px)" }}
              />
              {/* token */}
              <div
                className="ai-token absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-bold text-white shadow"
                style={{ backgroundColor: COLS[lane], animationDelay: `${lane * 0.5}s` }}
              >
                {["A", "B", "C"][lane]}
              </div>
            </div>
          </div>
        ))}

        {/* project buckets on the right */}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          {COLS.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className="ai-bucket h-4 w-8 rounded-sm"
                style={{ backgroundColor: c, opacity: 0.85, animationDelay: `${i * 0.3}s` }}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground transition-opacity">{MESSAGES[msg]}</p>
    </div>
  );
}
