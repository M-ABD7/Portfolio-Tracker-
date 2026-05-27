"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2, X, Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import {
  listExchangeConnections,
  removeExchangeConnection,
  syncExchangeConnection,
} from "@/lib/api";
import type { ExchangeConnection } from "@/lib/types";

const EXCHANGE_LABELS: Record<string, string> = {
  binance: "Binance",
  okx: "OKX",
  mexc: "MEXC",
  kraken: "Kraken",
};

const EXCHANGE_LOGO: Record<string, string> = {
  binance: "B",
  okx: "O",
  mexc: "X",
  kraken: "K",
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface PermissionWarningProps {
  message: string;
  onDismiss: () => void;
}

function PermissionWarning({ message, onDismiss }: PermissionWarningProps) {
  return (
    <div className="flex gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mt-3">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-xs font-medium text-amber-300 mb-0.5">Disable dangerous permissions</p>
        <p className="text-xs text-amber-300/80 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400/60 hover:text-amber-400 transition-colors shrink-0"
        title="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ExchangeConnectionsProps {
  onSyncComplete?: () => void;
}

export function ExchangeConnections({ onSyncComplete }: ExchangeConnectionsProps) {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [syncMessages, setSyncMessages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function loadConnections() {
    try {
      const data = await listExchangeConnections();
      setConnections(data.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exchange connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  async function handleSync(id: string) {
    setSyncingId(id);
    setSyncMessages((prev) => ({ ...prev, [id]: "" }));
    try {
      const result = await syncExchangeConnection(id);
      setSyncMessages((prev) => ({
        ...prev,
        [id]: `Synced ${result.synced} balance${result.synced !== 1 ? "s" : ""} (${result.added} added, ${result.updated} updated).`,
      }));
      await loadConnections();
      onSyncComplete?.();
    } catch (err) {
      setSyncMessages((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : "Sync failed.",
      }));
    } finally {
      setSyncingId(null);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      await removeExchangeConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove connection.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-foreground-muted py-4">Loading exchange connections…</div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
        <Plug className="w-8 h-8 text-foreground-muted" />
        <p className="text-sm text-foreground-muted">
          No exchange connections yet.
          <br />
          Connect an exchange from the{" "}
          <a href="/onboarding" className="text-accent-primary hover:underline">
            onboarding page
          </a>{" "}
          to sync your balances automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {connections.map((conn) => {
        const label = EXCHANGE_LABELS[conn.exchange] ?? conn.exchange;
        const logo = EXCHANGE_LOGO[conn.exchange] ?? conn.exchange[0].toUpperCase();
        const isSyncing = syncingId === conn.id;
        const isRemoving = removingId === conn.id;
        const showWarning =
          !!conn.permissionsWarning && !dismissedWarnings.has(conn.id);

        return (
          <Card key={conn.id}>
            <CardContent>
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-lg shrink-0">
                  {logo}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5 font-mono">
                    Key: {conn.maskedKey}
                  </p>
                  <p className="text-xs text-foreground-muted mt-0.5">
                    Last synced: {formatSyncTime(conn.lastSyncedAt)}
                  </p>

                  {syncMessages[conn.id] && (
                    <p className="text-xs text-accent-primary mt-1">{syncMessages[conn.id]}</p>
                  )}

                  {showWarning && (
                    <PermissionWarning
                      message={conn.permissionsWarning!}
                      onDismiss={() =>
                        setDismissedWarnings((prev) => new Set([...prev, conn.id]))
                      }
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={isSyncing || isRemoving}
                    title="Sync now"
                    className="p-2 rounded-lg border border-border text-foreground-muted hover:text-accent-primary hover:border-accent-primary/40 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleRemove(conn.id)}
                    disabled={isSyncing || isRemoving}
                    title="Remove connection"
                    className="p-2 rounded-lg border border-border text-foreground-muted hover:text-red-400 hover:border-red-400/40 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
