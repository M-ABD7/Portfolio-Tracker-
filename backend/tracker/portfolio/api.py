import base64
import hashlib
import hmac
import logging
import os
import secrets
import struct
import threading
import time

logger = logging.getLogger(__name__)
from collections import defaultdict

import pandas as pd
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Prefetch
from django.forms.models import model_to_dict
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


class OptionalTokenAuthentication(TokenAuthentication):
    """Return anonymous for invalid/unknown tokens instead of raising 401."""
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None

from .csv_import import CsvFormatError, compute_fifo, parse_binance_csv
from .data_fetcher import clean_ohlc, download_market_data
from .models import Asset, ExchangeConnection, Holding, Portfolio, PricePoint, Transaction, UserProfile
from .optimizer import optimize_from_prices


DATA_FOLDER = os.path.join(os.path.dirname(__file__), "market_data")
DEFAULT_USERNAME = "local_user"
DEFAULT_PORTFOLIO_NAME = "Main Portfolio"
MARKET_REFRESH_INTERVAL_SECONDS = 300
SIGNAL_COLORS = {"BUY": "#22c55e", "HOLD": "#f59e0b", "SELL": "#ef4444"}
ASSET_CLASS_COLORS = {
    "crypto": "#00d9ff",
    "forex": "#a855f7",
    "commodities": "#f59e0b",
}
SUPPORTED_CONNECTIONS = [
    {"id": "binance", "name": "Binance", "requiresPassphrase": False},
    {"id": "okx", "name": "OKX", "requiresPassphrase": True},
    {"id": "bybit", "name": "Bybit", "requiresPassphrase": False},
    {"id": "kucoin", "name": "KuCoin", "requiresPassphrase": True},
    {"id": "mexc", "name": "MEXC", "requiresPassphrase": False},
]


def load_latest_signal(symbol):
    filename = f"{symbol}_1h.csv"
    path = os.path.join(DATA_FOLDER, filename)

    if not os.path.exists(path):
        return None

    df = pd.read_csv(path)
    if "Signal" not in df.columns:
        return None

    latest = df.iloc[-1]
    return {
        "symbol": symbol,
        "price": float(latest["close"]),
        "signal": latest["Signal"],
    }


def normalize_asset_class(asset_type: str) -> str:
    if asset_type == "commodity":
        return "commodities"
    return asset_type


def denormalize_asset_class(asset_class: str) -> str:
    if asset_class == "commodities":
        return "commodity"
    return asset_class


def market_symbol_for_asset(asset: Asset) -> str:
    metadata_symbol = asset.metadata.get("market_symbol")
    # Only trust metadata_symbol if it looks like a qualified yfinance ticker
    # (contains '-' or '='). Raw exchange symbols like 'BTC' would resolve to
    # the wrong ticker on yfinance (e.g. Bit Digital Inc. instead of Bitcoin).
    if metadata_symbol and ("-" in str(metadata_symbol) or "=" in str(metadata_symbol)):
        return str(metadata_symbol)

    symbol = asset.symbol.strip().upper()
    asset_type = asset.asset_type

    crypto_aliases = {
        "BTC": "BTC-USD",
        "ETH": "ETH-USD",
        "SOL": "SOL-USD",
        "BNB": "BNB-USD",
        "ADA": "ADA-USD",
        "XRP": "XRP-USD",
        "DOGE": "DOGE-USD",
        "DOT": "DOT-USD",
        "LINK": "LINK-USD",
    }
    commodity_aliases = {
        "XAU": "GC=F",
        "GOLD": "GC=F",
        "XAG": "SI=F",
        "SILVER": "SI=F",
        "WTI": "CL=F",
    }

    if asset_type == "crypto":
        return crypto_aliases.get(symbol, symbol if "-" in symbol else f"{symbol}-USD")
    if asset_type == "forex":
        return symbol if "=" in symbol else f"{symbol}=X"
    if asset_type == "commodity":
        return commodity_aliases.get(symbol, symbol)
    return symbol


def get_portfolio(username: str, portfolio_name: str) -> Portfolio:
    user, _ = User.objects.get_or_create(username=username)
    portfolio, _ = Portfolio.objects.get_or_create(user=user, name=portfolio_name)
    return portfolio


def get_or_create_portfolio(user: User) -> Portfolio:
    portfolio, _ = Portfolio.objects.get_or_create(user=user, name=DEFAULT_PORTFOLIO_NAME)
    return portfolio


def find_portfolio(username: str, portfolio_name: str) -> Portfolio | None:
    return (
        Portfolio.objects.select_related("user")
        .filter(user__username=username, name=portfolio_name)
        .first()
    )


def empty_portfolio_reference(
    username: str = DEFAULT_USERNAME,
    portfolio_name: str = DEFAULT_PORTFOLIO_NAME,
) -> dict:
    return {
        "username": username,
        "name": portfolio_name,
    }


def empty_pl_by_asset_class() -> list[dict]:
    return [
        {
            "assetClass": asset_class,
            "profitLoss": 0,
            "color": ASSET_CLASS_COLORS[asset_class],
        }
        for asset_class in ("crypto", "forex", "commodities")
    ]


def build_empty_overview_payload(
    username: str = DEFAULT_USERNAME,
    portfolio_name: str = DEFAULT_PORTFOLIO_NAME,
) -> dict:
    return {
        "portfolio": empty_portfolio_reference(username, portfolio_name),
        "summary": {
            "totalValue": 0,
            "totalProfitLoss": 0,
            "dailyChange": 0,
            "dailyChangePercentage": 0,
        },
        "assets": [],
        "exchangeData": [],
        "topPerformers": [],
        "plByAssetClass": empty_pl_by_asset_class(),
    }


def build_empty_insights_payload() -> dict:
    return {
        "portfolioSummary": {
            "cryptoPercentage": 0,
            "largestPositionPercentage": 0,
        },
        "riskScore": 0,
        "recommendations": [],
        "diversificationTips": [],
        "allocation": {
            "profiles": [],
            "message": "Connect a wallet or add at least two assets manually to unlock allocation suggestions.",
        },
    }


def build_empty_analytics_payload() -> dict:
    return {
        "assetPerformance": [],
        "plByAssetClass": empty_pl_by_asset_class(),
        "assets": [],
    }


def build_empty_transactions_payload() -> dict:
    return {"transactions": []}


def get_or_create_profile(user: User) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "display_name": user.first_name or user.username,
        },
    )
    if not profile.display_name:
        profile.display_name = user.first_name or user.username
        profile.save(update_fields=["display_name"])
    return profile


def resolve_request_user(request) -> User | None:
    # DRF populates request.user when JWT Bearer auth succeeds
    if hasattr(request, "user") and request.user.is_authenticated:
        return request.user
    # Legacy DRF Token auth fallback
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Token "):
        return None
    key = auth[6:].strip()
    if not key:
        return None
    try:
        return Token.objects.select_related("user").get(key=key).user
    except Token.DoesNotExist:
        return None


