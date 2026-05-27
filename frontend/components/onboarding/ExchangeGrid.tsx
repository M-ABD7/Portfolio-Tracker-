"use client";

import { cn } from "@/lib/utils";

interface Exchange {
  id: string;
  name: string;
  logo: string;
}

const exchanges: Exchange[] = [
  { id: "binance", name: "Binance", logo: "B" },
  { id: "okx", name: "OKX", logo: "O" },
  { id: "metatrader", name: "MetaTrader", logo: "M" },
  { id: "mexc", name: "MEXC", logo: "X" },
  { id: "kraken", name: "Kraken", logo: "K" },
];

interface ExchangeGridProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export function ExchangeGrid({ selected, onToggle }: ExchangeGridProps) {
  return (
    <div>
      <p className="text-sm text-foreground-muted mb-4">Supported Exchanges</p>
      <div className="flex flex-wrap gap-4">
        {exchanges.map((exchange) => {
          const isSelected = selected.includes(exchange.id);
          return (
            <button
              key={exchange.id}
              onClick={() => onToggle(exchange.id)}
              className={cn(
                "flex flex-col items-center justify-center w-24 h-24 rounded-xl border transition-all",
                isSelected
                  ? "border-accent-primary bg-accent-primary/10"
                  : "border-border bg-background-card hover:border-accent-primary/50"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold mb-2",
                  isSelected
                    ? "bg-accent-primary text-background"
                    : "bg-background-secondary text-foreground"
                )}
              >
                {exchange.logo}
              </div>
              <span className="text-xs text-foreground">{exchange.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

