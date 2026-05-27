"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/components/ui";
import { FileUp, Copy, Download, AlertCircle, CheckCircle } from "lucide-react";
import type { Asset, AssetClass } from "@/lib/types";

interface CSVImportProps {
  onImport: (assets: Omit<Asset, "id">[]) => void;
}

const CSV_TEMPLATE = `name,symbol,quantity,avgBuyPrice,assetClass,exchange
Bitcoin,BTC,0.5,45000,crypto,Binance
Ethereum,ETH,2.0,2500,crypto,Binance
Gold,XAU,10,1800,commodities,Manual`;

export function CSVImport({ onImport }: CSVImportProps) {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): Omit<Asset, "id">[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) throw new Error("CSV must have a header and at least one data row");

    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const requiredHeaders = ["name", "symbol", "quantity", "avgbuyprice"];
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(", ")}`);

    const assets: Omit<Asset, "id">[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      if (values.length < headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => (row[h] = values[idx]));

      const quantity = parseFloat(row.quantity);
      const avgBuyPrice = parseFloat(row.avgbuyprice);
      const currentPrice = parseFloat(row.currentprice || row.avgbuyprice || "0");

      if (isNaN(quantity) || isNaN(avgBuyPrice) || isNaN(currentPrice)) {
        throw new Error(`Invalid numbers in row ${i + 1}`);
      }

      const value = quantity * currentPrice;
      const pl = (currentPrice - avgBuyPrice) * quantity;
      const plPercentage = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

      assets.push({
        name: row.name,
        symbol: row.symbol.toUpperCase(),
        quantity,
        avgBuyPrice,
        currentPrice,
        value,
        pl,
        plPercentage,
        assetClass: (row.assetclass as AssetClass) || "crypto",
        exchange: row.exchange || "Manual",
      });
    }
    return assets;
  };

  const handleImport = () => {
    setError(null);
    setSuccess(null);
    try {
      const assets = parseCSV(csvText);
      if (assets.length === 0) throw new Error("No valid assets found");
      onImport(assets);
      setSuccess(`Successfully imported ${assets.length} asset(s)`);
      setCsvText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target?.result as string);
      setError(null);
      setSuccess(null);
    };
    reader.readAsText(file);
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(CSV_TEMPLATE);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio_template.csv";
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="w-5 h-5 text-accent-primary" />
          Import from CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyTemplate}>
            <Copy className="w-4 h-4" /> Copy Template
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4" /> Download Template
          </Button>
        </div>

        <div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileUp className="w-4 h-4" /> Upload CSV File
          </Button>
        </div>

        <div>
          <label className="text-sm text-foreground-muted block mb-2">Or paste CSV data:</label>
          <textarea
            className="w-full h-32 px-4 py-2 bg-background-secondary border border-border rounded-lg text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary resize-none"
            placeholder={CSV_TEMPLATE}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
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

        <Button variant="primary" onClick={handleImport} disabled={!csvText.trim()}>
          Import Assets
        </Button>
      </CardContent>
    </Card>
  );
}

