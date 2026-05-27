"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { Plus } from "lucide-react";
import type { Asset, AssetClass } from "@/lib/types";
import { fetchLivePrice } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

type PortfolioAssetDraft = Omit<Asset, "id" | "currentPrice" | "value" | "pl" | "plPercentage"> & {
  transactionType: "buy";
};

interface AddAssetFormProps {
  onAdd: (asset: PortfolioAssetDraft) => void;
}

type AssetOption = {
  name: string;
  symbol: string;
  marketSymbol?: string;
};

const assetClasses: AssetClass[] = ["crypto", "forex", "commodities"];

const exchangeOptions: Record<AssetClass, string[]> = {
  crypto: ["Binance", "MEXC", "OKX", "Kraken"],
  forex: ["Oanda", "MetaTrader", "FXCM", "Interactive Brokers"],
  commodities: ["CME", "ICE", "MetaTrader", "Manual"],
};

const assetCatalog: Record<AssetClass, AssetOption[]> = {
  crypto: [
    { name: "Bitcoin", symbol: "BTC", marketSymbol: "BTC-USD" },
    { name: "Ethereum", symbol: "ETH", marketSymbol: "ETH-USD" },
    { name: "Tether USD", symbol: "USDT", marketSymbol: "USDT-USD" },
    { name: "BNB", symbol: "BNB", marketSymbol: "BNB-USD" },
    { name: "XRP", symbol: "XRP", marketSymbol: "XRP-USD" },
    { name: "USD Coin", symbol: "USDC", marketSymbol: "USDC-USD" },
    { name: "Solana", symbol: "SOL", marketSymbol: "SOL-USD" },
    { name: "TRON", symbol: "TRX", marketSymbol: "TRX-USD" },
    { name: "Dogecoin", symbol: "DOGE", marketSymbol: "DOGE-USD" },
    { name: "Cardano", symbol: "ADA", marketSymbol: "ADA-USD" },
    { name: "Avalanche", symbol: "AVAX", marketSymbol: "AVAX-USD" },
    { name: "Chainlink", symbol: "LINK", marketSymbol: "LINK-USD" },
    { name: "Polkadot", symbol: "DOT", marketSymbol: "DOT-USD" },
    { name: "Litecoin", symbol: "LTC", marketSymbol: "LTC-USD" },
    { name: "Toncoin", symbol: "TON", marketSymbol: "TON-USD" },
  ],
  forex: [
    { name: "EUR/USD", symbol: "EURUSD", marketSymbol: "EURUSD=X" },
    { name: "GBP/USD", symbol: "GBPUSD", marketSymbol: "GBPUSD=X" },
    { name: "USD/JPY", symbol: "USDJPY", marketSymbol: "USDJPY=X" },
    { name: "USD/CHF", symbol: "USDCHF", marketSymbol: "USDCHF=X" },
    { name: "AUD/USD", symbol: "AUDUSD", marketSymbol: "AUDUSD=X" },
    { name: "EUR/GBP", symbol: "EURGBP", marketSymbol: "EURGBP=X" },
    { name: "USD/CAD", symbol: "USDCAD", marketSymbol: "USDCAD=X" },
    { name: "NZD/USD", symbol: "NZDUSD", marketSymbol: "NZDUSD=X" },
    { name: "EUR/JPY", symbol: "EURJPY", marketSymbol: "EURJPY=X" },
    { name: "GBP/JPY", symbol: "GBPJPY", marketSymbol: "GBPJPY=X" },
  ],
  commodities: [
    { name: "Gold", symbol: "XAU", marketSymbol: "GC=F" },
    { name: "Silver", symbol: "XAG", marketSymbol: "SI=F" },
    { name: "Copper", symbol: "COPPER", marketSymbol: "HG=F" },
    { name: "Platinum", symbol: "PLATINUM", marketSymbol: "PL=F" },
    { name: "Brent Oil", symbol: "BRENT", marketSymbol: "BZ=F" },
    { name: "Crude Oil WTI", symbol: "WTI", marketSymbol: "CL=F" },
    { name: "Natural Gas", symbol: "NATGAS", marketSymbol: "NG=F" },
  ],
};

