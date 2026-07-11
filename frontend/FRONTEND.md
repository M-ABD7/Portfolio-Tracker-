# Frontend Documentation

Next.js 16 frontend for the portfolio tracker.

## Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Root redirect
│   ├── login/page.tsx          # Login
│   ├── signup/page.tsx         # Register
│   ├── onboarding/page.tsx     # Exchange connect flow
│   ├── dashboard/page.tsx      # Main dashboard
│   ├── portfolio/page.tsx      # Holdings table
│   ├── add-assets/page.tsx     # Add/sell asset form
│   ├── analytics/page.tsx      # Performance charts
│   ├── signal-allocation/page.tsx  # Signals + optimizer
│   ├── transactions/page.tsx   # Transaction history
│   ├── ai-suggestions/page.tsx # AI recommendations
│   ├── wallets/page.tsx        # Wallet management
│   ├── calculators/page.tsx    # Financial calculators
│   ├── settings/page.tsx       # Account settings
│   ├── admin-panel/            # Admin user management
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/                    # Proxy routes — thin pass-throughs to Django
│       ├── auth/               # login, register, logout, me, delete
│       ├── admin/users/        # admin user list + [userId]
│       ├── portfolio/
│       │   ├── overview/
│       │   ├── analytics/
│       │   ├── insights/
│       │   ├── assets/         # + assets/[id]/
│       │   ├── transactions/   # + transactions/[id]/
│       │   ├── transfer/
│       │   ├── live-price/
│       │   └── exchange/       # connect, connections, connections/[id], connections/[id]/sync
│       ├── settings/
│       ├── security/           # password, two-factor
│       ├── connections/        # + connections/[connectionId]/
│       └── wallets/
├── components/
│   ├── ai/                     # RiskScore, Recommendations, DiversificationTips, StrategyToggle, PortfolioSummaryCard
│   ├── analytics/              # PerformanceChart, PLByAssetClass
│   ├── dashboard/              # PortfolioSummary, TopPerformers, AssetDiversification, AssetClassCards
│   ├── layout/                 # Navbar, AdminNavbar, PublicNavbar, AppShell, LayoutShell, ConditionalNav
│   ├── onboarding/             # ApiKeyForm, ConnectionOptions, ExchangeGrid, StepProgress
│   ├── portfolio/              # AssetTable, AddAssetForm, QuickAdd, CSVImport, JSONImport, ExchangeCard, ExchangeConnections
│   └── ui/                     # Badge, Button, Card, ProgressBar, Tabs
├── lib/
│   ├── api.ts                  # All client-side fetch functions
│   ├── types.ts                # Shared TypeScript types (must stay in sync with Django serializers)
│   ├── auth.ts                 # Auth state helpers (get/set/clear session)
│   ├── auth-header.ts          # Builds Authorization header from stored token
│   ├── data.ts                 # Static/mock data helpers
│   └── server-proxy.ts         # Server-side proxy helper used by route handlers
├── middleware.ts                # Auth guard — redirects unauthenticated users to /login
└── public/
```

## Request Flow

```
Browser → Next.js page → lib/api.ts → /app/api/portfolio/<endpoint>/route.ts → Django :8000/api/
```

The proxy routes are thin pass-throughs. All business logic lives in Django. The backend URL is set by `DJANGO_API_BASE_URL` (defaults to `http://127.0.0.1:8000/api`).

## Pages

| Route | Page | Data source |
|---|---|---|
| `/login` | Login | `loginUser()` |
| `/signup` | Register | `registerUser()` |
| `/onboarding` | Exchange connect flow | `connectExchange()` |
| `/dashboard` | Main dashboard | `fetchPortfolioOverview()` |
| `/portfolio` | Holdings table | `fetchPortfolioOverview()` |
| `/add-assets` | Add/sell asset | `createPortfolioAsset()`, `fetchLivePrice()` |
| `/analytics` | Performance charts | `fetchPortfolioAnalytics(period)` |
| `/signal-allocation` | Signals + optimizer | `fetchPortfolioInsights()` |
| `/transactions` | Transaction history | `fetchPortfolioTransactions()` |
| `/ai-suggestions` | AI recommendations | `fetchPortfolioInsights()` |
| `/wallets` | Wallet management | — |
| `/calculators` | Financial calculators | — |
| `/settings` | Account settings | `fetchSettings()`, `updateSettings()` |
| `/admin-panel` | Admin user management | `fetchAdminUsers()`, `updateAdminUser()` |

## API Functions (`lib/api.ts`)

### Auth

| Function | Method | Proxy route |
|---|---|---|
| `loginUser(input)` | POST | `/api/auth/login/` |
| `registerUser(input)` | POST | `/api/auth/register/` |
| `logoutUser()` | POST | `/api/auth/logout/` |
| `getCurrentUser()` | GET | `/api/auth/me/` |
| `deleteAccount(password)` | DELETE | `/api/auth/delete/` |

### Settings & Admin

| Function | Method | Proxy route |
|---|---|---|
| `fetchSettings()` | GET | `/api/settings/` |
| `updateSettings(input)` | PUT | `/api/settings/` |
| `fetchAdminUsers()` | GET | `/api/admin/users/` |
| `updateAdminUser(userId, input)` | PATCH | `/api/admin/users/<userId>/` |

### Portfolio

