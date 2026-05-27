"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  variant?: "default" | "gradient" | "danger";
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  variant = "default",
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const getBarColor = () => {
    switch (variant) {
      case "gradient":
        return "bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-danger";
      case "danger":
        return "bg-gradient-to-r from-accent-warning to-accent-danger";
      default:
        return "bg-accent-primary";
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-center mb-1">
        {showLabel && (
          <>
            <span className="text-xs text-foreground-muted">Progress</span>
            <span className="text-xs text-foreground-muted">{percentage.toFixed(0)}%</span>
          </>
        )}
      </div>
      <div className="w-full h-2 bg-background-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getBarColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

