"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { formatPercentage, cn } from "@/lib/utils";
import type { TopPerformer } from "@/lib/types";

interface TopPerformersProps {
  performers: TopPerformer[];
}

export function TopPerformers({ performers }: TopPerformersProps) {
  const getInitial = (symbol: string) => symbol.charAt(0).toUpperCase();

  const getInitialColor = (index: number) => {
    const colors = [
      "bg-accent-primary",
      "bg-accent-secondary",
      "bg-accent-warning",
      "bg-accent-success",
    ];
    return colors[index % colors.length];
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top Performing Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {performers.map((performer, index) => (
            <div key={performer.symbol} className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                  getInitialColor(index)
                )}
              >
                {getInitial(performer.symbol)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {performer.name}
                </p>
                <p className="text-xs text-foreground-muted">
                  ({performer.symbol})
                </p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    performer.changePercentage >= 0
                      ? "text-accent-success"
                      : "text-accent-danger"
                  )}
                >
                  {formatPercentage(performer.changePercentage)}
                </p>
                <div className="w-16 h-1.5 bg-background-secondary rounded-full mt-1">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      performer.changePercentage >= 0
                        ? "bg-accent-primary"
                        : "bg-accent-danger"
                    )}
                    style={{
                      width: `${Math.min(Math.abs(performer.changePercentage) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

