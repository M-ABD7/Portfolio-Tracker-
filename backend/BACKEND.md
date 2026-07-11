# Backend Documentation

Django REST Framework backend for the portfolio tracker.

## Structure

```
backend/
├── tracker/              # Django project root (manage.py lives here)
│   ├── tracker/          # Django project config
│   │   ├── settings.py
│   │   ├── urls.py       # mounts portfolio/ under /api/
│   │   ├── wsgi.py
│   │   └── asgi.py
│   └── portfolio/        # Main app with all business logic
│       ├── models.py
│       ├── api.py
│       ├── auth_api.py
│       ├── urls.py
│       ├── data_fetcher.py
│       ├── indicators.py
│       ├── signals.py
│       ├── optimizer.py
│       ├── asset_manager.py
│       ├── backtest.py
│       ├── exchange_connectors.py
│       ├── encryption.py
│       └── market_data/  # Excel workbooks cached per symbol
└── apps/                 # Additional sub-apps (auxiliary, not all in INSTALLED_APPS)
    ├── users/            # User model, serializers, tests
    ├── exchanges/        # ExchangeConnection model, serializers, tests
    ├── wallets/          # Wallet model
    ├── analytics/        # Analytics model
    └── notifications/    # Notification model
```

## Models (`models.py`)

| Model | Key Fields | Notes |
|---|---|---|
| `Asset` | `symbol`, `name`, `asset_type`, `metadata` | `asset_type` values: `crypto`, `forex`, `commodity`, `stock` |
| `PricePoint` | `asset`, `timestamp`, `open/high/low/close`, `volume`, `indicators` | Unique on `(asset, timestamp)` |
| `Portfolio` | `user`, `name` | One portfolio per authenticated Django `User` |
| `Holding` | `portfolio`, `asset`, `quantity`, `cost_basis`, `metadata` | Exchange stored in `metadata["exchange"]` |
| `Transaction` | `portfolio`, `asset`, `transaction_type`, `quantity`, `price`, `total` | Types: `buy`, `sell`, `transfer` |

Same asset symbol can exist on multiple exchanges — exchange lives on `Holding.metadata`, not `Asset`.

## API Endpoints (`portfolio/urls.py`)

All routes are mounted under `/api/` by the project `urls.py`.

### Auth

| Method | Path | View | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | `auth_register` | Create account, returns token + user |
| POST | `/api/auth/login/` | `auth_login` | Authenticate, returns token + user |
| POST | `/api/auth/logout/` | `auth_logout` | Invalidate token |
| GET | `/api/auth/me/` | `auth_me` | Current user info |
| DELETE | `/api/auth/delete/` | `auth_delete` | Delete account after password confirmation |

### Admin

| Method | Path | View | Description |
|---|---|---|---|
| GET | `/api/admin/users/` | `admin_users` | List all registered users (staff only) |
| GET/PATCH | `/api/admin/users/<user_id>/` | `admin_user_detail` | Get or update a user's active/staff status |

### Portfolio

| Method | Path | View | Description |
|---|---|---|---|
| GET | `/api/portfolio/overview/` | `portfolio_overview` | Holdings, summary, top performers, P/L by class |
| GET | `/api/portfolio/analytics/?period=` | `portfolio_analytics` | Performance charts, asset breakdown |
| GET | `/api/portfolio/insights/` | `portfolio_insights` | Signals, risk score, allocation profiles |
| GET | `/api/portfolio/transactions/` | `portfolio_transactions` | Full transaction history |
| DELETE | `/api/portfolio/transactions/<transaction_id>/` | `portfolio_transaction_detail` | Revert (undo) a buy or sell transaction |
| POST | `/api/portfolio/assets/` | `portfolio_assets` | Add holding, record sell, or record transfer |
| DELETE | `/api/portfolio/assets/<holding_id>/` | `portfolio_asset_detail` | Delete holding and its transactions |
| POST | `/api/portfolio/transfer/` | `portfolio_transfer` | Move quantity between exchanges |
| GET | `/api/portfolio/live-price/` | `live_price` | Current price via yfinance (60s cache) |

### Settings & Security

| Method | Path | View | Description |
|---|---|---|---|
| GET/PUT | `/api/settings/` | `user_settings` | Read or update account settings (theme, currency, notifications) |
| POST | `/api/security/password/` | `security_change_password` | Change password |
| POST | `/api/security/two-factor/` | `security_two_factor` | Enable/disable 2FA |

### Exchange Connections

| Method | Path | View | Description |
|---|---|---|---|
| GET | `/api/connections/` | `exchange_connections` | List active connections |
| DELETE | `/api/connections/<connection_id>/` | `exchange_connection_detail` | Remove connection (holdings kept) |
| POST | `/api/exchange/connect/` | `exchange_connections` | Connect exchange via API key + secret |
| GET | `/api/exchange/connections/` | `exchange_connections` | Alias for `/api/connections/` |
| DELETE | `/api/exchange/connections/<id>/` | `exchange_connection_detail` | Alias for `/api/connections/<id>/` |
| POST | `/api/exchange/connections/<id>/sync/` | `exchange_connection_sync` | Manually trigger balance sync |

### Signal

| Method | Path | View | Description |
|---|---|---|---|
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

### `exchange_connectors.py`
Validates exchange API keys and syncs live balances from supported exchanges (Binance, OKX, MEXC, Kraken) into `Holding` records.

### `encryption.py`
Encrypts and decrypts exchange API secrets using Fernet symmetric encryption. The key is read from `EXCHANGE_ENCRYPTION_KEY`.

### `auth_api.py`
Auth view helpers (register, login, me, settings, security) that are imported and called from `api.py`.

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
| `DJANGO_DEBUG` | `false` | Debug mode |
| `DJANGO_SECRET_KEY` | _(insecure default)_ | Django secret key — must be set in production |
| `DJANGO_ALLOWED_HOSTS` | `127.0.0.1,localhost` | Comma-separated allowed hosts |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated CORS origins |
| `EXCHANGE_ENCRYPTION_KEY` | _(required)_ | Fernet key for encrypting stored exchange API secrets |

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

Authentication uses DRF `TokenAuthentication`. On login or register the backend returns a token; the Next.js proxy stores it in an HttpOnly cookie and forwards it as `Authorization: Token <token>` on every subsequent backend request. `OptionalTokenAuthentication` is used on endpoints that allow unauthenticated access. Each user owns exactly one `Portfolio`.
