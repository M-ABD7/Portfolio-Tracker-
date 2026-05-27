"use client";

import { Card, CardContent } from "@/components/ui";

interface PortfolioSummaryCardProps {
  cryptoPercentage: number;
  largestPositionPercentage?: number;
}

export function PortfolioSummaryCard({
  cryptoPercentage,
  largestPositionPercentage,
}: PortfolioSummaryCardProps) {
  const isHeavy = cryptoPercentage > 50;

  return (
    <Card>
      <CardContent>
        <p className="text-sm text-foreground-muted mb-1">Portfolio Summary</p>
        <p className="text-xl font-semibold text-foreground">
          Your portfolio is {cryptoPercentage}% crypto-heavy
        </p>
        {typeof largestPositionPercentage === "number" && (
          <p className="text-sm text-foreground-muted mt-2">
            Largest position: {largestPositionPercentage}% of the portfolio
          </p>
        )}
        {isHeavy && (
          <p className="text-sm text-foreground-muted mt-1">
            Consider diversifying to reduce concentration risk.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
