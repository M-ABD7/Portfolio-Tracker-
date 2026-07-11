"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Tabs } from "@/components/ui";
import { AssetTable } from "@/components/portfolio";
import {
  deletePortfolioAsset,
  fetchPortfolioOverview,
  listExchangeConnections,
  sellPortfolioAsset,
  syncExchangeConnection,
  transferPortfolioAsset,
  type PortfolioOverviewResponse,
} from "@/lib/api";
import { Sparkles, PlusCircle, Link2, RefreshCw } from "lucide-react";
import type { Asset, AssetClass, ExchangeConnection, ExchangeData } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type PortfolioTab = "all" | AssetClass;

const assetClassTabs = [
  { id: "all", label: "All Assets" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "commodities", label: "Commodities" },
];

const VALID_TABS = new Set<PortfolioTab>(["all", "crypto", "forex", "commodities"]);

function PortfolioContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as PortfolioTab | null;
  const initialTab: PortfolioTab =
    tabParam && VALID_TABS.has(tabParam) ? tabParam : "all";

  const [activeAssetClass, setActiveAssetClass] = useState<PortfolioTab>(initialTab);
  const [overview, setOverview] = useState<PortfolioOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [sellingAssetId, setSellingAssetId] = useState<string | null>(null);
  const [transferringAssetId, setTransferringAssetId] = useState<string | null>(null);

  // Sell modal
  const [assetToSell, setAssetToSell] = useState<Asset | null>(null);
  const [sellQuantity, setSellQuantity] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellModalError, setSellModalError] = useState<string | null>(null);

  // Transfer modal
  const [assetToTransfer, setAssetToTransfer] = useState<Asset | null>(null);
  const [transferToExchange, setTransferToExchange] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferModalError, setTransferModalError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ── Exchange sync ────────────────────────────────────────────────────────────
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

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
        if (isMounted) setLoading(false);
      }
    };

    loadOverview();
    const intervalId = window.setInterval(loadOverview, 60000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    listExchangeConnections()
      .then((data) => {
        if (isMounted) setConnections(data.connections);
      })
      .catch(() => {
        // Non-fatal — the Sync Exchanges button simply stays disabled.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDeleteAsset = async (asset: Asset) => {
    if (deletingAssetId || sellingAssetId || transferringAssetId) return;

    const shouldDelete = window.confirm(
      `Delete ${asset.symbol} from ${asset.exchange}? This removes only that exchange holding.`
    );
    if (!shouldDelete) return;

    setDeletingAssetId(asset.id);
    setError(null);

    try {
      await deletePortfolioAsset(asset.id);
      setOverview(await fetchPortfolioOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the asset.");
    } finally {
      setDeletingAssetId(null);
    }
  };

  // ── Sell ────────────────────────────────────────────────────────────────────

  const handleSellAsset = (asset: Asset) => {
    if (deletingAssetId || sellingAssetId || transferringAssetId) return;
    setAssetToSell(asset);
    setSellQuantity("");
    setSellPrice(String(asset.currentPrice || asset.avgBuyPrice || ""));
    setSellModalError(null);
    setError(null);
  };

  const handleCloseSellModal = () => {
    if (sellingAssetId) return;
    setAssetToSell(null);
    setSellQuantity("");
    setSellPrice("");
    setSellModalError(null);
  };

  const handleSubmitSell = async () => {
    if (!assetToSell || sellingAssetId) return;

    const quantity = Number(sellQuantity);
    const price = Number(sellPrice);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setSellModalError("Enter a valid quantity to sell.");
      return;
    }
    if (quantity > assetToSell.quantity) {
      setSellModalError(`You only hold ${assetToSell.quantity} ${assetToSell.symbol} on ${assetToSell.exchange}.`);
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setSellModalError("Enter a valid sell price.");
      return;
    }

    setSellingAssetId(assetToSell.id);
    setSellModalError(null);
    setError(null);

    try {
      await sellPortfolioAsset({
        holdingId: assetToSell.id,
        name: assetToSell.name,
        symbol: assetToSell.symbol,
        quantity,
        sellPrice: price,
        assetClass: assetToSell.assetClass,
        exchange: assetToSell.exchange,
        marketSymbol: assetToSell.marketSymbol || assetToSell.symbol,
      });
      setOverview(await fetchPortfolioOverview());
      setAssetToSell(null);
      setSellQuantity("");
      setSellPrice("");
    } catch (err) {
      setSellModalError(err instanceof Error ? err.message : "Failed to sell the asset.");
    } finally {
      setSellingAssetId(null);
    }
  };

  // ── Transfer ────────────────────────────────────────────────────────────────

  const handleTransferAsset = (asset: Asset) => {
    if (deletingAssetId || sellingAssetId || transferringAssetId) return;
    setAssetToTransfer(asset);
    setTransferToExchange("");
    setTransferQuantity("");
    setTransferModalError(null);
    setError(null);
  };

  const handleCloseTransferModal = () => {
    if (transferringAssetId) return;
    setAssetToTransfer(null);
    setTransferToExchange("");
    setTransferQuantity("");
    setTransferModalError(null);
  };

  const handleSubmitTransfer = async () => {
    if (!assetToTransfer || transferringAssetId) return;

    const quantity = Number(transferQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTransferModalError("Enter a valid quantity to transfer.");
      return;
    }
    if (quantity > assetToTransfer.quantity) {
      setTransferModalError(
        `You only hold ${assetToTransfer.quantity} ${assetToTransfer.symbol} on ${assetToTransfer.exchange}.`
      );
      return;
    }
    if (!transferToExchange) {
      setTransferModalError("Select a destination exchange.");
      return;
    }
    if (transferToExchange.trim().toLowerCase() === assetToTransfer.exchange.toLowerCase()) {
      setTransferModalError("Source and destination exchange must be different.");
      return;
    }

    setTransferringAssetId(assetToTransfer.id);
    setTransferModalError(null);
    setError(null);

    try {
      await transferPortfolioAsset({
        fromHoldingId: assetToTransfer.id,
        toExchange: transferToExchange.trim(),
        symbol: assetToTransfer.symbol,
        assetClass: assetToTransfer.assetClass,
        quantity,
      });
      setOverview(await fetchPortfolioOverview());
      setAssetToTransfer(null);
      setTransferToExchange("");
      setTransferQuantity("");
    } catch (err) {
      setTransferModalError(err instanceof Error ? err.message : "Failed to transfer the asset.");
    } finally {
      setTransferringAssetId(null);
    }
  };

  // ── Exchange Sync ───────────────────────────────────────────────────────────

  const handleSyncAll = async () => {
    if (syncingAll || connections.length === 0) return;

    setSyncingAll(true);
    setSyncError(null);
    setSyncSuccess(null);

    const results = await Promise.allSettled(
      connections.map((conn) => syncExchangeConnection(conn.id))
    );

    let succeededCount = 0;
    let totalSynced = 0;
    let failedCount = 0;
    let firstErrorMessage: string | null = null;

    for (const result of results) {
      if (result.status === "fulfilled") {
        succeededCount += 1;
        totalSynced += result.value.synced;
      } else {
        failedCount += 1;
        if (!firstErrorMessage) {
          firstErrorMessage = result.reason instanceof Error ? result.reason.message : "Sync failed.";
        }
      }
    }

    if (succeededCount > 0) {
      setSyncSuccess(
        `Synced ${succeededCount} exchange${succeededCount !== 1 ? "s" : ""} (${totalSynced} balance${totalSynced !== 1 ? "s" : ""} updated).`
      );
    }
    if (failedCount > 0) {
      setSyncError(
        failedCount === connections.length
          ? `Failed to sync ${failedCount} exchange${failedCount !== 1 ? "s" : ""}: ${firstErrorMessage}`
          : `${failedCount} of ${connections.length} exchange${connections.length !== 1 ? "s" : ""} failed to sync: ${firstErrorMessage}`
      );
    }

    if (succeededCount > 0) {
      try {
        setOverview(await fetchPortfolioOverview());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load portfolio data.");
      }
    }

    listExchangeConnections()
      .then((data) => setConnections(data.connections))
      .catch(() => {});

    setSyncingAll(false);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Per-class PnL summary (computed from filtered assets)
  const classAssets = overview
    ? activeAssetClass === "all"
      ? overview.assets
      : overview.assets.filter((a) => a.assetClass === activeAssetClass)
    : [];
  const classValue = activeAssetClass === "all"
    ? (overview?.summary.totalValue ?? 0)
    : classAssets.reduce((s, a) => s + a.value, 0);
  const classUnrealizedPnl = classAssets.reduce((s, a) => s + a.pl, 0);
  const classRealizedPnl = activeAssetClass === "all" ? (overview?.summary.realizedPnl ?? 0) : null;

  // Build per-exchange sections for the active tab, sorted FIFO (lowest holding id first)
  const exchangeSections: { exchange: ExchangeData; assets: Asset[] }[] = [];
  if (overview) {
    const sections = overview.exchangeData
      .map((ex) => ({
        exchange: ex,
        assets: activeAssetClass === "all"
          ? ex.assets
          : ex.assets.filter((a) => a.assetClass === activeAssetClass),
      }))
      .filter((s) => s.assets.length > 0);

    // Sort by minimum numeric holding id → FIFO (oldest purchase first)
    sections.sort((a, b) => {
      const minA = Math.min(...a.assets.map((x) => Number(x.id) || 0));
      const minB = Math.min(...b.assets.map((x) => Number(x.id) || 0));
      return minA - minB;
    });

    exchangeSections.push(...sections);
  }

  const hasAssets = exchangeSections.length > 0;

  const inputClass =
    "w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent-primary";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Detailed Portfolio</h1>
          <p className="text-foreground-muted mt-1">
            Your holdings across all connected exchanges.
          </p>
        </div>
        <div className="flex gap-2">
          {(activeAssetClass === "all" || activeAssetClass === "crypto") && (
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncingAll || connections.length === 0}
              title={connections.length === 0 ? "Connect an exchange to sync" : undefined}
            >
              <RefreshCw className={`w-4 h-4 ${syncingAll ? "animate-spin" : ""}`} />
              {syncingAll ? "Syncing..." : "Sync Exchanges"}
            </Button>
          )}
          <Link href="/onboarding">
            <Button variant="outline">
              <Link2 className="w-4 h-4" />
              Connect Exchange
            </Button>
          </Link>
          <Link href="/add-assets">
            <Button variant="outline">
              <PlusCircle className="w-4 h-4" />
              Add Assets
            </Button>
          </Link>
          <Link href="/signal-allocation">
            <Button variant="primary">
              <Sparkles className="w-4 h-4" />
              Signals &amp; Allocation
            </Button>
          </Link>
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {syncError}
        </div>
      )}
      {syncSuccess && (
        <div className="rounded-lg border border-accent-success/30 bg-accent-success/10 px-4 py-3 text-sm text-accent-success">
          {syncSuccess}
        </div>
      )}

      <Tabs
        tabs={assetClassTabs}
        defaultTab={activeAssetClass}
        onChange={(id) => setActiveAssetClass(id as PortfolioTab)}
      />

      {loading && (
        <div className="rounded-2xl border border-border bg-background-secondary px-6 py-10 text-center text-foreground-muted">
          Loading holdings...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-accent-danger/30 bg-accent-danger/10 px-6 py-4 text-sm text-accent-danger">
          {error}
        </div>
      )}

      {!loading && !error && overview && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs text-foreground-muted mb-1">
              {activeAssetClass === "all" ? "Portfolio Value" : `${activeAssetClass.charAt(0).toUpperCase() + activeAssetClass.slice(1)} Value`}
            </p>
            <p className="text-lg font-semibold text-foreground">{formatCurrency(classValue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs text-foreground-muted mb-1">Unrealized P/L</p>
            <p className={`text-lg font-semibold ${classUnrealizedPnl >= 0 ? "text-accent-success" : "text-accent-danger"}`}>
              {classUnrealizedPnl >= 0 ? "+" : ""}{formatCurrency(classUnrealizedPnl)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs text-foreground-muted mb-1">
              Realized P/L{activeAssetClass !== "all" && <span className="ml-1 text-foreground-muted/60">(all)</span>}
            </p>
            {classRealizedPnl !== null ? (
              <p className={`text-lg font-semibold ${classRealizedPnl >= 0 ? "text-accent-success" : "text-accent-danger"}`}>
                {classRealizedPnl >= 0 ? "+" : ""}{formatCurrency(classRealizedPnl)}
              </p>
            ) : (
              <p className="text-lg font-semibold text-foreground-muted">—</p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-background-secondary px-4 py-3">
            <p className="text-xs text-foreground-muted mb-1">Total P/L</p>
            {(() => {
              const total = classUnrealizedPnl + (classRealizedPnl ?? 0);
              return (
                <p className={`text-lg font-semibold ${total >= 0 ? "text-accent-success" : "text-accent-danger"}`}>
                  {total >= 0 ? "+" : ""}{formatCurrency(total)}
                </p>
              );
            })()}
          </div>
        </div>
      )}

      {!loading && !error && hasAssets && (
        <div className="space-y-6">
          {exchangeSections.map(({ exchange, assets }) => (
            <div key={exchange.id} className="rounded-2xl border border-border bg-background-secondary">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="font-semibold text-foreground">{exchange.name}</h2>
                <span className="text-sm text-foreground-muted">
                  {formatCurrency(
                    assets.reduce((sum, a) => sum + a.value, 0)
                  )}
                </span>
              </div>
              <div className="p-2">
                <AssetTable
                  assets={assets}
                  deletingAssetId={deletingAssetId}
                  sellingAssetId={sellingAssetId}
                  transferringAssetId={transferringAssetId}
                  onDelete={handleDeleteAsset}
                  onSell={handleSellAsset}
                  onTransfer={activeAssetClass === "all" || activeAssetClass === "crypto" ? handleTransferAsset : undefined}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !hasAssets && (
        <div className="text-center py-12">
          <p className="text-foreground-muted">
            No {activeAssetClass === "all" ? "" : activeAssetClass + " "}assets found in your portfolio.
          </p>
          <Link href="/onboarding" className="mt-4 inline-block">
            <Button variant="outline">Connect an Exchange</Button>
          </Link>
        </div>
      )}

      {/* ── Sell Modal ─────────────────────────────────────────────────────── */}
      {assetToSell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background-card p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">
                Sell {assetToSell.symbol}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Selling from <span className="text-foreground font-medium">{assetToSell.exchange}</span>
                {" - "}
                {assetToSell.quantity} {assetToSell.symbol} available at{" "}
                {formatCurrency(assetToSell.currentPrice)}.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-foreground-muted">Quantity to sell</label>
                <input
                  type="number"
                  min="0"
                  max={assetToSell.quantity}
                  step="any"
                  className={inputClass}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(e.target.value)}
                  placeholder="0.00"
                />
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-accent-primary transition hover:opacity-80"
                  onClick={() => setSellQuantity(String(assetToSell.quantity))}
                  disabled={Boolean(sellingAssetId)}
                >
                  Sell full quantity
                </button>
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground-muted">Sell price</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {sellModalError && (
              <div className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
                {sellModalError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCloseSellModal} disabled={Boolean(sellingAssetId)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleSubmitSell} disabled={Boolean(sellingAssetId)}>
                {sellingAssetId === assetToSell.id ? "Selling..." : "Sell Asset"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Modal ──────────────────────────────────────────────────── */}
      {assetToTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background-card p-6 shadow-xl">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">
                Transfer {assetToTransfer.symbol}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                From <span className="text-foreground font-medium">{assetToTransfer.exchange}</span>
                {" - "}
                {assetToTransfer.quantity} {assetToTransfer.symbol} available.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-foreground-muted">Quantity to transfer</label>
                <input
                  type="number"
                  min="0"
                  max={assetToTransfer.quantity}
                  step="any"
                  className={inputClass}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  placeholder="0.00"
                />
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-accent-primary transition hover:opacity-80"
                  onClick={() => setTransferQuantity(String(assetToTransfer.quantity))}
                  disabled={Boolean(transferringAssetId)}
                >
                  Transfer full quantity
                </button>
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground-muted">Destination exchange</label>
                <select
                  className={inputClass}
                  value={transferToExchange}
                  onChange={(e) => setTransferToExchange(e.target.value)}
                  disabled={Boolean(transferringAssetId)}
                >
                  <option value="">Select exchange…</option>
                  {["Binance", "OKX", "Bybit", "KuCoin", "MEXC", "Manual"]
                    .filter((ex) => ex.toLowerCase() !== assetToTransfer.exchange.toLowerCase())
                    .map((ex) => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                </select>
              </div>
            </div>

            {transferModalError && (
              <div className="mt-4 rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
                {transferModalError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={handleCloseTransferModal} disabled={Boolean(transferringAssetId)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleSubmitTransfer} disabled={Boolean(transferringAssetId)}>
                {transferringAssetId === assetToTransfer.id ? "Transferring..." : "Transfer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense>
      <PortfolioContent />
    </Suspense>
  );
}
