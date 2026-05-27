"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { AssetTable } from "./AssetTable";
import type { Asset, ExchangeData } from "@/lib/types";

interface ExchangeCardProps {
  exchange: ExchangeData;
  deletingAssetId?: string | null;
  sellingAssetId?: string | null;
  onDeleteAsset?: (asset: Asset) => void;
  onSellAsset?: (asset: Asset) => void;
}

export function ExchangeCard({ exchange, deletingAssetId, sellingAssetId, onDeleteAsset, onSellAsset }: ExchangeCardProps) {
  if (exchange.assets.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>Exchange: {exchange.name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <AssetTable
          assets={exchange.assets}
          deletingAssetId={deletingAssetId}
          sellingAssetId={sellingAssetId}
          onDelete={onDeleteAsset}
          onSell={onSellAsset}
        />
      </CardContent>
    </Card>
  );
}
