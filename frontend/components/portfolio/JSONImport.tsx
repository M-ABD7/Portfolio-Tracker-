"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Code, Copy, AlertCircle, CheckCircle } from "lucide-react";
import type { Asset, AssetClass } from "@/lib/types";

interface JSONImportProps {
  onImport: (assets: Omit<Asset, "id">[]) => void;
}

const JSON_TEMPLATE = `[
  {
    "name": "Bitcoin",
    "symbol": "BTC",
    "quantity": 0.5,
    "avgBuyPrice": 45000,
    "assetClass": "crypto",
    "exchange": "Binance"
  }
]`;

export function JSONImport({ onImport }: JSONImportProps) {
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parseJSON = (text: string): Omit<Asset, "id">[] => {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSON must be an array of assets");

    return data.map((item, index) => {
      if (!item.symbol || !item.quantity || item.avgBuyPrice === undefined) {
        throw new Error(`Asset ${index + 1}: Missing required fields (symbol, quantity, avgBuyPrice)`);
      }

      const quantity = parseFloat(item.quantity);
      const avgBuyPrice = parseFloat(item.avgBuyPrice);
      const currentPrice = parseFloat(item.currentPrice ?? item.avgBuyPrice);

      if (isNaN(quantity) || isNaN(avgBuyPrice) || isNaN(currentPrice)) {
        throw new Error(`Asset ${index + 1}: Invalid number values`);
      }

      const value = quantity * currentPrice;
      const pl = (currentPrice - avgBuyPrice) * quantity;
      const plPercentage = avgBuyPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

      return {
        name: item.name || item.symbol,
        symbol: item.symbol.toUpperCase(),
        quantity,
        avgBuyPrice,
        currentPrice,
        value,
        pl,
        plPercentage,
        assetClass: (item.assetClass as AssetClass) || "crypto",
        exchange: item.exchange || "Manual",
      };
    });
  };

  const handleImport = () => {
    setError(null);
    setSuccess(null);
    try {
      const assets = parseJSON(jsonText);
      if (assets.length === 0) throw new Error("No assets found in JSON");
      onImport(assets);
      setSuccess(`Successfully imported ${assets.length} asset(s)`);
      setJsonText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse JSON");
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(JSON_TEMPLATE);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="w-5 h-5 text-accent-secondary" />
          Import from JSON
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" size="sm" onClick={copyTemplate}>
          <Copy className="w-4 h-4" /> Copy Template
        </Button>

        <div>
          <label className="text-sm text-foreground-muted block mb-2">Paste JSON data:</label>
          <textarea
            className="w-full h-40 px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            placeholder={JSON_TEMPLATE}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-accent-danger text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-accent-success text-sm">
            <CheckCircle className="w-4 h-4" /> {success}
          </div>
        )}

        <Button variant="primary" onClick={handleImport} disabled={!jsonText.trim()}>
          Import Assets
        </Button>
      </CardContent>
    </Card>
  );
}

