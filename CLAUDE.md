# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A multi-asset portfolio tracker supporting crypto, forex, and commodities. The frontend is a Next.js 16 app that proxies all requests to a Django REST Framework backend. Price data is fetched via `yfinance` and stored in PostgreSQL.

## Detailed Documentation

- [Backend](backend/BACKEND.md) — models, API endpoints, key modules, signal pipeline, env vars, commands
- [Frontend](frontend/FRONTEND.md) — pages, proxy routes, API functions, components, types, env vars, commands

## Architecture

```
portfolio_tracker/
├── frontend/          # Next.js 16 + TypeScript + Tailwind 4 + Recharts
└── backend/
    └── tracker/       # Django project root
        ├── tracker/   # Django settings/urls/wsgi
        └── portfolio/ # Single Django app with all business logic
```

### Request Flow

Browser → Next.js route handler (`/app/api/portfolio/<endpoint>/route.ts`) → Django (`http://127.0.0.1:8000/api/`) → PostgreSQL + yfinance

The Next.js API routes are thin proxies. All business logic lives in the Django `portfolio` app. The backend URL is controlled by the `DJANGO_API_BASE_URL` env var (defaults to `http://127.0.0.1:8000/api`).

### Backend Key Files

- `portfolio/api.py` — all DRF view functions and the payload-builder functions they call
- `portfolio/models.py` — `Asset`, `PricePoint`, `Portfolio`, `Holding`, `Transaction`
- `portfolio/data_fetcher.py` — yfinance wrappers (`download_market_data`, `get_live_price`, `fetch_timeframes`, `save_to_excel`)
- `portfolio/indicators.py` — `add_indicators()` computes SMA_20, EMA_50, RSI_14, MACD, Support_20, Resistance_20 using `pandas_ta`
- `portfolio/signals.py` — `generate_signal()` row-wise BUY/SELL/HOLD logic
- `portfolio/optimizer.py` — Markowitz mean-variance optimization via `scipy.optimize.minimize` (Conservative/Balanced/Aggressive profiles)

### Frontend Key Files

- `lib/types.ts` — all shared TypeScript types; must stay in sync with Django serializers
- `lib/api.ts` — all client-side API calls, each targeting a Next.js proxy route
- `app/api/portfolio/*/route.ts` — one proxy route file per backend endpoint
- `components/` — organized by feature: `ai/`, `analytics/`, `dashboard/`, `layout/`, `onboarding/`, `portfolio/`, `ui/`

### Data Model Notes

- The same asset symbol can exist on multiple exchanges (e.g., ETH on Binance and MEXC). Exchange is stored in `Holding.metadata["exchange"]`, not on `Asset`.
- `Asset.asset_type` uses DB values `crypto`/`forex`/`commodity` (singular). The API normalizes `commodity` → `commodities` for the frontend.
- Price history is stored in `PricePoint` rows, refreshed at most every 12 hours (`PRICE_REFRESH_INTERVAL`) or 60 seconds for live prices (`LIVE_PRICE_REFRESH_INTERVAL`).
- `portfolio/market_data/` holds Excel workbooks (one per yfinance symbol) with sheets for each timeframe plus `indicators_<tf>` and `signals_<tf>` sheets.
- The demo portfolio uses `DEFAULT_USERNAME = "demo"` / `DEFAULT_PORTFOLIO_NAME = "Main Portfolio"` — no auth is implemented.

## Commands

### Backend

```powershell
# Activate venv
.\backend\venv\Scripts\Activate.ps1

# Run Django dev server (from backend/tracker/)
cd backend\tracker
python manage.py runserver

# Migrations
python manage.py makemigrations
python manage.py migrate

# Run tests
python manage.py test portfolio

# Run a single test
python manage.py test portfolio.tests.TestClassName.test_method_name
```

### Frontend

```powershell
cd frontend
npm run dev      # development server on http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

### Environment Variables (Backend)

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `tracker_ms` | Database name |
| `POSTGRES_USER` | `postgres` | DB user |
| `POSTGRES_PASSWORD` | _(empty)_ | DB password |
| `POSTGRES_HOST` | `localhost` | DB host |
| `POSTGRES_PORT` | `5432` | DB port |
| `DJANGO_DEBUG` | `true` | Debug mode |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated CORS origins |

### Environment Variables (Frontend)

| Variable | Default | Description |
|---|---|---|
| `DJANGO_API_BASE_URL` | `http://127.0.0.1:8000/api` | Backend base URL used by proxy routes |

## Signal & Optimization Pipeline

Signals use daily OHLC data. The pipeline order is:
1. `data_fetcher.py` fetches/caches price data (Excel or DB)
2. `indicators.py::add_indicators()` computes technical indicators
3. `signals.py::generate_signal()` applies BUY/SELL/HOLD rules per row
4. `api.py::compute_asset_signal_details()` reads the signal frame and produces the JSON payload

The optimizer (`optimizer.py`) requires at least 2 assets with overlapping price history and uses a fixed random seed (42) for reproducibility.

## Adding a New API Endpoint

1. Add a view function in `portfolio/api.py`
2. Register the URL in `portfolio/urls.py`
3. Create `frontend/app/api/portfolio/<name>/route.ts` (copy an existing proxy route)
4. Add a typed fetch function in `frontend/lib/api.ts`
5. Add the response type to `frontend/lib/types.ts`
