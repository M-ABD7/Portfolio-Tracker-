"use client";

import { Card } from "@/components/ui";
import { formatCurrency, formatPercentage, cn } from "@/lib/utils";
import type { PortfolioSummary as PortfolioSummaryType } from "@/lib/types";

interface PortfolioSummaryProps {
  data: PortfolioSummaryType;
}

export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <p className="text-sm text-foreground-muted mb-1">Total Portfolio Value</p>
        <p className="text-3xl font-bold text-foreground">
          {formatCurrency(data.totalValue)}
        </p>
      </Card>

      <Card>
        <p className="text-sm text-foreground-muted mb-1">Total Profit/Loss</p>
        <p
          className={cn(
            "text-3xl font-bold",
            data.totalProfitLoss >= 0 ? "text-accent-success" : "text-accent-danger"
          )}
        >
          {data.totalProfitLoss >= 0 ? "+" : ""}
          {formatCurrency(data.totalProfitLoss)}
        </p>
      </Card>

      <Card>
        <p className="text-sm text-foreground-muted mb-1">Daily % Change</p>
        <p
          className={cn(
            "text-3xl font-bold",
            data.dailyChangePercentage >= 0
              ? "text-accent-success"
              : "text-accent-danger"
          )}
        >
          {formatPercentage(data.dailyChangePercentage)}
        </p>
      </Card>
    </div>
  );
}

