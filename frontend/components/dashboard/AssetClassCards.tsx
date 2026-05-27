"use client";

import Link from "next/link";
import type { Asset } from "@/lib/types";

interface AssetClassCardsProps {
  assets: Asset[];
}

const CLASS_CONFIG = [
  { id: "crypto", label: "Crypto", color: "#00d9ff", tab: "crypto" },
  { id: "forex", label: "Forex", color: "#a855f7", tab: "forex" },
  { id: "commodities", label: "Commodities", color: "#f472b6", tab: "commodities" },
] as const;

export function AssetClassCards({ assets }: AssetClassCardsProps) {
  const totalValue = assets.reduce((sum, a) => sum + a.value, 0);

  const classes = CLASS_CONFIG.map((cfg) => {
    const classAssets = assets.filter((a) => a.assetClass === cfg.id);
    const classValue = classAssets.reduce((sum, a) => sum + a.value, 0);
    const classPct = totalValue > 0 ? (classValue / totalValue) * 100 : 0;

    // Deduplicate by symbol, summing value across exchanges
    const symbolMap = new Map<string, number>();
    for (const a of classAssets) {
      symbolMap.set(a.symbol, (symbolMap.get(a.symbol) ?? 0) + a.value);
    }
    const breakdown = Array.from(symbolMap.entries())
      .map(([symbol, value]) => ({
        symbol,
        pct: classValue > 0 ? (value / classValue) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    const visible = breakdown.slice(0, 4);
    const hiddenCount = breakdown.length - visible.length;

    return { ...cfg, classPct, breakdown: visible, hiddenCount };
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {classes.map((cls) => (
        <div
          key={cls.id}
          className="rounded-2xl border border-border bg-background-secondary px-5 py-4 flex flex-col gap-3"
        >
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: cls.color }}
              />
              <span className="text-sm font-medium text-foreground">{cls.label}</span>
            </div>
            <span className="text-2xl font-bold text-foreground">
              {cls.classPct.toFixed(1)}%
            </span>
          </div>

          {/* Per-asset breakdown */}
          {cls.breakdown.length > 0 ? (
            <div className="space-y-1.5">
              {cls.breakdown.map((item) => (
                <div key={item.symbol} className="flex items-center gap-2">
                  <span className="w-10 text-xs font-medium text-foreground shrink-0">
                    {item.symbol}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: cls.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <span className="w-10 text-xs text-foreground-muted text-right shrink-0">
                    {item.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
              {cls.hiddenCount > 0 && (
                <p className="text-xs text-foreground-muted pt-0.5">
                  +{cls.hiddenCount} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-foreground-muted">No assets</p>
          )}

          <Link
            href={`/portfolio?tab=${cls.tab}`}
            className="self-start text-xs font-medium text-accent-primary hover:opacity-75 transition-opacity mt-auto"
          >
            View Details →
          </Link>
        </div>
      ))}
    </div>
  );
}
