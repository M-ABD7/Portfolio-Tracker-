"use client";

import { formatCurrency, formatQuantity, cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";
import { Button } from "@/components/ui";
import { Trash2, ArrowLeftRight } from "lucide-react";

interface AssetTableProps {
  assets: Asset[];
  deletingAssetId?: string | null;
  sellingAssetId?: string | null;
  transferringAssetId?: string | null;
  onDelete?: (asset: Asset) => void;
  onSell?: (asset: Asset) => void;
  onTransfer?: (asset: Asset) => void;
}

export function AssetTable({ assets, deletingAssetId, sellingAssetId, transferringAssetId, onDelete, onSell, onTransfer }: AssetTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Asset
            </th>
            <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Quantity
            </th>
            <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Current Price
            </th>
            <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
              Value
            </th>
            <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
              P/L
            </th>
            {onTransfer && (
              <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Transfer
              </th>
            )}
            {onSell && (
              <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Sell
              </th>
            )}
            {onDelete && (
              <th className="text-right py-3 px-2 text-xs font-medium text-foreground-muted uppercase tracking-wider">
                Delete
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr
              key={asset.id}
              className="border-b border-border/50 hover:bg-background-secondary/50 transition-colors"
            >
              <td className="py-4 px-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{asset.name}</span>
                    <span className="text-foreground-muted text-sm">({asset.symbol})</span>
                  </div>
                  <span className="text-xs text-foreground-muted">{asset.exchange}</span>
                </div>
              </td>
              <td className="py-4 px-2 text-right text-foreground">{formatQuantity(asset.quantity)}</td>
              <td className="py-4 px-2 text-right text-foreground">
                {formatCurrency(asset.currentPrice)}
              </td>
              <td className="py-4 px-2 text-right text-foreground">
                {formatCurrency(asset.value)}
              </td>
              <td className="py-4 px-2 text-right">
                <span
                  className={cn(
                    "font-medium",
                    asset.pl >= 0 ? "text-accent-success" : "text-accent-danger"
                  )}
                >
                  {asset.pl >= 0 ? "+" : ""}
                  {formatCurrency(asset.pl)}
                </span>
              </td>
              {onTransfer && (
                <td className="py-4 px-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTransfer(asset)}
                    disabled={transferringAssetId === asset.id}
                    className="text-accent-primary hover:text-accent-primary"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    {transferringAssetId === asset.id ? "Transferring..." : "Transfer"}
                  </Button>
                </td>
              )}
              {onSell && (
                <td className="py-4 px-2 text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSell(asset)}
                    disabled={sellingAssetId === asset.id}
                    className="text-accent-warning hover:text-accent-warning"
                  >
                    {sellingAssetId === asset.id ? "Selling..." : "Sell"}
                  </Button>
                </td>
              )}
              {onDelete && (
                <td className="py-4 px-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(asset)}
                    disabled={deletingAssetId === asset.id}
                    className="text-accent-danger hover:text-accent-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingAssetId === asset.id ? "Deleting..." : "Delete"}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



