"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AssetPerformance } from "@/lib/types";

interface PerformanceChartProps {
  data: AssetPerformance[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const assetValueMaps = data.map((asset) => {
    return {
      symbol: asset.symbol,
      name: asset.name,
      color: asset.color,
      values: new Map<string, number>(asset.data.map((item) => [item.day, item.value])),
    };
  });

  const days = Array.from(
    new Set<string>(
      assetValueMaps.flatMap((asset) => Array.from(asset.values.keys()))
    )
  );

  const chartData = days.map((day) => {
    const dataPoint: Record<string, string | number> = { day };
    assetValueMaps.forEach((asset) => {
      dataPoint[asset.symbol] = asset.values.get(day) ?? 0;
    });
    return dataPoint;
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Asset Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
              <XAxis
                dataKey="day"
                stroke="#8b949e"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#8b949e"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", {
                    notation: "compact",
                  }).format(value)
                }
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
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => (
                  <span className="text-foreground-muted text-sm">{value}</span>
                )}
              />
              {data.map((asset) => (
                <Line
                  key={asset.symbol}
                  type="monotone"
                  dataKey={asset.symbol}
                  name={asset.name}
                  stroke={asset.color}
                  strokeWidth={2}
                  dot={{ fill: asset.color, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

