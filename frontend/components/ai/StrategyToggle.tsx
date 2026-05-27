"use client";

import { cn } from "@/lib/utils";

interface StrategyToggleProps {
  strategy: "high-risk" | "low-risk";
  onChange: (strategy: "high-risk" | "low-risk") => void;
}

export function StrategyToggle({ strategy, onChange }: StrategyToggleProps) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      <button
        className={cn(
          "flex-1 py-3 px-6 text-sm font-medium transition-colors",
          strategy === "high-risk"
            ? "bg-background-card text-foreground"
            : "bg-transparent text-foreground-muted hover:text-foreground"
        )}
        onClick={() => onChange("high-risk")}
      >
        High-Risk Strategy
      </button>
      <button
        className={cn(
          "flex-1 py-3 px-6 text-sm font-medium transition-colors",
          strategy === "low-risk"
            ? "bg-accent-primary text-background"
            : "bg-transparent text-foreground-muted hover:text-foreground"
        )}
        onClick={() => onChange("low-risk")}
      >
        Low-Risk Strategy
      </button>
    </div>
  );
}