def get_auth_token(user: User) -> str:
    token, _ = Token.objects.get_or_create(user=user)
    return token.key


def serialize_auth_user(user: User, profile: UserProfile) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "dateJoined": user.date_joined.isoformat(),
        "displayName": profile.display_name or user.first_name or user.username,
        "isStaff": user.is_staff,
        "isActive": user.is_active,
        "theme": profile.theme,
        "currency": profile.preferred_currency,
        "notifications": profile.notifications,
        "twoFactorEnabled": profile.two_factor_enabled,
    }


def get_requested_username(request) -> str:
    authenticated = resolve_request_user(request)
    if authenticated is not None:
        return authenticated.username
    if request.method == "GET":
        value = request.query_params.get("username", DEFAULT_USERNAME)
    else:
        value = request.data.get("username", DEFAULT_USERNAME)
    return str(value or DEFAULT_USERNAME).strip() or DEFAULT_USERNAME


def get_or_create_app_user(username: str) -> User:
    user, _ = User.objects.get_or_create(username=username, defaults={"first_name": username})
    get_or_create_profile(user)
    return user


def serialize_profile(user: User, profile: UserProfile) -> dict:
    return {
        "username": user.username,
        "displayName": profile.display_name or user.first_name or user.username,
        "email": user.email,
        "currency": profile.preferred_currency,
        "theme": profile.theme,
        "notifications": profile.notifications,
        "twoFactorEnabled": profile.two_factor_enabled,
    }


