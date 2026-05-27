// ============================================================
// lib/types.ts — Shared TypeScript types for the entire app
// Keep in sync with the Django backend serializers in api.py
// ============================================================

// ── Core domain types ─────────────────────────────────────────

export type AssetClass = "crypto" | "forex" | "commodities";

export type Exchange = string;

/** A single asset holding as returned by the backend */
export interface Asset {
  id: string;
  name: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  pl: number;
  plPercentage: number;
  assetClass: AssetClass;
  exchange: string;
  marketSymbol?: string;
  /** Per-exchange breakdown when the same symbol is held on multiple exchanges */
  holdings?: Array<{ id: string; exchange: string; quantity: number }>;
}

/** Assets grouped by exchange (used on the Portfolio page) */
export interface ExchangeData {
  id: string;
  name: string;
  assets: Asset[];
  totalValue: number;
}

/** Summary numbers shown at the top of the Dashboard */
export interface PortfolioSummary {
  totalValue: number;
  totalProfitLoss: number;
  dailyChange: number;
  dailyChangePercentage: number;
}

// ── Analytics types ───────────────────────────────────────────

/** One day's value for a single asset (used in area/line charts) */
export interface AssetPerformance {
  name: string;
  symbol: string;
  color: string;
  data: { day: string; value: number }[];
}

/** Profit/Loss aggregated by asset class (used in bar chart) */
export interface PLByAssetClass {
  assetClass: AssetClass;
  profitLoss: number;
  color: string;
}

/** Full analytics payload returned by /api/portfolio/analytics/ */
export interface PortfolioAnalytics {
  assetPerformance: AssetPerformance[];
  plByAssetClass: PLByAssetClass[];
  assets: Asset[];
}

// ── Dashboard types ───────────────────────────────────────────

/** Top-performing asset shown on the dashboard */
export interface TopPerformer {
  name: string;
  symbol: string;
  changePercentage: number;
}

// ── Transaction types ─────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  type: "buy" | "sell" | "transfer";
  asset: string;
  symbol: string;
  quantity: number;
  price: number;
  total: number;
  exchange: string;
}

// ── Insights / AI suggestions types ──────────────────────────

export interface Recommendation {
  type: "buy" | "hold" | "sell";
  asset: string;
  symbol?: string;
  reason: string;
  color?: string;
  targetPrice?: number | null;
  targetLabel?: string | null;
  signalPrice?: number | null;
  signalDate?: string | null;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  lastActionSignal?: string | null;
  lastActionPrice?: number | null;
  lastActionTargetPrice?: number | null;
  lastActionTargetLabel?: string | null;
  lastActionDate?: string | null;
  indicatorPrediction?: string | null;
  indicatorTargetPrice?: number | null;
  timeframe?: string;
}

export interface DiversificationTip {
  type: "success" | "warning";
  message: string;
}

/** One portfolio allocation profile (Conservative / Balanced / Aggressive) */
export interface AllocationProfile {
  profile: string;
  weights: Array<{
    asset: string;
    weight: number;
  }>;
  return: number;
  variance: number;
  stdDev: number;
  sharpe: number;
}

/** Full insights payload returned by /api/portfolio/insights/ */
export interface PortfolioInsights {
  portfolioSummary: {
    cryptoPercentage: number;
    largestPositionPercentage: number;
  };
  riskScore: number;
  recommendations: Recommendation[];
  diversificationTips: DiversificationTip[];
  allocation: {
    profiles: AllocationProfile[];
    message: string;
  };
}

// ── Auth types ────────────────────────────────────────────────

export interface NotificationPreferences {
  priceAlerts: boolean;
  portfolioUpdates: boolean;
  newsletters: boolean;
}

/** Authenticated user info returned by /api/auth/me/ and /api/auth/login/ */
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  dateJoined: string;
  displayName?: string;
  isStaff?: boolean;
  isActive?: boolean;
  theme?: "dark" | "light";
  currency?: string;
  notifications?: NotificationPreferences;
  twoFactorEnabled?: boolean;
}

export interface UserSettings {
  username: string;
  displayName: string;
  email: string;
  currency: string;
  theme: "dark" | "light";
  notifications: NotificationPreferences;
  twoFactorEnabled: boolean;
}

// ── Onboarding types ──────────────────────────────────────────

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

// ── Exchange connection types ──────────────────────────────────

export type SupportedExchange = "binance" | "okx" | "mexc" | "kraken";

export interface ExchangeConnection {
  id: string;
  exchange: SupportedExchange;
  maskedKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  permissionsWarning: string | null;
}

export interface ConnectExchangeInput {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface ConnectExchangeResponse {
  id: string;
  exchange: string;
  maskedKey: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  warning: string | null;
  holdingsSynced: number;
  created: boolean;
}

export interface ExchangeSyncResult {
  synced: number;
  added: number;
  updated: number;
  warning: string | null;
}
