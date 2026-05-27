"use client";

import { Card, CardContent } from "@/components/ui";
import { TrendingUp, Pause, TrendingDown } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

interface RecommendationsProps {
  recommendations: Recommendation[];
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  const getTypeConfig = (type: Recommendation["type"]) => {
    switch (type) {
      case "buy":
        return { icon: TrendingUp, color: "text-accent-success", label: "BUY" };
      case "hold":
        return { icon: Pause, color: "text-accent-warning", label: "HOLD" };
      case "sell":
        return { icon: TrendingDown, color: "text-accent-danger", label: "SELL" };
    }
  };

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">Market Signals</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec, index) => {
          const config = getTypeConfig(rec.type);
          const Icon = config.icon;
          const signalDateStr = formatDate(rec.signalDate);
          const lastActionDateStr = formatDate(rec.lastActionDate);

          return (
            <Card key={`${rec.asset}-${index}`}>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("w-5 h-5", config.color)} />
                  <span className={cn("font-semibold", config.color)}>{config.label}</span>
                </div>

                <p className="font-medium text-foreground">
                  {rec.asset}{rec.symbol ? ` (${rec.symbol})` : ""}
                </p>

                {/* BUY signal layout */}
                {rec.type === "buy" && (
                  <>
                    {(rec.signalPrice != null || signalDateStr) && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Generated:{" "}
                        {signalDateStr && <span className="text-foreground">{signalDateStr}</span>}
                        {signalDateStr && rec.signalPrice != null && " at "}
                        {rec.signalPrice != null && (
                          <span className="text-foreground">{formatCurrency(rec.signalPrice)}</span>
                        )}
                      </p>
                    )}
                    {rec.targetPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Target (resistance):{" "}
                        <span className="text-foreground">{formatCurrency(rec.targetPrice)}</span>
                      </p>
                    )}
                    {rec.lastActionSignal && rec.lastActionPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Last {rec.lastActionSignal}:{" "}
                        <span className="text-foreground">{formatCurrency(rec.lastActionPrice)}</span>
                        {lastActionDateStr && ` on ${lastActionDateStr}`}
                      </p>
                    )}
                  </>
                )}

                {/* SELL signal layout */}
                {rec.type === "sell" && (
                  <>
                    {(rec.signalPrice != null || signalDateStr) && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Generated:{" "}
                        {signalDateStr && <span className="text-foreground">{signalDateStr}</span>}
                        {signalDateStr && rec.signalPrice != null && " at "}
                        {rec.signalPrice != null && (
                          <span className="text-foreground">{formatCurrency(rec.signalPrice)}</span>
                        )}
                      </p>
                    )}
                    {rec.targetPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Target (support):{" "}
                        <span className="text-foreground">{formatCurrency(rec.targetPrice)}</span>
                      </p>
                    )}
                    {rec.lastActionSignal && rec.lastActionPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Last {rec.lastActionSignal}:{" "}
                        <span className="text-foreground">{formatCurrency(rec.lastActionPrice)}</span>
                        {lastActionDateStr && ` on ${lastActionDateStr}`}
                      </p>
                    )}
                  </>
                )}

                {/* HOLD signal layout */}
                {rec.type === "hold" && (
                  <>
                    {rec.signalPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Current price:{" "}
                        <span className="text-foreground">{formatCurrency(rec.signalPrice)}</span>
                      </p>
                    )}
                    {rec.lastActionSignal && rec.lastActionPrice != null && (
                      <p className="text-sm text-foreground-muted mt-1">
                        Last {rec.lastActionSignal} generated at{" "}
                        <span className="text-foreground">{formatCurrency(rec.lastActionPrice)}</span>
                        {lastActionDateStr && (
                          <span> on <span className="text-foreground">{lastActionDateStr}</span></span>
                        )}
                      </p>
                    )}
                  </>
                )}

                <p className="text-sm text-foreground-muted mt-2">{rec.reason}</p>
                <p className="text-xs text-foreground-muted mt-2 uppercase tracking-wider">
                  Daily chart
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