| Function | Method | Proxy route |
|---|---|---|
| `fetchPortfolioOverview()` | GET | `/api/portfolio/overview/` |
| `fetchPortfolioAnalytics(period)` | GET | `/api/portfolio/analytics/?period=` |
| `fetchPortfolioInsights()` | GET | `/api/portfolio/insights/` |
| `fetchPortfolioTransactions()` | GET | `/api/portfolio/transactions/` |
| `revertTransaction(id)` | DELETE | `/api/portfolio/transactions/<id>/` |
| `createPortfolioAsset(input)` | POST | `/api/portfolio/assets/` |
| `sellPortfolioAsset(input)` | POST | `/api/portfolio/assets/` (sets `transactionType: "sell"`) |
| `transferPortfolioAsset(input)` | POST | `/api/portfolio/transfer/` |
| `deletePortfolioAsset(holdingId)` | DELETE | `/api/portfolio/assets/<id>/` |
| `fetchLivePrice(input)` | GET | `/api/portfolio/live-price/` |

### Exchange Connections

| Function | Method | Proxy route |
|---|---|---|
| `connectExchange(input)` | POST | `/api/portfolio/exchange/connect/` |
| `listExchangeConnections()` | GET | `/api/portfolio/exchange/connections/` |
| `removeExchangeConnection(id)` | DELETE | `/api/portfolio/exchange/connections/<id>/` |
| `syncExchangeConnection(id)` | POST | `/api/portfolio/exchange/connections/<id>/sync/` |

## Components

### `ai/`
- `RiskScore` — displays portfolio risk score
- `Recommendations` — AI-generated trade recommendations
- `DiversificationTips` — diversification suggestions
- `StrategyToggle` — switch between Conservative/Balanced/Aggressive
- `PortfolioSummaryCard` — compact summary card with AI context

### `analytics/`
- `PerformanceChart` — Recharts line/area chart of portfolio value over time
- `PLByAssetClass` — P/L breakdown bar chart by asset class

### `dashboard/`
- `PortfolioSummary` — total value, day change, all-time P/L
- `TopPerformers` — ranked list of best/worst performers
- `AssetDiversification` — pie chart of allocation by asset class
- `AssetClassCards` — per-class value cards (crypto, forex, commodities)

### `layout/`
- `Navbar` — main authenticated nav
- `AdminNavbar` — nav shown in the admin panel
- `PublicNavbar` — nav for unauthenticated pages (login, signup)
- `AppShell` — wrapper that applies the correct nav based on auth state
- `LayoutShell` — inner shell with sidebar and content area
- `ConditionalNav` — renders the right nav variant based on route

### `onboarding/`
- `ApiKeyForm` — API key + secret input form for exchange connection
- `ConnectionOptions` — choose between manual entry and exchange sync
- `ExchangeGrid` — grid of supported exchange logos to pick from
- `StepProgress` — step indicator for the onboarding wizard

### `portfolio/`
- `AssetTable` — full holdings table with edit/delete actions
- `AddAssetForm` — form to add a new holding with live price lookup
- `QuickAdd` — compact single-line add widget
- `CSVImport` / `JSONImport` — bulk import from file
- `ExchangeCard` — per-exchange summary card
- `ExchangeConnections` — manage active exchange API key connections

### `ui/`
Reusable primitives: `Badge`, `Button`, `Card`, `ProgressBar`, `Tabs`.

## Types (`lib/types.ts`)

All shared types live here and must stay in sync with Django serializers.

### Core domain
- `AssetClass` — `"crypto" | "forex" | "commodities"`
- `Asset` — holding with price, P/L, signal fields, optional per-exchange `holdings[]`
- `ExchangeData` — per-exchange aggregated values and asset list
- `PortfolioSummary` — total value, P/L, daily change

### Analytics
- `AssetPerformance` — daily value series for a single asset (used in area/line charts)
- `PLByAssetClass` — P/L aggregated by asset class (used in bar chart)
- `PortfolioAnalytics` — full analytics payload (`assetPerformance`, `plByAssetClass`, `assets`)

### Dashboard
- `TopPerformer` — symbol, return %, direction

### Transactions
- `Transaction` — buy/sell/transfer record

### Insights / AI
- `Recommendation` — BUY/HOLD/SELL suggestion with signal price, support/resistance, indicator prediction
- `DiversificationTip` — success/warning tip message
- `AllocationProfile` — one optimizer profile (Conservative/Balanced/Aggressive) with weights, return, sharpe
- `PortfolioInsights` — full insights payload (risk score, recommendations, diversification tips, allocation)

### Auth
- `AuthUser` — authenticated user (id, username, email, isStaff, theme, currency, notifications, twoFactorEnabled)
- `UserSettings` — persisted account settings (theme, currency, notifications, twoFactorEnabled)
- `NotificationPreferences` — priceAlerts, portfolioUpdates, newsletters flags

### Onboarding
- `OnboardingStep` — step id, title, description, completed flag

### Exchange connections
- `SupportedExchange` — `"binance" | "okx" | "mexc" | "kraken"`
- `ExchangeConnection` — active connection (id, exchange, maskedKey, isActive, lastSyncedAt, permissionsWarning)
- `ConnectExchangeInput` — exchange, apiKey, apiSecret, passphrase
- `ConnectExchangeResponse` — connection result with holdingsSynced count and created flag
- `ExchangeSyncResult` — sync result with synced, added, updated counts

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DJANGO_API_BASE_URL` | `http://127.0.0.1:8000/api` | Backend base URL used by proxy routes |

## Commands

```powershell
cd frontend
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Tech Stack

- **Next.js 16** — App Router, route handlers as proxies
- **TypeScript** — strict mode
- **Tailwind CSS 4** — utility-first styling
- **Recharts** — charting library
