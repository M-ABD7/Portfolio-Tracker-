"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { Zap, Plus, X } from "lucide-react";
import type { Asset, AssetClass } from "@/lib/types";

interface QuickAddProps {
  onAdd: (assets: Omit<Asset, "id">[]) => void;
}

interface QuickEntry {
  id: string;
  symbol: string;
  quantity: string;
  avgBuyPrice: string;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [entries, setEntries] = useState<QuickEntry[]>([
    { id: "1", symbol: "", quantity: "", avgBuyPrice: "" },
  ]);

  const addEntry = () => {
    setEntries([
      ...entries,
      { id: Date.now().toString(), symbol: "", quantity: "", avgBuyPrice: "" },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) return;
    setEntries(entries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: keyof QuickEntry, value: string) => {
    setEntries(
      entries.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleSubmit = () => {
    const validEntries = entries.filter(
      (e) =>
        e.symbol.trim() &&
        parseFloat(e.quantity) > 0 &&
        parseFloat(e.avgBuyPrice) > 0
    );

    if (validEntries.length === 0) return;

    const assets: Omit<Asset, "id">[] = validEntries.map((entry) => {
      const quantity = parseFloat(entry.quantity);
      const avgBuyPrice = parseFloat(entry.avgBuyPrice);
      const value = quantity * avgBuyPrice;

      return {
        name: entry.symbol.toUpperCase(),
        symbol: entry.symbol.toUpperCase(),
        quantity,
        avgBuyPrice,
        currentPrice: avgBuyPrice,
        value,
        pl: 0,
        plPercentage: 0,
        assetClass: "crypto" as AssetClass,
        exchange: "Manual",
      };
    });

    onAdd(assets);
    setEntries([{ id: "1", symbol: "", quantity: "", avgBuyPrice: "" }]);
  };

  const inputClass =
    "w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent-warning" />
          Quick Add
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground-muted">
          Quickly add multiple assets with symbol, quantity, and average buy price.
        </p>

        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-sm text-foreground-muted w-6">{index + 1}.</span>
              <input
                type="text"
                placeholder="Symbol (e.g., BTC)"
                className={inputClass}
                value={entry.symbol}
                onChange={(e) => updateEntry(entry.id, "symbol", e.target.value)}
              />
              <input
                type="number"
                step="any"
                placeholder="Quantity"
                className={inputClass}
                value={entry.quantity}
                onChange={(e) => updateEntry(entry.id, "quantity", e.target.value)}
              />
              <input
                type="number"
                step="any"
                placeholder="Avg Buy Price ($)"
                className={inputClass}
                value={entry.avgBuyPrice}
                onChange={(e) => updateEntry(entry.id, "avgBuyPrice", e.target.value)}
              />
              <button
                onClick={() => removeEntry(entry.id)}
                className="p-2 text-foreground-muted hover:text-accent-danger transition-colors"
                disabled={entries.length === 1}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={addEntry}>
            <Plus className="w-4 h-4" /> Add Row
          </Button>
        </div>

        <Button variant="primary" onClick={handleSubmit}>
          <Plus className="w-4 h-4" /> Add All Assets
        </Button>
      </CardContent>
    </Card>
  );
}

