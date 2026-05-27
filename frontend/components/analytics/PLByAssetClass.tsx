"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PLByAssetClass as PLByAssetClassType } from "@/lib/types";

interface PLByAssetClassProps {
  data: PLByAssetClassType[];
}

export function PLByAssetClass({ data }: PLByAssetClassProps) {
  const chartData = data.map((item) => ({
    name: item.assetClass.charAt(0).toUpperCase() + item.assetClass.slice(1),
    value: item.profitLoss,
    color: item.color,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>P/L by Asset Class</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal />
              <XAxis
                type="number"
                stroke="#8b949e"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value)
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#8b949e"
                fontSize={12}
                tickLine={false}
                width={100}
              />
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
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

