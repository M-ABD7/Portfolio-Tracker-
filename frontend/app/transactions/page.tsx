"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, Badge, Tabs } from "@/components/ui";
import { fetchPortfolioTransactions, revertTransaction } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, RotateCcw } from "lucide-react";
import type { Transaction } from "@/lib/types";

const filterTabs = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buy" },
  { id: "sell", label: "Sell" },
  { id: "transfer", label: "Transfer" },
];

export default function TransactionsPage() {
  const [filter, setFilter] = useState("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTransactions = async () => {
      try {
        const data = await fetchPortfolioTransactions();
        if (isMounted) {
          setTransactions(data.transactions);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load transaction history.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTransactions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredTransactions = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => t.type === filter)),
    [filter, transactions]
  );

  async function handleRevert(id: string) {
    setRevertingId(id);
    setRevertError(null);
    try {
      await revertTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : "Failed to revert transaction.");
    } finally {
      setRevertingId(null);
      setConfirmId(null);
    }
  }

  const getTypeIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "buy":
        return <ArrowDownRight className="w-5 h-5 text-accent-success" />;
      case "sell":
        return <ArrowUpRight className="w-5 h-5 text-accent-danger" />;
      case "transfer":
        return <ArrowLeftRight className="w-5 h-5 text-accent-primary" />;
    }
  };

  const getTypeBadge = (type: Transaction["type"]) => {
    switch (type) {
      case "buy":
        return <Badge variant="success">Buy</Badge>;
      case "sell":
        return <Badge variant="danger">Sell</Badge>;
      case "transfer":
        return <Badge variant="info">Transfer</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transaction History</h1>
        <p className="text-foreground-muted mt-1">
          Showing real transactions recorded when assets are added or updated through the portfolio tools.
        </p>
      </div>

      <Tabs tabs={filterTabs} defaultTab="all" variant="pills" onChange={setFilter} />

      {revertError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {revertError}
        </div>
      )}

      {loading && (
        <Card>
          <CardContent className="text-center py-10 text-foreground-muted">
            Loading transactions...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="text-sm text-accent-danger py-6">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {filteredTransactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-background-secondary flex items-center justify-center">
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{transaction.asset}</span>
                        <span className="text-foreground-muted text-sm">({transaction.symbol})</span>
                        {getTypeBadge(transaction.type)}
                      </div>
                      <p className="text-sm text-foreground-muted">
                        {new Date(transaction.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        | {" "}{transaction.exchange}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {transaction.quantity} x {formatCurrency(transaction.price)}
                      </p>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          transaction.type === "buy"
                            ? "text-accent-success"
                            : transaction.type === "sell"
                              ? "text-accent-danger"
                              : "text-foreground-muted"
                        )}
                      >
                        {transaction.type === "buy" ? "-" : transaction.type === "sell" ? "+" : ""}
                        {formatCurrency(transaction.total)}
                      </p>
                    </div>

                    {/* Revert button — not available for transfers */}
                    {transaction.type !== "transfer" && (
                      confirmId === transaction.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRevert(transaction.id)}
                            disabled={revertingId === transaction.id}
                            className="px-3 py-1.5 bg-accent-danger text-white rounded-lg text-xs font-medium hover:bg-accent-danger/90 disabled:opacity-50 transition-colors"
                          >
                            {revertingId === transaction.id ? "Reverting…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={revertingId === transaction.id}
                            className="px-3 py-1.5 border border-border text-foreground-muted rounded-lg text-xs font-medium hover:text-foreground disabled:opacity-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setConfirmId(transaction.id); setRevertError(null); }}
                          title="Revert this transaction"
                          className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12 text-foreground-muted">
              No {filter === "all" ? "" : filter} transactions found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
