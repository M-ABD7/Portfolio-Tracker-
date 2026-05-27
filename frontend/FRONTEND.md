# Frontend Documentation

Next.js 16 frontend for the portfolio tracker.

## Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with Navbar
│   ├── page.tsx                # Dashboard (/)
│   ├── add-assets/page.tsx     # Add asset form
│   ├── analytics/page.tsx      # Performance charts
│   ├── onboarding/page.tsx     # Onboarding flow
│   ├── portfolio/page.tsx      # Portfolio table
│   ├── settings/page.tsx       # Debug / config / wrapper panels
│   ├── signal-allocation/page.tsx  # Signals + optimizer
│   ├── transactions/page.tsx   # Transaction history
│   └── api/portfolio/          # Proxy routes (one per backend endpoint)
│       ├── analytics/route.ts
│       ├── assets/route.ts
│       ├── config/route.ts
│       ├── debug/route.ts
│       ├── insights/route.ts
│       ├── live-price/route.ts
│       ├── overview/route.ts
│       ├── transactions/route.ts
│       └── wrapper/route.ts
├── components/
│   ├── ai/                     # Risk score, recommendations, strategy toggle
│   ├── analytics/              # PerformanceChart, PLByAssetClass
│   ├── dashboard/              # PortfolioSummary, TopPerformers, AssetDiversification
│   ├── layout/                 # Navbar
│   ├── onboarding/             # ConnectionOptions, ExchangeGrid, StepProgress
│   ├── portfolio/              # AssetTable, AddAssetForm, QuickAdd, CSVImport, JSONImport, ExchangeCard
│   └── ui/                     # Badge, Button, Card, ProgressBar, Tabs
├── lib/
│   ├── api.ts                  # All client-side fetch functions
│   └── types.ts                # Shared TypeScript types (must stay in sync with Django serializers)
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
| `/` | Dashboard | `fetchPortfolioOverview()` |
| `/portfolio` | Holdings table | `fetchPortfolioOverview()` |
| `/add-assets` | Add/sell asset | `createPortfolioAsset()`, `fetchLivePrice()` |
| `/analytics` | Performance charts | `fetchPortfolioAnalytics(period)` |
| `/signal-allocation` | Signals + optimizer | `fetchPortfolioInsights()` |
| `/transactions` | Transaction history | `fetchPortfolioTransactions()` |
| `/settings` | Debug / config panels | `fetchPortfolioDebug/Config/Wrapper()` |
| `/onboarding` | Exchange connect flow | — |

## API Functions (`lib/api.ts`)

| Function | Method | Proxy route |
|---|---|---|
| `fetchPortfolioOverview()` | GET | `/api/portfolio/overview/` |
| `fetchPortfolioAnalytics(period)` | GET | `/api/portfolio/analytics/?period=` |
| `fetchPortfolioInsights()` | GET | `/api/portfolio/insights/` |
| `fetchPortfolioTransactions()` | GET | `/api/portfolio/transactions/` |
| `createPortfolioAsset(input)` | POST | `/api/portfolio/assets/` |
| `sellPortfolioAsset(input)` | POST | `/api/portfolio/assets/` (sets `transactionType: "sell"`) |
| `deletePortfolioAsset(holdingId)` | DELETE | `/api/portfolio/assets/<id>/` |
| `fetchLivePrice(input)` | GET | `/api/portfolio/live-price/` |
| `fetchPortfolioDebug()` | GET | `/api/portfolio/debug/` |
| `fetchPortfolioWrapper()` | GET | `/api/portfolio/wrapper/` |
| `fetchPortfolioConfig()` | GET | `/api/portfolio/config/` |

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

### `portfolio/`
- `AssetTable` — full holdings table with edit/delete actions
- `AddAssetForm` — form to add a new holding with live price lookup
- `QuickAdd` — compact single-line add widget
- `CSVImport` / `JSONImport` — bulk import from file
- `ExchangeCard` — per-exchange summary card

### `ui/`
Reusable primitives: `Badge`, `Button`, `Card`, `ProgressBar`, `Tabs`.

## Types (`lib/types.ts`)

All shared types live here and must stay in sync with Django serializers. Key types:

- `Asset` — holding with price, P/L, signal fields
- `PortfolioSummary` — totals and day/all-time change
- `TopPerformer` — symbol, return %, direction
- `ExchangeData` — per-exchange aggregated values
- `PortfolioAnalytics` — chart series + asset breakdown
- `PortfolioInsights` — signals, risk, allocation profiles
- `Transaction` — buy/sell/transfer record
- `PortfolioDebug` / `PortfolioWrapper` / `PortfolioConfig` — settings page panels

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
