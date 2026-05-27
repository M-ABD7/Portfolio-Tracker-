"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, Button, Card, CardContent, Badge } from "@/components/ui";
import { AddAssetForm } from "@/components/portfolio";
import { ArrowLeft, CheckCircle, Trash2, Plus } from "lucide-react";
import type { Asset } from "@/lib/types";
import { createPortfolioAsset } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

const pageTabs = [
  { id: "manual", label: "Add Asset" },
  { id: "average", label: "Avg Rate" },
  { id: "dca", label: "DCA Target" },
  { id: "profit-loss", label: "Profit/Loss" },
];

type DraftAsset = Omit<Asset, "id"> & { tempId: string; transactionType: "buy" | "sell" };

type AvgTransaction = {
  rate: string;
  shares: string;
};

type SaleTransaction = {
  rate: string;
  quantity: string;
};

export default function AddAssetsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("manual");
  const [addedAssets, setAddedAssets] = useState<DraftAsset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
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

  const handleAddAsset = (asset: Omit<Asset, "id" | "currentPrice" | "value" | "pl" | "plPercentage"> & { transactionType: "buy" | "sell" }) => {
    setSaveError(null);
    setSaveSuccess(null);
    const quantity = Number(asset.quantity);
    const avgBuyPrice = Number(asset.avgBuyPrice);
    setAddedAssets((prev) => [
      ...prev,
      {
        ...asset,
        tempId: Date.now().toString(),
        currentPrice: 0, // Will be fetched by backend
        value: quantity * avgBuyPrice,
        pl: 0,
        plPercentage: 0,
      },
    ]);
  };

  const handleRemoveAsset = (tempId: string) => {
    setAddedAssets((prev) => prev.filter((a) => a.tempId !== tempId));
  };

  const handleSaveToPortfolio = async () => {
    if (addedAssets.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      for (const asset of addedAssets) {
        await createPortfolioAsset({
          name: asset.name,
          symbol: asset.symbol,
          quantity: asset.quantity,
          avgBuyPrice: asset.avgBuyPrice,
          assetClass: asset.assetClass,
          exchange: asset.exchange,
          marketSymbol: asset.marketSymbol,
          transactionType: asset.transactionType,
        });
      }

      setAddedAssets([]);
      setSaveSuccess("Assets saved to the backend portfolio.");
      router.push("/portfolio");
      router.refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save assets to the backend."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const averageBuyingRate = useMemo(() => {
    const parsed = avgTransactions
      .map((item) => ({
        rate: parseFloat(item.rate),
        shares: parseFloat(item.shares),
      }))
      .filter((item) => Number.isFinite(item.rate) && Number.isFinite(item.shares) && item.shares > 0);

    if (parsed.length === 0) {
      return null;
    }

    const totalCost = parsed.reduce((sum, item) => sum + item.rate * item.shares, 0);
    const totalShares = parsed.reduce((sum, item) => sum + item.shares, 0);

    if (!totalShares) {
      return null;
    }

    return {
      totalCost,
      totalShares,
      averageRate: totalCost / totalShares,
    };
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
    ) {
      return null;
    }

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

    return {
      requiredNewShares,
      buyCost: requiredNewShares * currentMarketRate,
    };
  }, [dcaInputs]);

  const profitLossResult = useMemo(() => {
    const buyingRate = parseFloat(plInputs.buyingRate);
    const quantity = parseFloat(plInputs.quantity);

    if (!Number.isFinite(buyingRate) || !Number.isFinite(quantity) || quantity <= 0) {
      return null;
    }

    let sharesSold = 0;
    let totalSalesValue = 0;

    for (const sale of sales) {
      const rate = parseFloat(sale.rate);
      const saleQuantity = parseFloat(sale.quantity);
      if (!Number.isFinite(rate) || !Number.isFinite(saleQuantity) || saleQuantity <= 0) {
        continue;
      }
      if (sharesSold + saleQuantity > quantity) {
        return { error: "You are trying to sell more shares than available." };
      }
      sharesSold += saleQuantity;
      totalSalesValue += rate * saleQuantity;
    }

    const remainingShares = quantity - sharesSold;
    const profitOrLoss = totalSalesValue - buyingRate * sharesSold;

    return {
      sharesSold,
      totalSalesValue,
      remainingShares,
      profitOrLoss,
    };
  }, [plInputs, sales]);

  const totalValue = addedAssets.reduce((sum, a) => sum + a.value, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portfolio
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Add Assets</h1>
          <p className="text-foreground-muted mt-1">
            Add assets manually and use the built-in calculators to work out average rate, DCA targets, and realized profit/loss.
          </p>
        </div>
      </div>

      <Tabs tabs={pageTabs} defaultTab="manual" variant="pills" onChange={setActiveTab} />

      {activeTab === "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <AddAssetForm onAdd={handleAddAsset} />
            <Card>
              <CardContent>
                <p className="text-sm text-foreground-muted">
                  If you do not know your average buy price yet, calculate it first in the
                  <span className="font-medium text-foreground"> Avg Rate </span>
                  tab and then save the asset here.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Added Assets ({addedAssets.length})
                </h3>
                {addedAssets.length > 0 && (
                  <Badge variant="info">{formatCurrency(totalValue)} Total</Badge>
                )}
              </div>

              {addedAssets.length === 0 ? (
                <div className="text-center py-8 text-foreground-muted">
                  <p>No assets added yet.</p>
                  <p className="text-sm mt-1">Use the form to add your first asset.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto">
                  {addedAssets.map((asset) => (
                    <div
                      key={asset.tempId}
                      className="flex items-center justify-between p-3 bg-background-secondary rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-accent-success" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{asset.symbol}</span>
                            <Badge variant="default">{asset.transactionType.toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm text-foreground-muted">
                            {asset.quantity} x {formatCurrency(asset.avgBuyPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-medium text-foreground">{formatCurrency(asset.value)}</p>
                          <p
                            className={cn(
                              "text-sm",
                              asset.pl >= 0 ? "text-accent-success" : "text-accent-danger"
                            )}
                          >
                            {asset.pl >= 0 ? "+" : ""}
                            {formatCurrency(asset.pl)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveAsset(asset.tempId)}
                          className="p-2 text-foreground-muted hover:text-accent-danger transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {saveError && (
                <div className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
                  {saveError}
                </div>
              )}

              {saveSuccess && (
                <div className="mt-4 rounded-lg border border-accent-success/30 bg-accent-success/10 px-4 py-3 text-sm text-accent-success">
                  {saveSuccess}
                </div>
              )}

              {addedAssets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSaveToPortfolio}
                    disabled={isSaving}
                  >
                    <CheckCircle className="w-4 h-4" />
                    {isSaving ? "Saving..." : "Save to Portfolio"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
                  Total shares: {averageBuyingRate.totalShares.toFixed(2)} | Total invested: {formatCurrency(averageBuyingRate.totalCost)}
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
            {profitLossResult && typeof profitLossResult.sharesSold === "number" && typeof profitLossResult.totalSalesValue === "number" && typeof profitLossResult.remainingShares === "number" && typeof profitLossResult.profitOrLoss === "number" && (
              <div className="rounded-xl border border-border bg-background-secondary p-4 space-y-2">
                <p className="text-sm text-foreground-muted">Total shares sold: {profitLossResult.sharesSold}</p>
                <p className="text-sm text-foreground-muted">Total sales value: {formatCurrency(profitLossResult.totalSalesValue)}</p>
                <p className="text-sm text-foreground-muted">Remaining shares: {profitLossResult.remainingShares}</p>
                <p
                  className={cn(
                    "text-xl font-semibold",
                    profitLossResult.profitOrLoss >= 0 ? "text-accent-success" : "text-accent-danger"
                  )}
                >
                  {profitLossResult.profitOrLoss >= 0 ? "Profit" : "Loss"}: {formatCurrency(Math.abs(profitLossResult.profitOrLoss))}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}








