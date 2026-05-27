"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Tabs, Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { fetchPortfolioAnalytics, fetchPortfolioOverview } from "@/lib/api";
import type { PortfolioAnalytics, PLByAssetClass, Asset } from "@/lib/types";
import type { PortfolioOverviewResponse } from "@/lib/api";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, BarChart2, RefreshCw } from "lucide-react";
import { formatCurrency, formatPercentage, formatQuantity, cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";

type TimePeriod = "7d" | "1m" | "3m";

const timePeriodTabs = [
  { id: "7d", label: "Last 7 Days" },
  { id: "1m", label: "1 Month" },
  { id: "3m", label: "3 Months" },
];

const tooltipStyle = {
  backgroundColor: "#1c2128",
  border: "1px solid #30363d",
  borderRadius: "8px",
  color: "#e6edf3",
};

function aggregateAssetsBySymbol(assets: Asset[]) {
  const grouped = new Map<string, Asset>();

  for (const asset of assets) {
    const key = `${asset.assetClass}:${asset.symbol}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...asset });
      continue;
    }

    const quantity = existing.quantity + asset.quantity;
    const totalCost = existing.avgBuyPrice * existing.quantity + asset.avgBuyPrice * asset.quantity;
    existing.quantity = quantity;
    existing.avgBuyPrice = quantity > 0 ? totalCost / quantity : existing.avgBuyPrice;
    existing.value += asset.value;
    existing.pl += asset.pl;
    existing.currentPrice = quantity > 0 ? existing.value / quantity : existing.currentPrice;
    existing.plPercentage = totalCost > 0 ? (existing.pl / totalCost) * 100 : 0;
    existing.exchange = "Multiple";
  }

  return [...grouped.values()].sort((a, b) => b.value - a.value);
}

function StatCard({ label, value, sub, positive, icon }: {
  label: string; value: string; sub?: string; positive?: boolean; icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-foreground-muted">{label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {sub && (
            <p className={cn("text-sm font-medium",
              positive === undefined ? "text-foreground-muted"
              : positive ? "text-accent-success" : "text-accent-danger")}>
              {sub}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function AreaPerformanceChart({ data }: { data: PortfolioAnalytics["assetPerformance"] }) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader><CardTitle>Asset Performance Over Time</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-foreground-muted text-sm">
          Add assets and wait for price history to accumulate.
        </CardContent>
      </Card>
    );
  }
  const daySet = new Set<string>();
  data.forEach((a) => a.data.forEach((d) => daySet.add(d.day)));
  const sortedDays = Array.from(daySet).sort(
    (left, right) =>
      new Date(`${left} ${new Date().getFullYear()}`).getTime() -
      new Date(`${right} ${new Date().getFullYear()}`).getTime(),
  );
  const chartData = sortedDays.map((day) => {
    const point: Record<string, string | number | null> = { day };
    data.forEach((asset) => {
      point[asset.symbol] = asset.data.find((d) => d.day === day)?.value ?? null;
    });
    return point;
  });
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Asset Performance Over Time</CardTitle></CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                {data.map((a) => (
                  <linearGradient key={a.symbol} id={`grad-${a.symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={a.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={a.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis dataKey="day" stroke="#8b949e" fontSize={11} tickLine={false} />
              <YAxis stroke="#8b949e" fontSize={11} tickLine={false}
                tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v) => typeof v === "number"
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v) : v} />
              <Legend verticalAlign="top" height={32}
                formatter={(val) => <span className="text-foreground-muted text-xs">{val}</span>} />
              {data.map((a) => (
                <Area key={a.symbol} type="monotone" dataKey={a.symbol} name={a.name}
                  stroke={a.color} strokeWidth={2} fill={`url(#grad-${a.symbol})`}
                  dot={false} connectNulls activeDot={{ r: 5, strokeWidth: 0 }} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PLBarChart({ data }: { data: PLByAssetClass[] }) {
  const chartData = data.map((item) => ({
    name: item.assetClass.charAt(0).toUpperCase() + item.assetClass.slice(1),
    value: item.profitLoss,
    color: item.profitLoss >= 0 ? item.color : "#ef4444",
  }));
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>P/L by Asset Class</CardTitle></CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
              <XAxis type="number" stroke="#8b949e" fontSize={11} tickLine={false}
                tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
              <YAxis type="category" dataKey="name" stroke="#8b949e" fontSize={11} tickLine={false} width={90} />
              <Tooltip contentStyle={tooltipStyle}
                formatter={(v) => typeof v === "number"
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v) : v} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function WinnersLosers({ assets }: { assets: Asset[] }) {
  const sorted  = [...assets].sort((a, b) => b.plPercentage - a.plPercentage);
  const winners = sorted.filter((a) => a.plPercentage >= 0).slice(0, 4);
  const losers  = sorted.filter((a) => a.plPercentage < 0).slice(-4).reverse();
  const Row = ({ asset, type }: { asset: Asset; type: "win" | "loss" }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full shrink-0", type === "win" ? "bg-accent-success" : "bg-accent-danger")} />
        <span className="text-foreground text-sm font-medium">{asset.symbol}</span>
        <span className="text-foreground-muted text-xs hidden sm:inline">{asset.name}</span>
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold", type === "win" ? "text-accent-success" : "text-accent-danger")}>
          {asset.plPercentage >= 0 ? "+" : ""}{asset.plPercentage.toFixed(2)}%
        </p>
        <p className="text-xs text-foreground-muted">{formatCurrency(asset.pl)}</p>
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent-success" />Top Gainers</CardTitle></CardHeader>
        <CardContent>
          {winners.length === 0 ? <p className="text-foreground-muted text-sm py-4 text-center">No gainers yet.</p>
            : winners.map((a) => <Row key={a.id} asset={a} type="win" />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="w-4 h-4 text-accent-danger" />Top Losers</CardTitle></CardHeader>
        <CardContent>
          {losers.length === 0 ? <p className="text-foreground-muted text-sm py-4 text-center">No losers yet.</p>
            : losers.map((a) => <Row key={a.id} asset={a} type="loss" />)}
        </CardContent>
      </Card>
    </div>
  );
}

function AssetMetricsTable({ assets }: { assets: Asset[] }) {
  if (assets.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Asset Metrics - Avg Buy vs Current Price</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-foreground-muted text-left">
                <th className="pb-3 font-medium">Asset</th>
                <th className="pb-3 font-medium text-right">Avg Buy</th>
                <th className="pb-3 font-medium text-right">Current</th>
                <th className="pb-3 font-medium text-right">Qty</th>
                <th className="pb-3 font-medium text-right">Value</th>
                <th className="pb-3 font-medium text-right">P/L $</th>
                <th className="pb-3 font-medium text-right">P/L %</th>
              </tr>
            </thead>
            <tbody>
              {[...assets].sort((a, b) => b.value - a.value).map((asset) => (
                <tr key={asset.id} className="border-b border-border/50 hover:bg-background-secondary transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center text-xs font-bold text-accent-primary">
                        {asset.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{asset.symbol}</p>
                        <p className="text-xs text-foreground-muted">{asset.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right text-foreground-muted">{formatCurrency(asset.avgBuyPrice)}</td>
                  <td className={cn("py-3 text-right font-medium",
                    asset.currentPrice >= asset.avgBuyPrice ? "text-accent-success" : "text-accent-danger")}>
                    {formatCurrency(asset.currentPrice)}
                  </td>
                  <td className="py-3 text-right text-foreground">{formatQuantity(asset.quantity)}</td>
                  <td className="py-3 text-right font-medium text-foreground">{formatCurrency(asset.value)}</td>
                  <td className={cn("py-3 text-right font-medium",
                    asset.pl >= 0 ? "text-accent-success" : "text-accent-danger")}>
                    {asset.pl >= 0 ? "+" : ""}{formatCurrency(asset.pl)}
                  </td>
                  <td className="py-3 text-right">
                    <Badge variant={asset.plPercentage >= 0 ? "success" : "danger"}>
                      {asset.plPercentage >= 0 ? "+" : ""}{asset.plPercentage.toFixed(2)}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("1m");
  const [analytics,  setAnalytics]  = useState<PortfolioAnalytics | null>(null);
  const [overview,   setOverview]   = useState<PortfolioOverviewResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const loadData = async (period: TimePeriod) => {
    setLoading(true); setError(null);
    try {
      const [a, o] = await Promise.all([fetchPortfolioAnalytics(period), fetchPortfolioOverview()]);
      setAnalytics(a); setOverview(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally { setLoading(false); }
  };

  useEffect(() => { let m = true; loadData(timePeriod).then(() => { if (!m) return; }); return () => { m = false; }; }, [timePeriod]); // eslint-disable-line

  const assets     = aggregateAssetsBySymbol(overview?.assets ?? []);
  const totalValue = overview?.summary.totalValue ?? 0;
  const totalPL    = overview?.summary.totalProfitLoss ?? 0;
  const totalCost  = assets.reduce((s, a) => s + a.avgBuyPrice * a.quantity, 0);
  const plPct      = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics & Trends</h1>
          <p className="text-foreground-muted mt-1">Performance charts, P/L breakdown, and per-asset metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadData(timePeriod)} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />Refresh
          </Button>
          <Link href="/dashboard"><Button variant="outline"><ArrowLeft className="w-4 h-4" />Dashboard</Button></Link>
        </div>
      </div>

      <Tabs tabs={timePeriodTabs} defaultTab="1m" variant="pills" onChange={(id) => setTimePeriod(id as TimePeriod)} />

      {loading && <div className="rounded-2xl border border-border bg-background-secondary px-6 py-10 text-center text-foreground-muted">Loading analytics...</div>}
      {error   && <div className="rounded-2xl border border-accent-danger/30 bg-accent-danger/10 px-6 py-4 text-sm text-accent-danger">{error}</div>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Total Portfolio Value" value={formatCurrency(totalValue)} sub={`${assets.length} asset${assets.length !== 1 ? "s" : ""} held`} icon={<DollarSign className="w-5 h-5 text-accent-primary" />} />
            <StatCard label="Total Invested" value={formatCurrency(totalCost)} icon={<BarChart2 className="w-5 h-5 text-accent-primary" />} />
            <StatCard label="Total Profit / Loss" value={formatCurrency(totalPL)} sub={`${totalPL >= 0 ? "+" : ""}${formatCurrency(totalPL)} all time`} positive={totalPL >= 0} icon={totalPL >= 0 ? <TrendingUp className="w-5 h-5 text-accent-success" /> : <TrendingDown className="w-5 h-5 text-accent-danger" />} />
            <StatCard label="Return on Investment" value={formatPercentage(plPct)} sub="vs. average buy price" positive={plPct >= 0} icon={plPct >= 0 ? <TrendingUp className="w-5 h-5 text-accent-success" /> : <TrendingDown className="w-5 h-5 text-accent-danger" />} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AreaPerformanceChart data={analytics?.assetPerformance ?? []} />
            <PLBarChart data={analytics?.plByAssetClass ?? []} />
          </div>
          <WinnersLosers assets={assets} />
          <AssetMetricsTable assets={assets} />
        </>
      )}
    </div>
  );
}



