# Backend Documentation

Django REST Framework backend for the portfolio tracker.

## Structure

```
backend/
└── tracker/
    ├── manage.py
    ├── tracker/          # Django project config
    │   ├── settings.py
    │   ├── urls.py       # mounts portfolio/ under /api/
    │   ├── wsgi.py
    │   └── asgi.py
    └── portfolio/        # Single app with all business logic
        ├── models.py
        ├── api.py
        ├── urls.py
        ├── data_fetcher.py
        ├── indicators.py
        ├── signals.py
        ├── optimizer.py
        ├── asset_manager.py
        ├── backtest.py
        └── market_data/  # Excel workbooks cached per symbol
```

## Models (`models.py`)

| Model | Key Fields | Notes |
|---|---|---|
| `Asset` | `symbol`, `name`, `asset_type`, `metadata` | `asset_type` values: `crypto`, `forex`, `commodity`, `stock` |
| `PricePoint` | `asset`, `timestamp`, `open/high/low/close`, `volume`, `indicators` | Unique on `(asset, timestamp)` |
| `Portfolio` | `user`, `name` | Tied to a Django `User`; demo uses `DEFAULT_USERNAME = "demo"` |
| `Holding` | `portfolio`, `asset`, `quantity`, `cost_basis`, `metadata` | Exchange stored in `metadata["exchange"]` |
| `Transaction` | `portfolio`, `asset`, `transaction_type`, `quantity`, `price`, `total` | Types: `buy`, `sell`, `transfer` |

Same asset symbol can exist on multiple exchanges — exchange lives on `Holding.metadata`, not `Asset`.

## API Endpoints (`portfolio/urls.py`)

All routes are mounted under `/api/` by the project `urls.py`.

| Method | Path | View | Description |
|---|---|---|---|
| GET | `/api/portfolio/overview/` | `portfolio_overview` | Dashboard data: holdings, summary, top performers, P/L by class |
| GET | `/api/portfolio/analytics/?period=` | `portfolio_analytics` | Performance charts, asset breakdown |
| GET | `/api/portfolio/insights/` | `portfolio_insights` | Signals, risk score, allocation profiles |
| GET | `/api/portfolio/transactions/` | `portfolio_transactions` | Full transaction history |
| POST | `/api/portfolio/assets/` | `portfolio_assets` | Add holding or record sell |
| DELETE | `/api/portfolio/assets/<holding_id>/` | `portfolio_asset_detail` | Delete holding + its transactions |
| GET | `/api/portfolio/live-price/` | `portfolio_live_price` | Live price via yfinance (60s cache) |
| GET | `/api/portfolio/debug/` | `portfolio_debug` | DB counts and integrity checks |
| GET | `/api/portfolio/wrapper/` | `portfolio_wrapper` | Lists all exposed endpoints |
| GET | `/api/portfolio/config/` | `portfolio_config` | Runtime config (defaults, asset classes, CORS) |
| GET | `/api/get-signal/<symbol>/` | `get_signal` | BUY/SELL/HOLD signal for a symbol |

## Key Modules

### `data_fetcher.py`
- `download_market_data(symbol, period, interval)` — fetches OHLCV from yfinance, saves to Excel
- `get_live_price(symbol)` — returns current price, cached for 60 s (`LIVE_PRICE_REFRESH_INTERVAL`)
- `fetch_timeframes(symbol)` — fetches multiple timeframes in one call
- `save_to_excel(df, symbol, timeframe)` — writes/updates `market_data/<symbol>.xlsx`

Price history in `PricePoint` is refreshed at most every 12 h (`PRICE_REFRESH_INTERVAL`).

### `indicators.py`
`add_indicators(df)` — adds these columns to a daily OHLC DataFrame using `pandas_ta`:
- `SMA_20`, `EMA_50`, `RSI_14`, `MACD`, `Support_20`, `Resistance_20`

### `signals.py`
`generate_signal(row)` — row-wise BUY/SELL/HOLD logic applied after indicators are computed.

### `optimizer.py`
Markowitz mean-variance optimization via `scipy.optimize.minimize`.
- Profiles: Conservative, Balanced, Aggressive
- Requires at least 2 assets with overlapping price history
- Fixed random seed 42 for reproducibility

### `asset_manager.py`
Handles the create/update/delete lifecycle for `Asset`, `Holding`, and `Transaction` records.

### `backtest.py`
Back-tests a simple strategy against historical price data.

## Signal Pipeline (order matters)

1. `data_fetcher.py` — fetch/cache OHLCV data
2. `indicators.py::add_indicators()` — compute technical indicators
3. `signals.py::generate_signal()` — apply BUY/SELL/HOLD rules per row
4. `api.py::compute_asset_signal_details()` — produce JSON payload

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `tracker_ms` | Database name |
| `POSTGRES_USER` | `postgres` | DB user |
| `POSTGRES_PASSWORD` | _(empty)_ | DB password |
| `POSTGRES_HOST` | `localhost` | DB host |
| `POSTGRES_PORT` | `5432` | DB port |
| `DJANGO_DEBUG` | `true` | Debug mode |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated CORS origins |

## Commands

```powershell
# Activate venv (from project root)
.\backend\venv\Scripts\Activate.ps1

# Run dev server
cd backend\tracker
python manage.py runserver

# Migrations
python manage.py makemigrations
python manage.py migrate

# Tests
python manage.py test portfolio
python manage.py test portfolio.tests.TestClassName.test_method_name
```

## Adding a New Endpoint

1. Write a view function in `portfolio/api.py`
2. Register the URL in `portfolio/urls.py`
3. Create the matching proxy route in `frontend/app/api/portfolio/<name>/route.ts`
4. Add a typed fetch function in `frontend/lib/api.ts`
5. Add the response type to `frontend/lib/types.ts`

## Auth

No authentication is implemented. All requests resolve to `DEFAULT_USERNAME = "demo"` / `DEFAULT_PORTFOLIO_NAME = "Main Portfolio"`.
