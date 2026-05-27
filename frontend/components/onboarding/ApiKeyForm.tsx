"use client";

import { useState } from "react";
import { AlertTriangle, Eye, EyeOff, CheckCircle } from "lucide-react";
import { connectExchange } from "@/lib/api";
import type { ConnectExchangeResponse } from "@/lib/types";

const EXCHANGE_LABELS: Record<string, string> = {
  binance: "Binance",
  okx: "OKX",
};

const READ_ONLY_GUIDES: Record<string, string> = {
  binance:
    'In Binance → API Management, create a key with only "Enable Reading" checked. ' +
    "Do NOT enable Spot/Margin Trading, Futures, or Withdrawals.",
  okx:
    'In OKX → API → Create V5 API Key, set permissions to "Read" only. ' +
    "Do NOT enable Trade or Withdraw permissions.",
};

interface ApiKeyFormProps {
  exchange: string;
  onSuccess: (connection: ConnectExchangeResponse) => void;
  onCancel: () => void;
}

export function ApiKeyForm({ exchange, onSuccess, onCancel }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = EXCHANGE_LABELS[exchange] ?? exchange;
  const guide = READ_ONLY_GUIDES[exchange];
  const needsPassphrase = exchange === "okx";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await connectExchange({
        exchange,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        ...(needsPassphrase ? { passphrase: passphrase.trim() } : {}),
      });
      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Connect {label}</h3>
        <p className="text-sm text-foreground-muted mt-1">
          Enter your read-only API credentials. This tracker will never trade, withdraw, or transfer on your behalf.
        </p>
      </div>

      {/* Read-only guide */}
      {guide && (
        <div className="flex gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300 leading-relaxed">{guide}</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* API Key */}
        <div>
          <label className="block text-sm text-foreground-muted mb-1">API Key</label>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key here"
            required
            autoComplete="off"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
          />
        </div>

        {/* API Secret */}
        <div>
          <label className="block text-sm text-foreground-muted mb-1">API Secret</label>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Paste your API secret here"
              required
              autoComplete="off"
              className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Passphrase (OKX only) */}
        {needsPassphrase && (
          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              Passphrase <span className="text-foreground-muted">(OKX only)</span>
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="The passphrase you set when creating the key"
                required
                autoComplete="off"
                className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent-primary transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 border border-border text-foreground-muted rounded-lg text-sm font-medium hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || !apiKey || !apiSecret || (needsPassphrase && !passphrase)}
            className="flex-1 py-2 bg-accent-primary text-background rounded-lg text-sm font-medium hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Connecting…" : `Connect ${label}`}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ApiKeySuccessProps {
  result: ConnectExchangeResponse;
  onDone: () => void;
}

export function ApiKeySuccess({ result, onDone }: ApiKeySuccessProps) {
  const label = EXCHANGE_LABELS[result.exchange] ?? result.exchange;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">{label} Connected</h3>
          <p className="text-sm text-foreground-muted">
            {result.holdingsSynced} balance{result.holdingsSynced !== 1 ? "s" : ""} synced to your portfolio.
          </p>
        </div>
      </div>

      {result.warning && (
        <div className="flex gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-300">Action required - disable dangerous permissions</p>
            <p className="text-xs text-amber-300/80 leading-relaxed">{result.warning}</p>
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        className="w-full py-2 bg-accent-primary text-background rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
