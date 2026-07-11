"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, Button, Card, CardContent } from "@/components/ui";
import { ArrowLeft, Plus } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

const pageTabs = [
  { id: "average", label: "Avg Rate" },
  { id: "dca", label: "DCA Target" },
  { id: "profit-loss", label: "Profit/Loss" },
];

type AvgTransaction = { rate: string; shares: string };
type SaleTransaction = { rate: string; quantity: string };

export default function CalculatorsPage() {
  const [activeTab, setActiveTab] = useState("average");

  const [avgTransactions, setAvgTransactions] = useState<AvgTransaction[]>([
    { rate: "", shares: "" },
    { rate: "", shares: "" },
  ]);
  const [dcaInputs, setDcaInputs] = useState({
    oldRate: "",
    oldShares: "",
    currentMarketRate: "",
    desiredAverageRate: "",
  });
  const [plInputs, setPlInputs] = useState({ buyingRate: "", quantity: "" });
  const [sales, setSales] = useState<SaleTransaction[]>([{ rate: "", quantity: "" }]);

  const averageBuyingRate = useMemo(() => {
    const parsed = avgTransactions
      .map((item) => ({
        rate: parseFloat(item.rate),
        shares: parseFloat(item.shares),
      }))
      .filter((item) => Number.isFinite(item.rate) && Number.isFinite(item.shares) && item.shares > 0);

    if (parsed.length === 0) return null;

    const totalCost = parsed.reduce((sum, item) => sum + item.rate * item.shares, 0);
    const totalShares = parsed.reduce((sum, item) => sum + item.shares, 0);

    if (!totalShares) return null;

    return { totalCost, totalShares, averageRate: totalCost / totalShares };
  }, [avgTransactions]);

  const dcaResult = useMemo(() => {
    const oldRate = parseFloat(dcaInputs.oldRate);
    const oldShares = parseFloat(dcaInputs.oldShares);
    const currentMarketRate = parseFloat(dcaInputs.currentMarketRate);
    const desiredAverageRate = parseFloat(dcaInputs.desiredAverageRate);

    if (
      !Number.isFinite(oldRate) ||
      !Number.isFinite(oldShares) ||
      !Number.isFinite(currentMarketRate) ||
      !Number.isFinite(desiredAverageRate) ||
      oldShares <= 0
    ) return null;

    if (desiredAverageRate < currentMarketRate) {
      return { error: `Desired average rate must be greater than ${currentMarketRate}.` };
    }
    if (desiredAverageRate > oldRate) {
      return { error: `Desired average rate must be less than ${oldRate}.` };
    }

    const previousTotalCost = oldRate * oldShares;
    const targetTotalCost = desiredAverageRate * oldShares;
    const requiredNewShares =
      (previousTotalCost - targetTotalCost) / (desiredAverageRate - currentMarketRate);

    if (!Number.isFinite(requiredNewShares) || requiredNewShares <= 0) {
      return { error: "No valid DCA result for those inputs." };
    }

    return { requiredNewShares, buyCost: requiredNewShares * currentMarketRate };
  }, [dcaInputs]);

  function computeProfitLoss() {
    const buyingRate = parseFloat(plInputs.buyingRate);
    const quantity = parseFloat(plInputs.quantity);

    if (!Number.isFinite(buyingRate) || !Number.isFinite(quantity) || quantity <= 0) return null;

    let sharesSold = 0;
    let totalSalesValue = 0;

    for (const sale of sales) {
      const rate = parseFloat(sale.rate);
      const saleQuantity = parseFloat(sale.quantity);
      if (!Number.isFinite(rate) || !Number.isFinite(saleQuantity) || saleQuantity <= 0) continue;
      if (sharesSold + saleQuantity > quantity) {
        return { error: "You are trying to sell more shares than available." };
      }
      sharesSold += saleQuantity;
      totalSalesValue += rate * saleQuantity;
    }

    const remainingShares = quantity - sharesSold;
    const profitOrLoss = totalSalesValue - buyingRate * sharesSold;

    return { sharesSold, totalSalesValue, remainingShares, profitOrLoss };
  }

  const profitLossResult = computeProfitLoss();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/add-assets"
          className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Add Assets
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Calculators</h1>
        <p className="text-foreground-muted mt-1">
          Work out average rates, DCA targets, and realized profit or loss.
        </p>
      </div>

      <Tabs tabs={pageTabs} defaultTab="average" variant="pills" onChange={setActiveTab} />

      {activeTab === "average" && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Average Buying Rate</h3>
              <p className="text-sm text-foreground-muted mt-1">
                Enter each buy transaction and the calculator will compute your average rate.
              </p>
            </div>
            {avgTransactions.map((transaction, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="number"
                  step="any"
                  placeholder={`Rate for transaction ${index + 1}`}
                  className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                  value={transaction.rate}
                  onChange={(e) => {
                    const next = [...avgTransactions];
                    next[index].rate = e.target.value;
                    setAvgTransactions(next);
                  }}
                />
                <input
                  type="number"
                  step="any"
                  placeholder={`Shares for transaction ${index + 1}`}
                  className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                  value={transaction.shares}
                  onChange={(e) => {
                    const next = [...avgTransactions];
                    next[index].shares = e.target.value;
                    setAvgTransactions(next);
                  }}
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setAvgTransactions((prev) => [...prev, { rate: "", shares: "" }])}
            >
              <Plus className="w-4 h-4" />
              Add Transaction Row
            </Button>
            {averageBuyingRate && (
              <div className="rounded-xl border border-border bg-background-secondary p-4">
                <p className="text-sm text-foreground-muted">Average Buying Rate</p>
                <p className="text-2xl font-semibold text-foreground">
                  {formatCurrency(averageBuyingRate.averageRate)} per share
                </p>
                <p className="text-sm text-foreground-muted mt-2">
                  Total shares: {averageBuyingRate.totalShares.toFixed(2)} | Total invested:{" "}
                  {formatCurrency(averageBuyingRate.totalCost)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "dca" && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">DCA Target Calculator</h3>
              <p className="text-sm text-foreground-muted mt-1">
                See how many more shares you need to buy at the current market rate to reach a target average.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ["oldRate", "Old rate"],
                ["oldShares", "Old shares"],
                ["currentMarketRate", "Current market rate"],
                ["desiredAverageRate", "Desired average rate"],
              ].map(([key, label]) => (
                <input
                  key={key}
                  type="number"
                  step="any"
                  placeholder={label}
                  className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                  value={dcaInputs[key as keyof typeof dcaInputs]}
                  onChange={(e) =>
                    setDcaInputs((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              ))}
            </div>
            {dcaResult?.error && (
              <div className="rounded-xl border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
                {dcaResult.error}
              </div>
            )}
            {dcaResult && typeof dcaResult.requiredNewShares === "number" && typeof dcaResult.buyCost === "number" && (
              <div className="rounded-xl border border-border bg-background-secondary p-4">
                <p className="text-sm text-foreground-muted">Required new shares</p>
                <p className="text-2xl font-semibold text-foreground">
                  {dcaResult.requiredNewShares.toFixed(2)} shares
                </p>
                <p className="text-sm text-foreground-muted mt-2">
                  Estimated buy cost: {formatCurrency(dcaResult.buyCost)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "profit-loss" && (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Profit/Loss with Partial Sales</h3>
              <p className="text-sm text-foreground-muted mt-1">
                Enter your average buying rate, total quantity, and each sale to see realized profit or loss.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="number"
                step="any"
                placeholder="Average buying rate"
                className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                value={plInputs.buyingRate}
                onChange={(e) => setPlInputs((prev) => ({ ...prev, buyingRate: e.target.value }))}
              />
              <input
                type="number"
                step="any"
                placeholder="Total quantity owned"
                className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                value={plInputs.quantity}
                onChange={(e) => setPlInputs((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            {sales.map((sale, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="number"
                  step="any"
                  placeholder={`Sell rate ${index + 1}`}
                  className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                  value={sale.rate}
                  onChange={(e) => {
                    const next = [...sales];
                    next[index].rate = e.target.value;
                    setSales(next);
                  }}
                />
                <input
                  type="number"
                  step="any"
                  placeholder={`Quantity sold ${index + 1}`}
                  className="w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground"
                  value={sale.quantity}
                  onChange={(e) => {
                    const next = [...sales];
                    next[index].quantity = e.target.value;
                    setSales(next);
                  }}
                />
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => setSales((prev) => [...prev, { rate: "", quantity: "" }])}
            >
              <Plus className="w-4 h-4" />
              Add Sale Row
            </Button>
            {profitLossResult?.error && (
              <div className="rounded-xl border border-accent-danger/30 bg-accent-danger/10 p-4 text-sm text-accent-danger">
                {profitLossResult.error}
              </div>
            )}
            {profitLossResult &&
              typeof profitLossResult.sharesSold === "number" &&
              typeof profitLossResult.totalSalesValue === "number" &&
              typeof profitLossResult.remainingShares === "number" &&
              typeof profitLossResult.profitOrLoss === "number" && (
                <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-2">
                  <p className="text-sm text-foreground-muted">
                    Total shares sold: {profitLossResult.sharesSold}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Total sales value: {formatCurrency(profitLossResult.totalSalesValue)}
                  </p>
                  <p className="text-sm text-foreground-muted">
                    Remaining shares: {profitLossResult.remainingShares}
                  </p>
                  <p
                    className={cn(
                      "text-xl font-semibold",
                      profitLossResult.profitOrLoss >= 0 ? "text-accent-success" : "text-accent-danger"
                    )}
                  >
                    {profitLossResult.profitOrLoss >= 0 ? "Profit" : "Loss"}:{" "}
                    {formatCurrency(Math.abs(profitLossResult.profitOrLoss))}
                  </p>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
