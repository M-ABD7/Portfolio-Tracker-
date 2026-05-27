"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import {
  RiskScore,
  Recommendations,
  DiversificationTips,
  PortfolioSummaryCard,
} from "@/components/ai";
import { fetchPortfolioInsights } from "@/lib/api";
import type { PortfolioInsights } from "@/lib/types";
import { ArrowLeft } from "lucide-react";
import { formatPercentage } from "@/lib/utils";

export default function AISuggestionsPage() {
  const [insights, setInsights] = useState<PortfolioInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadInsights = async () => {
      try {
        const data = await fetchPortfolioInsights();
        if (isMounted) {
          setInsights(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load market signals.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInsights();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Signals & Allocation</h1>
          <p className="text-foreground-muted mt-1">
            Portfolio insights based on current holdings, technical signals, and optimizer output.
          </p>
        </div>
        <Link href="/portfolio">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Back to Portfolio
          </Button>
        </Link>
      </div>

      {loading && (
        <Card>
          <CardContent className="text-center text-foreground-muted py-10">
            Loading portfolio insights...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="text-sm text-accent-danger py-6">{error}</CardContent>
        </Card>
      )}

      {insights && !loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PortfolioSummaryCard
              cryptoPercentage={insights.portfolioSummary.cryptoPercentage}
              largestPositionPercentage={insights.portfolioSummary.largestPositionPercentage}
            />
            <RiskScore score={insights.riskScore} />
          </div>

          <Recommendations recommendations={insights.recommendations} />

          <DiversificationTips tips={insights.diversificationTips} />

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Weight Allocation</h3>
            {insights.allocation.profiles.length === 0 ? (
              <Card>
                <CardContent className="text-foreground-muted py-6">
                  {insights.allocation.message || "Allocation data is not available yet."}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {insights.allocation.profiles.map((profile) => (
                  <Card key={profile.profile}>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-foreground">{profile.profile}</h4>
                        <Badge variant="info">Sharpe {profile.sharpe.toFixed(2)}</Badge>
                      </div>
                      <div className="space-y-2">
                        {profile.weights.map((weight) => (
                          <div key={`${profile.profile}-${weight.asset}`} className="flex items-center justify-between text-sm">
                            <span className="text-foreground">{weight.asset}</span>
                            <span className="text-foreground-muted">{formatPercentage(weight.weight * 100)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-border text-sm text-foreground-muted space-y-1">
                        <p>Expected return: {formatPercentage(profile.return * 100)}</p>
                        <p>Volatility: {formatPercentage(profile.stdDev * 100)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="text-center pt-4">
            <Link href="/analytics">
              <Button variant="primary" size="lg">View Full Analytics</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