export function AddAssetForm({ onAdd }: AddAssetFormProps) {
  const [formData, setFormData] = useState({
    assetName: assetCatalog.crypto[0].name,
    name: assetCatalog.crypto[0].name,
    symbol: assetCatalog.crypto[0].symbol,
    marketSymbol: assetCatalog.crypto[0].marketSymbol ?? "",
    quantity: "",
    avgBuyPrice: "",
    assetClass: "crypto" as AssetClass,
    exchange: exchangeOptions.crypto[0],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [livePriceError, setLivePriceError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadLivePrice = async () => {
      setLivePriceLoading(true);
      try {
        const data = await fetchLivePrice({
          symbol: formData.symbol,
          assetClass: formData.assetClass,
          marketSymbol: formData.marketSymbol,
        });
        if (isMounted) {
          setLivePrice(data.currentPrice);
          setLivePriceError(null);
        }
      } catch (err) {
        if (isMounted) {
          setLivePrice(null);
          setLivePriceError(err instanceof Error ? err.message : "Live price unavailable.");
        }
      } finally {
        if (isMounted) {
          setLivePriceLoading(false);
        }
      }
    };

    loadLivePrice();
    const intervalId = window.setInterval(loadLivePrice, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [formData.assetClass, formData.marketSymbol, formData.symbol]);

  const availableAssets = useMemo(() => assetCatalog[formData.assetClass], [formData.assetClass]);

  const updateSelectedAsset = (assetClass: AssetClass, assetName: string) => {
    const selected = assetCatalog[assetClass].find((asset) => asset.name === assetName) ?? assetCatalog[assetClass][0];
    setFormData((prev) => ({
      ...prev,
      assetClass,
      assetName: selected.name,
      name: selected.name,
      symbol: selected.symbol,
      marketSymbol: selected.marketSymbol ?? "",
      exchange: exchangeOptions[assetClass][0],
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.symbol.trim()) newErrors.symbol = "Symbol is required";
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      newErrors.quantity = "Valid quantity required";
    }
    if (!formData.avgBuyPrice || parseFloat(formData.avgBuyPrice) <= 0) {
      newErrors.avgBuyPrice = "Valid average buy price required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const quantity = parseFloat(formData.quantity);
    const avgBuyPrice = parseFloat(formData.avgBuyPrice);

    onAdd({
      name: formData.name,
      symbol: formData.symbol,
      marketSymbol: formData.marketSymbol,
      quantity,
      avgBuyPrice,
      assetClass: formData.assetClass,
      exchange: formData.exchange.trim() || "Manual",
      transactionType: "buy",
    });

    const firstAsset = assetCatalog[formData.assetClass][0];
    setFormData({
      assetName: firstAsset.name,
      name: firstAsset.name,
      symbol: firstAsset.symbol,
      marketSymbol: firstAsset.marketSymbol ?? "",
      quantity: "",
      avgBuyPrice: "",
      assetClass: formData.assetClass,
      exchange: exchangeOptions[formData.assetClass][0],
    });
    setErrors({});
  };

  const inputClass =
    "w-full px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent-primary";
  const labelClass = "text-sm text-foreground-muted block mb-2";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-accent-primary" />
          Add Asset Manually
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Asset Class</label>
              <select
                className={inputClass}
                value={formData.assetClass}
                onChange={(e) => updateSelectedAsset(e.target.value as AssetClass, assetCatalog[e.target.value as AssetClass][0].name)}
              >
                {assetClasses.map((ac) => (
                  <option key={ac} value={ac}>
                    {ac.charAt(0).toUpperCase() + ac.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Asset Name</label>
              <select
                className={inputClass}
                value={formData.assetName}
                onChange={(e) => updateSelectedAsset(formData.assetClass, e.target.value)}
              >
                {availableAssets.map((asset) => (
                  <option key={`${formData.assetClass}-${asset.symbol}`} value={asset.name}>
                    {asset.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Exchange / Source</label>
              <select
                className={inputClass}
                value={formData.exchange}
                onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
              >
                {exchangeOptions[formData.assetClass].map((exchange) => (
                  <option key={`${formData.assetClass}-${exchange}`} value={exchange}>
                    {exchange}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Symbol</label>
              <input type="text" className={inputClass} value={formData.symbol} readOnly />
            </div>
            <div>
              <label className={labelClass}>Market Symbol</label>
              <input type="text" className={inputClass} value={formData.marketSymbol} readOnly />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Quantity *</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                className={inputClass}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
              {errors.quantity && <p className="text-xs text-accent-danger mt-1">{errors.quantity}</p>}
            </div>
            <div>
              <label className={labelClass}>Avg. Buy Price *</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                className={inputClass}
                value={formData.avgBuyPrice}
                onChange={(e) => setFormData({ ...formData, avgBuyPrice: e.target.value })}
              />
              {errors.avgBuyPrice && <p className="text-xs text-accent-danger mt-1">{errors.avgBuyPrice}</p>}
            </div>
            <div>
              <label className={labelClass}>Current Price</label>
              <p className="text-lg font-semibold text-foreground">
                {livePrice === null ? "--" : formatCurrency(livePrice)}
              </p>
              <p className="text-xs text-foreground-muted mt-1">
                {livePriceLoading ? "Refreshing live price..." : "Refreshes every minute."}
              </p>
              {livePriceError && <p className="text-xs text-accent-danger mt-1">{livePriceError}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary">
              <Plus className="w-4 h-4" />
              Add Asset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}







