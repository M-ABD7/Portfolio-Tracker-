"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { Asset } from "@/lib/types";

interface AssetDiversificationProps {
  assets: Asset[];
}

export function AssetDiversification({ assets }: AssetDiversificationProps) {
  // Calculate totals by asset class
  const cryptoTotal = assets
    .filter((a) => a.assetClass === "crypto")
    .reduce((sum, a) => sum + a.value, 0);
  const forexTotal = assets
    .filter((a) => a.assetClass === "forex")
    .reduce((sum, a) => sum + a.value, 0);
  const commoditiesTotal = assets
    .filter((a) => a.assetClass === "commodities")
    .reduce((sum, a) => sum + a.value, 0);

  const data = [
    { name: "Crypto", value: cryptoTotal, color: "#00d9ff" },
    { name: "Forex", value: forexTotal, color: "#a855f7" },
    { name: "Commodities", value: commoditiesTotal, color: "#f472b6" },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Asset Class Diversification</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1c2128",
                  border: "1px solid #30363d",
                  borderRadius: "8px",
                }}
                formatter={(value) =>
                  typeof value === "number"
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                      }).format(value)
                    : value
                }
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-foreground-muted text-sm">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