def mask_secret(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return f"{value[:4]}{'*' * (len(value) - 8)}{value[-4:]}"


def serialize_connection(connection: ExchangeConnection) -> dict:
    masked = mask_secret(connection.api_key)
    return {
        "id": str(connection.id),
        "exchange": connection.exchange_id,          # frontend expects this
        "exchangeId": connection.exchange_id,
        "exchangeName": connection.exchange_name,
        "label": connection.label or connection.exchange_name,
        "maskedKey": masked,                          # frontend expects this
        "apiKeyMasked": masked,
        "requiresPassphrase": bool(connection.api_passphrase),
        "isActive": connection.is_active,
        "lastSyncedAt": connection.last_synced_at.isoformat() if connection.last_synced_at else None,
        "lastSyncStatus": connection.last_sync_status,
        "lastSyncMessage": connection.last_sync_message,
        "permissionsWarning": None,
    }


def supported_connection_catalog() -> list[dict]:
    return SUPPORTED_CONNECTIONS


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def totp_code(secret: str, for_time: int | None = None, interval: int = 30) -> str:
    normalized_secret = secret.upper()
    padding = "=" * ((8 - len(normalized_secret) % 8) % 8)
    key = base64.b32decode(normalized_secret + padding)
    counter = int((for_time or int(time.time())) / interval)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def verify_totp(secret: str, code: str, *, window: int = 1) -> bool:
    normalized = str(code or "").strip()
    if not normalized.isdigit() or len(normalized) != 6:
        return False

    now = int(time.time())
    for offset in range(-window, window + 1):
        if totp_code(secret, for_time=now + offset * 30) == normalized:
            return True
    return False


def totp_setup_uri(user: User, secret: str) -> str:
    return f"otpauth://totp/PortfolioTracker:{user.username}?secret={secret}&issuer=PortfolioTracker"


def is_market_price_point(point: PricePoint) -> bool:
    source = (point.indicators or {}).get("source")
    if source == "market":
        return True
    if source == "manual":
        return False
    return (
        point.timestamp.hour == 0
        and point.timestamp.minute == 0
        and point.timestamp.second == 0
        and point.timestamp.microsecond == 0
    )


def ordered_price_points_for_asset(asset: Asset, *, market_only: bool = False) -> list[PricePoint]:
    points = list(PricePoint.objects.filter(asset=asset).order_by("timestamp"))
    if not market_only:
        return points

    market_points = [point for point in points if is_market_price_point(point)]
    return market_points or points


def latest_price_for_asset(asset: Asset, fallback_price: float = 0.0) -> float:
    points = ordered_price_points_for_asset(asset, market_only=True)
    latest_point = points[-1] if points else None
    if latest_point is not None and latest_point.close is not None:
        return float(latest_point.close)
    return float(fallback_price)


_market_data_lock = threading.Lock()
_last_refresh_time: dict[int, float] = {}  # asset.id -> time.time()


def should_refresh_market_data(asset: Asset) -> bool:
    last = _last_refresh_time.get(asset.id)
    if last is None:
        # First request — check if we have any data at all.
        points = ordered_price_points_for_asset(asset, market_only=True)
        if not points:
            return True
        # We have data; treat it as already fetched recently so we don't
        # block the very first page load with a download.
        _last_refresh_time[asset.id] = time.time()
        return False
    return (time.time() - last) >= MARKET_REFRESH_INTERVAL_SECONDS


def refresh_holdings_market_data(holdings: list[Holding], *, period: str = "6mo") -> None:
    assets_to_refresh = [h.asset for h in holdings if should_refresh_market_data(h.asset)]
    if not assets_to_refresh:
        return

    acquired = _market_data_lock.acquire(blocking=False)
    if not acquired:
        return
    try:
        for asset in assets_to_refresh:
            ensure_asset_history(asset, period=period)
            _last_refresh_time[asset.id] = time.time()
    finally:
        _market_data_lock.release()


def ensure_asset_history(asset: Asset, *, period: str = "3mo", interval: str = "1d") -> None:
    market_symbol = market_symbol_for_asset(asset)

    try:
        df = download_market_data(market_symbol, period=period, interval=interval)
    except Exception as exc:
        logger.warning("ensure_asset_history: fetch failed for %s — %s", market_symbol, exc)
        return

    if df.empty:
        return

    df = df.reset_index()
    df = clean_ohlc(df)
    required_columns = {"Date", "open", "high", "low", "close"}
    if not required_columns.issubset(df.columns):
        return

    points_to_upsert = []
    for _, row in df.iterrows():
        timestamp = pd.to_datetime(row["Date"]).to_pydatetime()
        if timestamp.tzinfo is not None:
            timestamp = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
        timestamp = timezone.make_aware(timestamp, timezone.get_current_timezone())

        try:
            open_price = float(row["open"])
            high_price = float(row["high"])
            low_price = float(row["low"])
            close_price = float(row["close"])
        except (TypeError, ValueError):
            continue

        if pd.isna(open_price) or pd.isna(high_price) or pd.isna(low_price) or pd.isna(close_price):
            continue

        points_to_upsert.append(
            PricePoint(
                asset=asset,
                timestamp=timestamp,
                open=open_price,
                high=high_price,
                low=low_price,
                close=close_price,
                volume=0,
                indicators={"source": "market"},
            )
        )

    if points_to_upsert:
        PricePoint.objects.bulk_create(
            points_to_upsert,
            update_conflicts=True,
            unique_fields=["asset", "timestamp"],
            update_fields=["open", "high", "low", "close", "volume", "indicators"],
        )


def serialize_holding(holding: Holding) -> dict:
    current_price = latest_price_for_asset(holding.asset, fallback_price=holding.cost_basis or 0)
    quantity = float(holding.quantity)
    avg_buy_price = float(holding.cost_basis or 0)
    value = quantity * current_price
    profit_loss = (current_price - avg_buy_price) * quantity
    profit_loss_percentage = (
        ((current_price - avg_buy_price) / avg_buy_price) * 100 if avg_buy_price else 0
    )

    return {
        "id": str(holding.id),
        "name": holding.asset.name,
        "symbol": holding.asset.symbol,
        "quantity": quantity,
        "avgBuyPrice": avg_buy_price,
        "currentPrice": current_price,
        "value": value,
        "pl": profit_loss,
        "plPercentage": profit_loss_percentage,
        "assetClass": normalize_asset_class(holding.asset.asset_type),
        "exchange": holding.metadata.get("exchange") or holding.asset.metadata.get("exchange", "Manual"),
        "isSynced": holding.metadata.get("source") == "sync",
    }


def grouped_exchange_data(assets: list[dict]) -> list[dict]:
    grouped_exchanges: dict[str, list[dict]] = defaultdict(list)
    for asset in assets:
        grouped_exchanges[asset["exchange"]].append(asset)

    return [
        {
            "id": exchange_name.lower().replace(" ", "-"),
            "name": exchange_name,
            "assets": exchange_assets,
            "totalValue": sum(item["value"] for item in exchange_assets),
        }
        for exchange_name, exchange_assets in sorted(grouped_exchanges.items())
    ]


def realized_pnl_for_portfolio(portfolio: Portfolio) -> float:
    total = 0.0
    for tx in Transaction.objects.filter(portfolio=portfolio, transaction_type="sell"):
        total += tx.metadata.get("realized_pnl", 0) or 0
    return total


def build_overview_payload(portfolio: Portfolio, *, refresh_history: bool = True) -> dict:
    holdings = list(
        Holding.objects.select_related("asset")
        .prefetch_related("asset__price_points")
        .filter(portfolio=portfolio)
        .order_by("asset__symbol")
    )

    if refresh_history:
        refresh_holdings_market_data(holdings, period="1mo")

    assets = [serialize_holding(holding) for holding in holdings]
    total_value = sum(asset["value"] for asset in assets)
    total_profit_loss = sum(asset["pl"] for asset in assets)

    pl_by_asset_class = []
    for asset_class in ("crypto", "forex", "commodities"):
        pl_by_asset_class.append(
            {
                "assetClass": asset_class,
                "profitLoss": sum(
                    asset["pl"] for asset in assets if asset["assetClass"] == asset_class
                ),
                "color": ASSET_CLASS_COLORS[asset_class],
            }
        )

    # Merge holdings that share a symbol (same asset on multiple exchanges)
    symbol_map: dict[str, dict] = {}
    for asset in assets:
        sym = asset["symbol"]
        if sym not in symbol_map:
            symbol_map[sym] = asset.copy()
        else:
            existing = symbol_map[sym]
            merged_qty  = existing["quantity"] + asset["quantity"]
            merged_cost = existing["avgBuyPrice"] * existing["quantity"] + asset["avgBuyPrice"] * asset["quantity"]
            merged_value = existing["value"] + asset["value"]
            merged_pl   = existing["pl"] + asset["pl"]
            avg_buy = merged_cost / merged_qty if merged_qty else 0
            pl_pct  = (merged_pl / merged_cost * 100) if merged_cost else 0
            symbol_map[sym] = {
                **existing,
                "quantity":     merged_qty,
                "value":        merged_value,
                "pl":           merged_pl,
                "plPercentage": pl_pct,
                "avgBuyPrice":  avg_buy,
            }

    top_performers = [
        {
            "name":             asset["name"],
            "symbol":           asset["symbol"],
            "changePercentage": asset["plPercentage"],
        }
        for asset in sorted(symbol_map.values(), key=lambda a: a["plPercentage"], reverse=True)[:5]
    ]

    return {
        "portfolio": {
            "username": portfolio.user.username,
            "name": portfolio.name,
        },
        "summary": {
            "totalValue": total_value,
            "totalProfitLoss": total_profit_loss,
            "realizedPnl": realized_pnl_for_portfolio(portfolio),
            "dailyChange": 0,
            "dailyChangePercentage": 0,
        },
        "assets": assets,
        "exchangeData": grouped_exchange_data(assets),
        "topPerformers": top_performers,
        "plByAssetClass": pl_by_asset_class,
    }


def compute_signal_from_series(close_series: pd.Series) -> tuple[str, str]:
    if len(close_series) < 26:
        return "HOLD", "Not enough price history yet to generate a stronger signal."

    frame = pd.DataFrame({"close": close_series.astype(float)})
    frame["SMA_20"] = frame["close"].rolling(window=20).mean()
    frame["EMA_50"] = frame["close"].ewm(span=50, adjust=False).mean()

    delta = frame["close"].diff()
    gains = delta.clip(lower=0).rolling(window=14).mean()
    losses = (-delta.clip(upper=0)).rolling(window=14).mean()
    rs = gains / losses.replace(0, pd.NA)
    frame["RSI_14"] = 100 - (100 / (1 + rs))
    frame.loc[(losses == 0) & (gains > 0), "RSI_14"] = 100
    frame.loc[(gains == 0) & (losses > 0), "RSI_14"] = 0
    frame.loc[(gains == 0) & (losses == 0), "RSI_14"] = 50

    frame["MACD"] = frame["close"].ewm(span=12, adjust=False).mean() - frame["close"].ewm(
        span=26, adjust=False
    ).mean()
    frame["MACD_signal"] = frame["MACD"].ewm(span=9, adjust=False).mean()

    latest = frame.iloc[-1]
    if pd.isna(latest["SMA_20"]) or pd.isna(latest["RSI_14"]) or pd.isna(latest["MACD_signal"]):
        return "HOLD", "Price indicators are still warming up."

    bullish_reasons = []
    bearish_reasons = []

    if latest["close"] >= latest["SMA_20"]:
        bullish_reasons.append("price is above the 20-day average")
    else:
        bearish_reasons.append("price is below the 20-day average")

    if latest["MACD"] >= latest["MACD_signal"]:
        bullish_reasons.append("MACD is above its signal line")
    else:
        bearish_reasons.append("MACD is below its signal line")

    if latest["SMA_20"] >= latest["EMA_50"]:
        bullish_reasons.append("the short-term trend is above the 50-day EMA")
    else:
        bearish_reasons.append("the short-term trend is still below the 50-day EMA")

    if latest["RSI_14"] >= 55:
        bullish_reasons.append("RSI is showing healthy momentum")
    elif latest["RSI_14"] <= 45:
        bearish_reasons.append("RSI is on the weaker side")

    if latest["close"] >= latest["SMA_20"] and latest["MACD"] >= latest["MACD_signal"] and latest["RSI_14"] >= 45:
        return "BUY", f"Bullish setup: {', '.join(bullish_reasons[:3])}."

    if latest["close"] < latest["SMA_20"] and latest["MACD"] < latest["MACD_signal"] and latest["RSI_14"] <= 55:
        return "SELL", f"Bearish setup: {', '.join(bearish_reasons[:3])}."

    if len(bullish_reasons) > len(bearish_reasons):
        return "BUY", f"Momentum is improving, but the setup is mixed: {', '.join(bullish_reasons[:2])}."

    if len(bearish_reasons) > len(bullish_reasons):
        return "SELL", f"Momentum is weakening: {', '.join(bearish_reasons[:2])}."

    return "HOLD", "The trend is mixed right now, so holding and waiting for clearer confirmation makes sense."


def build_asset_performance(holdings: list[Holding], period: str) -> list[dict]:
    period_limits = {"7d": 7, "1m": 30, "3m": 90}
    history_length = period_limits.get(period, 30)
    color_palette = [
        "#00d9ff", "#a855f7", "#f59e0b", "#22c55e", "#ef4444",
        "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
        "#14b8a6", "#e11d48", "#8b5cf6", "#0ea5e9", "#d97706",
    ]
    performance = []

    for index, holding in enumerate(holdings):
        points = ordered_price_points_for_asset(holding.asset, market_only=True)[-history_length:]
        if not points:
            continue

        performance.append(
            {
                "name": holding.asset.name,
                "symbol": holding.asset.symbol,
                "color": color_palette[index % len(color_palette)],
                "data": [
                    {
                        "day": point.timestamp.strftime("%b %d"),
                        "value": float(point.close) * float(holding.quantity),
                    }
                    for point in points
                ],
            }
        )

    return performance


def build_transactions_payload(portfolio: Portfolio) -> dict:
    transactions = Transaction.objects.select_related("asset").filter(portfolio=portfolio)
    items = []
    for item in transactions:
        items.append(
            {
                "id": str(item.id),
                "date": item.created_at.isoformat(),
                "type": item.transaction_type,
                "asset": item.asset.name,
                "symbol": item.asset.symbol,
                "quantity": float(item.quantity),
                "price": float(item.price),
                "total": float(item.total),
                "exchange": item.metadata.get("exchange", item.asset.metadata.get("exchange", "Manual")),
            }
        )
    return {"transactions": items}


def build_allocation_payload(holdings: list[Holding]) -> dict:
    if len(holdings) < 2:
        return {
            "profiles": [],
            "message": "Add at least two assets with market data to calculate weight allocations.",
        }

    try:
        # Build price DataFrame from already-stored PricePoints (no network call).
        series_map: dict[str, pd.Series] = {}
        for holding in holdings:
            points = ordered_price_points_for_asset(holding.asset, market_only=True)
            if not points:
                continue
            dates = [p.timestamp for p in points]
            closes = [p.close for p in points]
            series_map[holding.asset.symbol] = pd.Series(closes, index=pd.DatetimeIndex(dates))

        if len(series_map) < 2:
            raise ValueError("Need at least two assets with market history to calculate allocations.")

        prices = pd.DataFrame(series_map).dropna(axis=0, how="any")
        if prices.shape[0] < 5:
            raise ValueError("Not enough overlapping price history for allocation analysis.")

        risk_table = optimize_from_prices(prices)
    except Exception as exc:
        return {"profiles": [], "message": str(exc)}

    import math

    def safe_float(v: float) -> float:
        f = float(v)
        if math.isinf(f) or math.isnan(f):
            return 0.0
        return f

    profiles = []
    for _, row in risk_table.iterrows():
        weights = []
        for column, value in row.items():
            if column.endswith(" Weight"):
                weights.append(
                    {
                        "asset": column.replace(" Weight", ""),
                        "weight": safe_float(value),
                    }
                )
        profiles.append(
            {
                "profile": row["Profile"],
                "weights": weights,
                "return": safe_float(row["Return"]),
                "variance": safe_float(row["Variance"]),
                "stdDev": safe_float(row["Std Dev"]),
                "sharpe": safe_float(row["Sharpe"]),
            }
        )

    return {"profiles": profiles, "message": ""}


def build_insights_payload(portfolio: Portfolio) -> dict:
    holdings = list(
        Holding.objects.select_related("asset")
        .prefetch_related("asset__price_points")
        .filter(portfolio=portfolio)
        .order_by("asset__symbol")
    )
    if not holdings:
        return build_empty_insights_payload()

    refresh_holdings_market_data(holdings, period="6mo")
    overview = build_overview_payload(portfolio, refresh_history=False)
    total_value = overview["summary"]["totalValue"]

    recommendations = []
    seen_symbols: set[str] = set()
    for holding in holdings:
        sym = holding.asset.symbol
        if sym in seen_symbols:
            continue
        seen_symbols.add(sym)
        close_series = pd.Series([point.close for point in ordered_price_points_for_asset(holding.asset, market_only=True)])
        signal, reason = compute_signal_from_series(close_series)
        recommendations.append(
            {
                "type":   signal.lower(),
                "asset":  holding.asset.name,
                "symbol": sym,
                "reason": reason,
                "color":  SIGNAL_COLORS[signal],
            }
        )

    asset_class_weights = defaultdict(float)
    largest_position_pct = 0.0
    for asset in overview["assets"]:
        weight_pct = (asset["value"] / total_value * 100) if total_value else 0
        asset_class_weights[asset["assetClass"]] += weight_pct
        largest_position_pct = max(largest_position_pct, weight_pct)

    crypto_percentage = asset_class_weights["crypto"]
    concentration_penalty = min(largest_position_pct, 100)
    diversification_bonus = min(len(overview["assets"]) * 5, 25)
    risk_score = max(0, min(100, round(concentration_penalty + crypto_percentage * 0.4 - diversification_bonus)))

    diversification_tips = []
    if largest_position_pct > 45:
        diversification_tips.append(
            {
                "type": "warning",
                "message": "One holding dominates the portfolio. Spreading capital can reduce single-asset risk.",
            }
        )
    else:
        diversification_tips.append(
            {
                "type": "success",
                "message": "Your position sizing is reasonably spread out across holdings.",
            }
        )

    if crypto_percentage > 70:
        diversification_tips.append(
            {
                "type": "warning",
                "message": "Crypto exposure is high. Adding forex or commodities could smooth volatility.",
            }
        )
    else:
        diversification_tips.append(
            {
                "type": "success",
                "message": "Asset-class exposure is fairly balanced for a multi-asset portfolio.",
            }
        )

    return {
        "portfolioSummary": {
            "cryptoPercentage": round(crypto_percentage, 2),
            "largestPositionPercentage": round(largest_position_pct, 2),
        },
        "riskScore": risk_score,
        "recommendations": recommendations,
        "diversificationTips": diversification_tips,
        "allocation": build_allocation_payload(holdings),
    }


def build_analytics_payload(portfolio: Portfolio, period: str) -> dict:
    holdings = list(
        Holding.objects.select_related("asset")
        .prefetch_related("asset__price_points")
        .filter(portfolio=portfolio)
        .order_by("asset__symbol")
    )
    if not holdings:
        return build_empty_analytics_payload()

    refresh_holdings_market_data(holdings, period="6mo")
    overview = build_overview_payload(portfolio, refresh_history=False)
    return {
        "assetPerformance": build_asset_performance(holdings, period),
        "plByAssetClass": overview["plByAssetClass"],
        "assets": overview["assets"],
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_register(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    email = str(request.data.get("email", "")).strip()
    first_name = str(request.data.get("first_name", "")).strip()
    last_name = str(request.data.get("last_name", "")).strip()
    display_name = (
        str(request.data.get("displayName", "")).strip()
        or f"{first_name} {last_name}".strip()
        or username
    )

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({"error": "That username is already taken."}, status=400)

    user = User.objects.create_user(
        username=username, password=password, email=email,
        first_name=first_name, last_name=last_name,
    )
    profile = get_or_create_profile(user)
    profile.display_name = display_name
    profile.save(update_fields=["display_name"])
    Portfolio.objects.get_or_create(user=user, name=DEFAULT_PORTFOLIO_NAME)
    token = get_auth_token(user)
    return Response(
        {
            "message": "Account created.",
            "token": token,
            "user": serialize_auth_user(user, profile),
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_login(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    otp = str(request.data.get("otp", "")).strip()
    user = authenticate(username=username, password=password)

    # Auto-provision the demo account on first login attempt
    if user is None and username == "demo":
        demo_user, created = User.objects.get_or_create(username="demo")
        if created or not demo_user.has_usable_password():
            demo_user.set_password("demo1234")
            demo_user.save(update_fields=["password"])
            get_or_create_profile(demo_user)
            Portfolio.objects.get_or_create(user=demo_user, name=DEFAULT_PORTFOLIO_NAME)
        user = authenticate(username="demo", password="demo1234")

    if user is None:
        return Response({"error": "Invalid username or password."}, status=400)
    if not user.is_active:
        return Response({"error": "This account has been deactivated."}, status=403)

    profile = get_or_create_profile(user)
    if profile.two_factor_enabled and not verify_totp(profile.two_factor_secret, otp):
        return Response(
            {
                "error": "A valid 2FA code is required for this account.",
                "requiresTwoFactor": True,
            },
            status=400,
        )

    Portfolio.objects.get_or_create(user=user, name=DEFAULT_PORTFOLIO_NAME)
    token = get_auth_token(user)
    return Response(
        {
            "message": "Login successful.",
            "token": token,
            "user": serialize_auth_user(user, profile),
        }
    )


@api_view(["GET"])
def auth_me(request):
    user = resolve_request_user(request)
    if user is None:
        return Response({"authenticated": False, "user": None})

    profile = get_or_create_profile(user)
    return Response({"authenticated": True, "user": serialize_auth_user(user, profile)})


@api_view(["POST"])
def auth_logout(request):
    user = resolve_request_user(request)
    if user is not None:
        Token.objects.filter(user=user).delete()
    return Response({"message": "Logged out."})


@api_view(["DELETE"])
def auth_delete(request):
    user = resolve_request_user(request)
    if user is None:
        return Response({"error": "Not authenticated."}, status=401)

    password = str(request.data.get("password", ""))
    if not user.check_password(password):
        return Response({"error": "Incorrect password."}, status=400)

    Token.objects.filter(user=user).delete()
    user.delete()
    return Response({"message": "Account deleted."})


@api_view(["GET"])
def admin_users(request):
    user = resolve_request_user(request)
    if user is None:
        return Response({"error": "Not authenticated."}, status=401)
    if not user.is_staff:
        return Response({"error": "Admin access required."}, status=403)

    users = User.objects.order_by("-date_joined")
    payload = []
    for entry in users:
        profile = get_or_create_profile(entry)
        payload.append(serialize_auth_user(entry, profile))
    return Response({"users": payload})


@api_view(["PATCH", "DELETE"])
def admin_user_detail(request, user_id: int):
    actor = resolve_request_user(request)
    if actor is None:
        return Response({"error": "Not authenticated."}, status=401)
    if not actor.is_staff:
        return Response({"error": "Admin access required."}, status=403)

    target = User.objects.filter(id=user_id).first()
    if target is None:
        return Response({"error": "User not found."}, status=404)

    if request.method == "DELETE":
        if target.id == actor.id:
            return Response({"error": "You cannot delete your own account."}, status=400)
        target.delete()
        return Response({"message": "User deleted."})

    if target.id == actor.id and request.data.get("isActive") is False:
        return Response({"error": "You cannot deactivate your own account."}, status=400)

    if "isActive" in request.data:
        target.is_active = bool(request.data.get("isActive"))
    if "isStaff" in request.data and target.id != actor.id:
        target.is_staff = bool(request.data.get("isStaff"))

    target.save(update_fields=["is_active", "is_staff"])
    profile = get_or_create_profile(target)
    return Response({"user": serialize_auth_user(target, profile)})


@api_view(["GET", "PUT"])
def user_settings(request):
    username = get_requested_username(request)
    user = get_or_create_app_user(username)
    profile = get_or_create_profile(user)

    if request.method == "PUT":
        display_name = str(request.data.get("displayName", profile.display_name)).strip() or user.username
        email = str(request.data.get("email", user.email)).strip()
        currency = str(request.data.get("currency", profile.preferred_currency)).strip() or "USD"
        theme = str(request.data.get("theme", profile.theme)).strip() or "dark"
        notifications = request.data.get("notifications", profile.notifications)
        if not isinstance(notifications, dict):
            return Response({"error": "Notifications must be an object."}, status=400)

        user.first_name = display_name
        user.email = email
        user.save(update_fields=["first_name", "email"])

        profile.display_name = display_name
        profile.preferred_currency = currency
        profile.theme = theme
        profile.notifications = notifications
        profile.save(update_fields=["display_name", "preferred_currency", "theme", "notifications"])

    return Response({"settings": serialize_profile(user, profile)})


@api_view(["POST"])
def security_change_password(request):
    username = get_requested_username(request)
    current_password = str(request.data.get("currentPassword", ""))
    new_password = str(request.data.get("newPassword", ""))
    user = User.objects.filter(username=username).first()
    if user is None:
        return Response({"error": "User not found."}, status=404)
    if not user.check_password(current_password):
        return Response({"error": "Current password is incorrect."}, status=400)
    if len(new_password) < 8:
        return Response({"error": "New password must be at least 8 characters long."}, status=400)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"message": "Password updated successfully."})


@api_view(["GET", "POST", "DELETE"])
def security_two_factor(request):
    username = get_requested_username(request)
    user = get_or_create_app_user(username)
    profile = get_or_create_profile(user)

    if request.method == "GET":
        return Response(
            {
                "twoFactorEnabled": profile.two_factor_enabled,
                "hasPendingSetup": bool(profile.two_factor_secret and not profile.two_factor_enabled),
            }
        )

    if request.method == "DELETE":
        profile.two_factor_enabled = False
        profile.two_factor_secret = ""
        profile.save(update_fields=["two_factor_enabled", "two_factor_secret"])
        return Response({"message": "Two-factor authentication disabled."})

    action = str(request.data.get("action", "setup")).strip().lower()
    if action == "setup":
        secret = generate_totp_secret()
        profile.two_factor_enabled = False
        profile.two_factor_secret = secret
        profile.save(update_fields=["two_factor_enabled", "two_factor_secret"])
        return Response(
            {
                "secret": secret,
                "setupUri": totp_setup_uri(user, secret),
                "message": "Add this secret to your authenticator app, then verify with the generated 6-digit code.",
            }
        )

    if action == "verify":
        code = str(request.data.get("code", "")).strip()
        if not profile.two_factor_secret:
            return Response({"error": "Start 2FA setup first."}, status=400)
        if not verify_totp(profile.two_factor_secret, code):
            return Response({"error": "Invalid authentication code."}, status=400)
        profile.two_factor_enabled = True
        profile.save(update_fields=["two_factor_enabled"])
        return Response({"message": "Two-factor authentication enabled.", "twoFactorEnabled": True})

    return Response({"error": "Unsupported action."}, status=400)


@api_view(["GET", "POST"])
def exchange_connections(request):
    username = get_requested_username(request)
    user = get_or_create_app_user(username)

    if request.method == "GET":
        items = [serialize_connection(item) for item in ExchangeConnection.objects.filter(user=user)]
        return Response({"connections": items, "availableExchanges": supported_connection_catalog()})

    exchange_id = str(request.data.get("exchangeId") or request.data.get("exchange", "")).strip().lower()
    exchange_name = str(request.data.get("exchangeName", exchange_id.upper())).strip() or exchange_id.upper()
    api_key = str(request.data.get("apiKey", "")).strip()
    api_secret = str(request.data.get("apiSecret", "")).strip()
    api_passphrase = str(request.data.get("apiPassphrase") or request.data.get("passphrase", "")).strip()
    label = str(request.data.get("label", exchange_name)).strip() or exchange_name

    supported = {item["id"]: item for item in SUPPORTED_CONNECTIONS}
    if exchange_id not in supported:
        return Response({"error": "Unsupported exchange selected."}, status=400)
    if not api_key or not api_secret:
        return Response({"error": "API key and API secret are required."}, status=400)
    if supported[exchange_id]["requiresPassphrase"] and not api_passphrase:
        return Response({"error": f"{exchange_name} also requires an API passphrase."}, status=400)

    connection, created = ExchangeConnection.objects.update_or_create(
        user=user,
        exchange_id=exchange_id,
        api_key=api_key,
        defaults={
            "exchange_name": exchange_name,
            "api_secret": api_secret,
            "api_passphrase": api_passphrase,
            "label": label,
            "is_active": True,
            "last_sync_status": "not_connected",
            "last_sync_message": "Credentials saved. Live balance sync will run after exchange adapters are configured.",
        },
    )
    msg = "Exchange connection saved." if created else "Exchange connection updated."
    return Response({"message": msg, "connection": serialize_connection(connection)}, status=201)


@api_view(["DELETE"])
def exchange_connection_detail(request, connection_id: int):
    username = get_requested_username(request)
    user = get_or_create_app_user(username)
    connection = ExchangeConnection.objects.filter(user=user, id=connection_id).first()
    if connection is None:
        return Response({"error": "Connection not found."}, status=404)
    connection.delete()
    return Response({"message": "Connection removed."})



@api_view(["POST"])
def exchange_connection_sync(request, connection_id: int):
    """Stub for syncing an exchange connection. Real sync requires exchange adapters."""
    username = get_requested_username(request)
    user = get_or_create_app_user(username)
    connection = ExchangeConnection.objects.filter(user=user, id=connection_id).first()
    if connection is None:
        return Response({"error": "Connection not found."}, status=404)
    connection.last_sync_status = "pending"
    connection.last_sync_message = "Live balance sync is not yet implemented for this exchange."
    connection.save(update_fields=["last_sync_status", "last_sync_message"])
    return Response({"synced": 0, "added": 0, "updated": 0, "message": connection.last_sync_message})


@api_view(["GET"])
def get_signal(request, symbol):
    data = load_latest_signal(symbol)
    if data is None:
        return Response({"error": "Symbol not found or indicators missing"}, status=404)
    return Response(data)


@api_view(["GET"])
def portfolio_overview(request):
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    portfolio = find_portfolio(username, portfolio_name)
    if portfolio is None:
        return Response(build_empty_overview_payload(username, portfolio_name))
    return Response(build_overview_payload(portfolio))


@api_view(["GET"])
def portfolio_analytics(request):
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    period = request.query_params.get("period", "1m")
    portfolio = find_portfolio(username, portfolio_name)
    if portfolio is None:
        return Response(build_empty_analytics_payload())
    return Response(build_analytics_payload(portfolio, period))


@api_view(["GET"])
def portfolio_insights(request):
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    portfolio = find_portfolio(username, portfolio_name)
    if portfolio is None:
        return Response(build_empty_insights_payload())
    return Response(build_insights_payload(portfolio))


@api_view(["GET"])
def portfolio_transactions(request):
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    portfolio = find_portfolio(username, portfolio_name)
    if portfolio is None:
        return Response(build_empty_transactions_payload())
    return Response(build_transactions_payload(portfolio))



@api_view(["DELETE"])
def portfolio_transaction_detail(request, transaction_id: int):
    """Revert (undo) a single transaction by ID, adjusting the holding accordingly."""
    username = get_requested_username(request)
    portfolio = find_portfolio(username, DEFAULT_PORTFOLIO_NAME)
    if portfolio is None:
        return Response({"error": "Portfolio not found."}, status=404)

    tx = Transaction.objects.select_related("asset").filter(portfolio=portfolio, id=transaction_id).first()
    if tx is None:
        return Response({"error": "Transaction not found."}, status=404)

    exchange = tx.metadata.get("exchange", "Manual")
    holding = Holding.objects.filter(portfolio=portfolio, asset=tx.asset, metadata__exchange=exchange).first()

    if tx.transaction_type == "buy":
        if holding is not None:
            new_qty = float(holding.quantity) - float(tx.quantity)
            if new_qty <= 1e-10:
                holding.delete()
            else:
                holding.quantity = new_qty
                holding.save(update_fields=["quantity"])

    elif tx.transaction_type == "sell":
        if holding is not None:
            total_existing_cost = float(holding.quantity) * float(holding.cost_basis or 0)
            total_reverted_cost = float(tx.quantity) * float(tx.price)
            new_qty = float(holding.quantity) + float(tx.quantity)
            holding.cost_basis = (total_existing_cost + total_reverted_cost) / new_qty
            holding.quantity = new_qty
            holding.save(update_fields=["quantity", "cost_basis"])
        else:
            Holding.objects.create(
                portfolio=portfolio,
                asset=tx.asset,
                quantity=tx.quantity,
                cost_basis=tx.price,
                metadata={"exchange": exchange},
            )

    # transfer: just remove the log entry; holdings were already settled by portfolio_transfer

    tx.delete()
    return Response({"message": "Transaction reverted."})


@api_view(["DELETE"])
def portfolio_asset_detail(request, holding_id: int):
    """Delete a single holding by its ID."""
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    portfolio = find_portfolio(username, portfolio_name)
    if portfolio is None:
        return Response({"error": "Portfolio not found."}, status=404)
    holding = Holding.objects.filter(portfolio=portfolio, id=holding_id).first()
    if holding is None:
        return Response({"error": "Holding not found."}, status=404)
    symbol = holding.asset.symbol
    holding.delete()
    return Response({"message": f"Holding {symbol} (id={holding_id}) deleted."})


@api_view(["POST"])
def portfolio_transfer(request):
    """Transfer crypto holdings from one exchange to another."""
    username = get_requested_username(request)
    portfolio = find_portfolio(username, DEFAULT_PORTFOLIO_NAME)
    if portfolio is None:
        return Response({"error": "Portfolio not found."}, status=404)

    try:
        from_holding_id = int(request.data.get("fromHoldingId", 0))
        quantity = float(request.data.get("quantity", 0))
    except (TypeError, ValueError):
        return Response({"error": "fromHoldingId and quantity must be numeric."}, status=400)

    to_exchange = str(request.data.get("toExchange", "")).strip()

    if not to_exchange:
        return Response({"error": "Destination exchange is required."}, status=400)
    if quantity <= 0:
        return Response({"error": "Quantity must be greater than zero."}, status=400)

    source = Holding.objects.select_related("asset").filter(
        portfolio=portfolio, id=from_holding_id
    ).first()
    if source is None:
        return Response({"error": "Source holding not found."}, status=404)

    if source.asset.asset_type != "crypto":
        return Response({"error": "Transfer is only supported for crypto assets."}, status=400)

    if quantity > source.quantity:
        return Response(
            {"error": f"Cannot transfer {quantity} — only {source.quantity} held on {source.metadata.get('exchange', '?')}."},
            status=400,
        )

    from_exchange = source.metadata.get("exchange", "Manual")
    if to_exchange.lower() == from_exchange.lower():
        return Response({"error": "Source and destination exchange must be different."}, status=400)

    source_cost_basis = float(source.cost_basis or 0)

    # Reduce or delete source holding
    if abs(quantity - source.quantity) < 1e-9:
        source.delete()
        from_holding_serialized = None
    else:
        source.quantity = round(source.quantity - quantity, 10)
        source.save(update_fields=["quantity"])
        refreshed_source = Holding.objects.select_related("asset").prefetch_related(
            "asset__price_points"
        ).get(pk=source.pk)
        from_holding_serialized = serialize_holding(refreshed_source)

    # Find or create destination holding, preserving weighted-average cost basis
    dest = Holding.objects.filter(
        portfolio=portfolio,
        asset=source.asset,
        metadata__exchange=to_exchange,
    ).first()

    if dest:
        existing_cost = float(dest.quantity) * float(dest.cost_basis or 0)
        transfer_cost = quantity * source_cost_basis
        new_qty = float(dest.quantity) + quantity
        dest.cost_basis = (existing_cost + transfer_cost) / new_qty if new_qty else source_cost_basis
        dest.quantity = new_qty
        dest.save(update_fields=["quantity", "cost_basis"])
    else:
        dest = Holding.objects.create(
            portfolio=portfolio,
            asset=source.asset,
            quantity=quantity,
            cost_basis=source_cost_basis,
            metadata={"exchange": to_exchange},
        )

    Transaction.objects.create(
        portfolio=portfolio,
        asset=source.asset,
        transaction_type="transfer",
        quantity=quantity,
        price=source_cost_basis,
        total=quantity * source_cost_basis,
        metadata={"from_exchange": from_exchange, "to_exchange": to_exchange},
    )

    refreshed_dest = Holding.objects.select_related("asset").prefetch_related(
        "asset__price_points"
    ).get(pk=dest.pk)

    return Response({
        "message": f"Transferred {quantity} {source.asset.symbol} from {from_exchange} to {to_exchange}.",
        "from": from_holding_serialized,
        "to": serialize_holding(refreshed_dest),
    })



@api_view(["POST"])
def portfolio_assets(request):
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    symbol = str(request.data.get("symbol", "")).strip().upper()
    name = str(request.data.get("name", symbol)).strip() or symbol
    asset_class = str(request.data.get("assetClass", "crypto")).strip().lower()
    exchange = str(request.data.get("exchange", "Manual")).strip() or "Manual"
    transaction_type = str(request.data.get("transactionType", "buy")).strip().lower() or "buy"

    try:
        quantity = float(request.data.get("quantity", 0))
        avg_buy_price = float(request.data.get("avgBuyPrice", 0))
        current_price = float(request.data.get("currentPrice", avg_buy_price))
    except (TypeError, ValueError):
        return Response({"error": "Quantity and prices must be numeric."}, status=400)

    if not symbol:
        return Response({"error": "Symbol is required."}, status=400)
    if quantity <= 0:
        return Response({"error": "Quantity must be greater than zero."}, status=400)
    if avg_buy_price < 0 or current_price < 0:
        return Response({"error": "Prices cannot be negative."}, status=400)

    portfolio = get_portfolio(username, portfolio_name)
    asset, _ = Asset.objects.get_or_create(
        symbol=symbol,
        defaults={
            "name": name,
            "asset_type": denormalize_asset_class(asset_class),
            "metadata": {
                "exchange": exchange,
                "market_symbol": request.data.get("marketSymbol") or "",
            },
        },
    )

    asset.name = name
    asset.asset_type = denormalize_asset_class(asset_class)
    asset.metadata = {
        **asset.metadata,
        "market_symbol": request.data.get("marketSymbol") or asset.metadata.get("market_symbol", ""),
    }
    asset.save(update_fields=["name", "asset_type", "metadata"])

    # Key holdings on (portfolio, asset, exchange) so the same symbol on different
    # exchanges produces separate rows. Exchange lives in Holding.metadata, not Asset.
    holding = Holding.objects.filter(
        portfolio=portfolio,
        asset=asset,
        metadata__exchange=exchange,
    ).first()

    cost_basis_before_sell = float(holding.cost_basis or 0) if holding else 0
    tx_meta: dict = {"exchange": exchange}

    if transaction_type == "sell":
        if not holding:
            return Response({"error": "No holding found to sell."}, status=400)
        if quantity > float(holding.quantity):
            return Response(
                {"error": f"Cannot sell {quantity} — only {holding.quantity} held on {exchange}."},
                status=400,
            )
        realized_pnl = (avg_buy_price - cost_basis_before_sell) * quantity
        tx_meta["realized_pnl"] = realized_pnl
        new_quantity = float(holding.quantity) - quantity
        if new_quantity <= 1e-10:
            holding.delete()
            holding = None
        else:
            holding.quantity = new_quantity
            holding.save(update_fields=["quantity"])
    else:
        if holding:
            total_existing_cost = float(holding.quantity) * float(holding.cost_basis or 0)
            total_new_cost = quantity * avg_buy_price
            combined_quantity = float(holding.quantity) + quantity
            holding.cost_basis = (
                (total_existing_cost + total_new_cost) / combined_quantity if combined_quantity else avg_buy_price
            )
            holding.quantity = combined_quantity
            holding.save(update_fields=["quantity", "cost_basis"])
        else:
            holding = Holding.objects.create(
                portfolio=portfolio,
                asset=asset,
                quantity=quantity,
                cost_basis=avg_buy_price,
                metadata={"exchange": exchange},
            )

    price_timestamp = timezone.now().replace(second=0, microsecond=0)
    PricePoint.objects.update_or_create(
        asset=asset,
        timestamp=price_timestamp,
        defaults={
            "open": current_price,
            "high": current_price,
            "low": current_price,
            "close": current_price,
            "volume": 0,
            "indicators": {"source": "manual"},
        },
    )
    ensure_asset_history(asset, period="6mo")

    Transaction.objects.create(
        portfolio=portfolio,
        asset=asset,
        transaction_type=transaction_type if transaction_type in {"buy", "sell", "transfer"} else "buy",
        quantity=quantity,
        price=current_price,
        total=quantity * current_price,
        metadata=tx_meta,
    )

    if holding is None:
        return Response({"message": "Asset fully sold and removed from portfolio.", "asset": None}, status=201)

    refreshed_holding = Holding.objects.select_related("asset").prefetch_related(
        "asset__price_points"
    ).get(pk=holding.pk)

    return Response(
        {
            "message": "Asset saved to portfolio.",
            "asset": serialize_holding(refreshed_holding),
        },
        status=201,
    )



@api_view(["POST"])
def import_binance_csv(request):
    """Imports a Binance Trade History CSV, FIFO-matches buys/sells per asset,
    and persists the resulting holdings + per-trade realized PnL."""
    username = get_requested_username(request)
    portfolio_name = DEFAULT_PORTFOLIO_NAME
    exchange = "Binance"

    uploaded_file = request.FILES.get("file")
    if uploaded_file is None:
        return Response({"error": "No file uploaded. Attach the CSV under the 'file' field."}, status=400)

    try:
        trades, skipped = parse_binance_csv(uploaded_file)
    except CsvFormatError as exc:
        return Response({"error": str(exc)}, status=400)

    if not trades:
        return Response(
            {"error": "No usable trade rows found in the file.", "skippedRows": skipped},
            status=400,
        )

    fifo_results = compute_fifo(trades)
    portfolio = get_portfolio(username, portfolio_name)
    touched_holdings = []

    for symbol, result in fifo_results.items():
        asset, _ = Asset.objects.get_or_create(
            symbol=symbol,
            defaults={"name": symbol, "asset_type": "crypto", "metadata": {}},
        )
        if asset.asset_type != "crypto":
            asset.asset_type = "crypto"
            asset.save(update_fields=["asset_type"])

        holding = Holding.objects.filter(
            portfolio=portfolio, asset=asset, metadata__exchange=exchange
        ).first()

        if result.remaining_quantity > 1e-12:
            if holding:
                holding.quantity = result.remaining_quantity
                holding.cost_basis = result.avg_cost_basis
                holding.save(update_fields=["quantity", "cost_basis"])
            else:
                holding = Holding.objects.create(
                    portfolio=portfolio,
                    asset=asset,
                    quantity=result.remaining_quantity,
                    cost_basis=result.avg_cost_basis,
                    metadata={"exchange": exchange},
                )
        elif holding:
            holding.delete()
            holding = None

        for processed in result.processed_trades:
            row = processed.row
            tx_meta = {"exchange": exchange, "source": "csv_import"}
            if processed.realized_pnl is not None:
                tx_meta["realized_pnl"] = processed.realized_pnl
            Transaction.objects.create(
                portfolio=portfolio,
                asset=asset,
                transaction_type=row.side,
                quantity=row.quantity,
                price=row.price,
                total=row.notional,
                metadata=tx_meta,
            )

        ensure_asset_history(asset, period="6mo")

        if holding is not None:
            refreshed_holding = Holding.objects.select_related("asset").prefetch_related(
                "asset__price_points"
            ).get(pk=holding.pk)
            touched_holdings.append(serialize_holding(refreshed_holding))

    return Response(
        {
            "message": f"Imported {len(trades)} trade row(s) across {len(fifo_results)} asset(s).",
            "assets": touched_holdings,
            "realizedPnl": realized_pnl_for_portfolio(portfolio),
            "skippedRows": skipped,
        },
        status=201,
    )


@api_view(["GET"])
def live_price(request):
    """Return the current market price for a single symbol via yfinance."""
    symbol = request.query_params.get("symbol", "")
    asset_class = request.query_params.get("assetClass", "crypto")
    market_symbol = request.query_params.get("marketSymbol", "")

    if not symbol:
        return Response({"error": "symbol is required"}, status=400)

    # Determine the ticker yfinance should look up
    if market_symbol:
        ticker = market_symbol
    else:
        # Build a temporary Asset-like lookup
        crypto_aliases = {
            "BTC": "BTC-USD", "ETH": "ETH-USD", "SOL": "SOL-USD",
            "BNB": "BNB-USD", "ADA": "ADA-USD", "XRP": "XRP-USD",
            "DOGE": "DOGE-USD", "AVAX": "AVAX-USD", "DOT": "DOT-USD",
            "MATIC": "MATIC-USD", "LINK": "LINK-USD", "UNI": "UNI-USD",
            "SHIB": "SHIB-USD", "LTC": "LTC-USD", "TRX": "TRX-USD",
            "USDT": "USDT-USD", "USDC": "USDC-USD",
        }
        upper = symbol.strip().upper()
        if asset_class == "crypto":
            ticker = crypto_aliases.get(upper, f"{upper}-USD")
        elif asset_class == "forex":
            ticker = f"{upper}=X" if not upper.endswith("=X") else upper
        else:
            ticker = upper

    try:
        import yfinance as yf
        info = yf.Ticker(ticker)
        fast = info.fast_info
        price = getattr(fast, "last_price", None) or getattr(fast, "previous_close", None)
        if price is None:
            return Response({"error": f"No price data for {ticker}"}, status=404)
        return Response({
            "symbol": symbol,
            "marketSymbol": ticker,
            "currentPrice": round(float(price), 6),
            "refreshedAt": timezone.now().isoformat(),
        })
    except Exception as exc:
        return Response({"error": str(exc)}, status=502)
