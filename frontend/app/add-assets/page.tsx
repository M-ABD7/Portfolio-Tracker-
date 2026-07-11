"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, Badge } from "@/components/ui";
import { AddAssetForm } from "@/components/portfolio";
import { ArrowLeft, CheckCircle, Trash2, Calculator } from "lucide-react";
import type { Asset } from "@/lib/types";
import { createPortfolioAsset } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

type DraftAsset = Omit<Asset, "id"> & { tempId: string; transactionType: "buy" | "sell" };

export default function AddAssetsPage() {
  const router = useRouter();
  const [addedAssets, setAddedAssets] = useState<DraftAsset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
        currentPrice: 0,
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

      const lastAssetClass = addedAssets[addedAssets.length - 1]?.assetClass ?? "crypto";
      setAddedAssets([]);
      setSaveSuccess("Assets saved to the backend portfolio.");
      router.push(`/portfolio?tab=${lastAssetClass}`);
      router.refresh();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save assets to the backend."
      );
    } finally {
      setIsSaving(false);
    }
  };

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
            Manually add assets to your portfolio.
          </p>
        </div>
        <Link href="/calculators">
          <Button variant="outline">
            <Calculator className="w-4 h-4" />
            Calculators
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <AddAssetForm onAdd={handleAddAsset} />
          <Card>
            <CardContent>
              <p className="text-sm text-foreground-muted">
                Need to calculate your average buy price or DCA target?{" "}
                <Link href="/calculators" className="font-medium text-accent-primary hover:underline">
                  Open Calculators →
                </Link>
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
    </div>
  );
}
