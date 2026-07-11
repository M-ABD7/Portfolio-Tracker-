"use client";

import { cn } from "@/lib/utils";

interface Exchange {
  id: string;
  name: string;
  logo: string;
  csvOnly?: boolean;
}

const ALL_EXCHANGES: Exchange[] = [
  { id: "okx", name: "OKX", logo: "O" },
  { id: "mexc", name: "MEXC", logo: "X" },
  { id: "binance", name: "Binance", logo: "B", csvOnly: true },
];

interface ExchangeGridProps {
  selected: string | null;
  onSelect: (id: string) => void;
  showCsvOnly?: boolean;
}

export function ExchangeGrid({ selected, onSelect, showCsvOnly = true }: ExchangeGridProps) {
  const exchanges = showCsvOnly
    ? ALL_EXCHANGES
    : ALL_EXCHANGES.filter((e) => !e.csvOnly);

  return (
    <div>
      <p className="text-sm text-foreground-muted mb-4">Supported Exchanges</p>
      <div className="flex flex-wrap gap-4">
        {exchanges.map((exchange) => {
          const isSelected = selected === exchange.id;
          return (
            <button
              key={exchange.id}
              onClick={() => onSelect(exchange.id)}
              className={cn(
                "flex flex-col items-center justify-center w-28 h-28 rounded-xl border transition-all relative",
                isSelected
                  ? "border-accent-primary bg-accent-primary/10"
                  : "border-border bg-background-card hover:border-accent-primary/50"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold mb-1",
                  isSelected
                    ? "bg-accent-primary text-background"
                    : "bg-background-secondary text-foreground"
                )}
              >
                {exchange.logo}
              </div>
              <span className="text-xs text-foreground">{exchange.name}</span>
              {exchange.csvOnly && (
                <span className="text-[10px] text-foreground-muted mt-0.5">CSV only</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
