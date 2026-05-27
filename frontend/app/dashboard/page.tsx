"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import {
  PortfolioSummary,
  AssetDiversification,
  TopPerformers,
} from "@/components/dashboard";
import { fetchPortfolioOverview, type PortfolioOverviewResponse } from "@/lib/api";

export default function DashboardPage() {
  const [overview, setOverview] = useState<PortfolioOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOverview = async () => {
      try {
        const data = await fetchPortfolioOverview();
        if (isMounted) {
          setOverview(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load portfolio data.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOverview();
    const intervalId = window.setInterval(loadOverview, 20000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Your Portfolio Overview
          </h1>
          <p className="text-foreground-muted mt-1">
            Track your multi-asset portfolio performance.
          </p>
        </div>
        <Link href="/portfolio">
          <Button variant="primary">View Detailed Portfolio</Button>
        </Link>
      </div>

      {loading && (
        <div className="rounded-2xl border border-border bg-background-secondary px-6 py-10 text-center text-foreground-muted">
          Loading portfolio data...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-accent-danger/30 bg-accent-danger/10 px-6 py-4 text-sm text-accent-danger">
          {error}
        </div>
      )}

      {overview && (
        <>
          <PortfolioSummary data={overview.summary} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AssetDiversification assets={overview.assets} />
            <TopPerformers performers={overview.topPerformers} />
          </div>
        </>
      )}
    </div>
  );
}

