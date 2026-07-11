// ============================================================
// lib/api.ts — All API calls to the Django backend
// Every function calls a Next.js proxy route under /app/api/
// which forwards the request to http://127.0.0.1:8000/api/
// ============================================================

import type {
  Asset,
  AuthUser,
  ConnectExchangeInput,
  ConnectExchangeResponse,
  CsvImportResponse,
  ExchangeConnection,
  ExchangeSyncResult,
  ExchangeData,
  PortfolioAnalytics,
  PortfolioInsights,
  PortfolioSummary,
  TopPerformer,
  Transaction,
  UserSettings,
} from "./types";

// ── Shared response shapes ────────────────────────────────────

export interface PortfolioOverviewResponse {
  portfolio: {
    username: string;
    name: string;
  };
  summary: PortfolioSummary;
  assets: Asset[];
  exchangeData: ExchangeData[];
  topPerformers: TopPerformer[];
  plByAssetClass: Array<{
    assetClass: string;
    profitLoss: number;
    color: string;
  }>;
}

export interface CreatePortfolioAssetInput {
  holdingId?: string;
  name: string;
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  assetClass: string;
  exchange: string;
  marketSymbol?: string;
  transactionType?: "buy" | "sell" | "transfer";
}

export interface SellPortfolioAssetInput {
  holdingId?: string;
  name: string;
  symbol: string;
  quantity: number;
  sellPrice: number;
  assetClass: string;
  exchange: string;
  marketSymbol?: string;
}

export interface LivePriceInput {
  symbol: string;
  assetClass: string;
  marketSymbol?: string;
}

export interface LivePriceResponse {
  symbol: string;
  marketSymbol: string;
  currentPrice: number;
  refreshedAt: string;
}

// ── Generic fetch helper ──────────────────────────────────────

async function apiRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return payload as T;
    }
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "Request failed. Please try again.";
    throw new Error(message);
  }

  return payload as T;
}

// ── Portfolio endpoints ───────────────────────────────────────

/** Dashboard overview — holdings, summary, top performers, P/L by class */
export function fetchPortfolioOverview() {
  return apiRequest<PortfolioOverviewResponse>("/api/portfolio/overview/");
}

/** Performance charts and asset breakdown for the analytics page */
export function fetchPortfolioAnalytics(period: string) {
  return apiRequest<PortfolioAnalytics>(`/api/portfolio/analytics/?period=${period}`);
}

/** Signals, risk score, allocation profiles for the insights page */
export function fetchPortfolioInsights() {
  return apiRequest<PortfolioInsights>("/api/portfolio/insights/");
}

/** Full transaction history */
export function fetchPortfolioTransactions() {
  return apiRequest<{ transactions: Transaction[] }>("/api/portfolio/transactions/");
}

/** Revert (undo) a single buy or sell transaction by ID. */
export function revertTransaction(id: string | number) {
  return apiRequest<{ message: string }>(`/api/portfolio/transactions/${id}/`, {
    method: "DELETE",
  });
}

/** Add a new asset (buy/transfer) or record a sell transaction */
export function createPortfolioAsset(input: CreatePortfolioAssetInput) {
  return apiRequest<{ message: string; asset: Asset | null }>("/api/portfolio/assets/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function sellPortfolioAsset(input: SellPortfolioAssetInput) {
  return createPortfolioAsset({
    holdingId: input.holdingId,
    name: input.name,
    symbol: input.symbol,
    quantity: input.quantity,
    avgBuyPrice: input.sellPrice,
    assetClass: input.assetClass,
    exchange: input.exchange,
    marketSymbol: input.marketSymbol,
    transactionType: "sell",
  });
}

export interface TransferPortfolioAssetInput {
  fromHoldingId: string;
  toExchange: string;
  symbol: string;
  assetClass: string;
  quantity: number;
}

export function transferPortfolioAsset(input: TransferPortfolioAssetInput) {
  return apiRequest<{ message: string; from: Asset | null; to: Asset }>(
    "/api/portfolio/transfer/",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

/**
 * Delete a holding entirely by its holding ID.
 * The backend also removes the related transactions.
 * holdingId comes from asset.id as returned by the overview endpoint.
 */
export function deletePortfolioAsset(holdingId: string) {
  return apiRequest<{ message: string }>(
    `/api/portfolio/assets/${holdingId}/`,
    { method: "DELETE" }
  );
}

/**
 * Upload a Binance Trade History CSV export. Bypasses apiRequest — it
 * forces Content-Type: application/json, which would break the multipart
 * boundary FormData needs.
 */
export async function uploadBinanceCsv(file: File): Promise<CsvImportResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/portfolio/import-csv/", {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return payload as CsvImportResponse;
    }
    const message =
      typeof payload?.error === "string" ? payload.error : "CSV import failed. Please try again.";
    throw new Error(message);
  }

  return payload as CsvImportResponse;
}

// ── Live price ────────────────────────────────────────────────

/**
 * Fetches the current market price for a single asset via yfinance.
 * Used by AddAssetForm to show the live price before the user saves.
 */
export function fetchLivePrice(input: LivePriceInput) {
  const params = new URLSearchParams({
    symbol: input.symbol,
    assetClass: input.assetClass,
    ...(input.marketSymbol ? { marketSymbol: input.marketSymbol } : {}),
  });
  return apiRequest<LivePriceResponse>(`/api/portfolio/live-price/?${params}`);
}

// ── Auth ──────────────────────────────────────────────────────

export interface LoginInput { username: string; password: string }
export interface RegisterInput { username: string; password: string; email?: string }
export interface AuthResponse { user: AuthUser }

/** Login — sets HttpOnly cookie via the proxy route, returns user info. */
export function loginUser(input: LoginInput) {
  return apiRequest<AuthResponse>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Register — creates account + sets HttpOnly cookie, returns user info. */
export function registerUser(input: RegisterInput) {
  return apiRequest<AuthResponse>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Logout — clears the auth cookie on the Next.js server. */
export function logoutUser() {
  return apiRequest<{ message: string }>("/api/auth/logout/", { method: "POST" });
}

/** Fetch the current authenticated user's info. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await apiRequest<{ authenticated: boolean; user: AuthUser | null }>("/api/auth/me/");
    return data.authenticated ? data.user : null;
  } catch {
    return null;
  }
}

/** Load persisted account settings from the backend. */
export function fetchSettings() {
  return apiRequest<{ settings: UserSettings }>("/api/settings/");
}

/** Persist account settings (theme, notifications, profile). */
export function updateSettings(input: Partial<UserSettings>) {
  return apiRequest<{ settings: UserSettings }>("/api/settings/", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Admin: list all registered users. */
export function fetchAdminUsers() {
  return apiRequest<{ users: AuthUser[] }>("/api/admin/users/");
}

/** Admin: update a user's active/staff status. */
export function updateAdminUser(
  userId: number,
  input: { isActive?: boolean; isStaff?: boolean }
) {
  return apiRequest<{ user: AuthUser }>(`/api/admin/users/${userId}/`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Admin: permanently delete a user account. */
export function deleteAdminUser(userId: number) {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/`, {
    method: "DELETE",
  });
}

/** Permanently delete the authenticated user's account after password confirmation. */
export function deleteAccount(password: string) {
  return apiRequest<{ message: string }>("/api/auth/delete/", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

// ── Exchange connections ──────────────────────────────────────

/** Connect an exchange via API key + secret. Validates the key and syncs balances. */
export function connectExchange(input: ConnectExchangeInput) {
  return apiRequest<ConnectExchangeResponse>("/api/portfolio/exchange/connect/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** List all active exchange connections for the current user. */
export function listExchangeConnections() {
  return apiRequest<{ connections: ExchangeConnection[] }>("/api/portfolio/exchange/connections/");
}

/** Remove (deactivate) an exchange connection. Holdings are kept. */
export function removeExchangeConnection(id: string) {
  return apiRequest<{ message: string }>(`/api/portfolio/exchange/connections/${id}/`, {
    method: "DELETE",
  });
}

/** Manually trigger a balance sync for an exchange connection. */
export function syncExchangeConnection(id: string) {
  return apiRequest<ExchangeSyncResult>(`/api/portfolio/exchange/connections/${id}/sync/`, {
    method: "POST",
  });
}

