"""
Read-only exchange connectors for Binance and OKX.

These classes only call GET endpoints that read account state (balances, trade history).
They never call order placement, withdrawal, or transfer endpoints.
"""

import base64
import hashlib
import hmac
import time
import urllib.parse
from dataclasses import dataclass
from typing import Optional

import requests

BINANCE_BASE = "https://api.binance.com"
OKX_BASE = "https://www.okx.com"
MEXC_BASE = "https://api.mexc.com"

REQUEST_TIMEOUT = 10  # seconds


@dataclass
class Balance:
    symbol: str
    free: float
    locked: float

    @property
    def total(self) -> float:
        return self.free + self.locked


@dataclass
class Trade:
    symbol: str
    qty: float
    price: float
    side: str  # "BUY" or "SELL"
    time_ms: int


class ExchangeError(Exception):
    pass


# ── Binance ───────────────────────────────────────────────────────────────────

class BinanceConnector:
    def __init__(self, api_key: str, api_secret: str):
        self._key = api_key
        self._secret = api_secret.encode()

    def _sign(self, params: dict) -> str:
        query = urllib.parse.urlencode(params)
        sig = hmac.new(self._secret, query.encode(), hashlib.sha256).hexdigest()
        return f"{query}&signature={sig}"

    def _get(self, path: str, params: dict = None) -> dict:
        params = params or {}
        params["timestamp"] = int(time.time() * 1000)
        signed = self._sign(params)
        url = f"{BINANCE_BASE}{path}?{signed}"
        resp = requests.get(url, headers={"X-MBX-APIKEY": self._key}, timeout=REQUEST_TIMEOUT)
        if not resp.ok:
            data = resp.json() if resp.content else {}
            raise ExchangeError(f"Binance error {resp.status_code}: {data.get('msg', resp.text)}")
        return resp.json()

    def validate_and_check_permissions(self) -> dict:
        """
        Calls GET /api/v3/account to validate the key and inspect permission flags.
        Returns {"valid": True, "warning": str|None}.
        Raises ExchangeError if the key is invalid.
        """
        data = self._get("/api/v3/account")
        dangerous = []
        if data.get("canTrade"):
            dangerous.append("trading")
        if data.get("canWithdraw"):
            dangerous.append("withdrawals")
        warning = None
        if dangerous:
            perm_str = " and ".join(dangerous)
            warning = (
                f"Your Binance API key has {perm_str} permission(s) enabled. "
                "For security, please disable these in Binance → API Management and keep only "
                "'Read Info' / 'Enable Reading'. This tracker only needs read access."
            )
        return {"valid": True, "warning": warning}

    def get_balances(self, min_usd_value: float = 0.0) -> list[Balance]:
        """Returns all non-zero spot balances."""
        data = self._get("/api/v3/account")
        balances = []
        for b in data.get("balances", []):
            free = float(b["free"])
            locked = float(b["locked"])
            if free + locked > 0:
                balances.append(Balance(symbol=b["asset"], free=free, locked=locked))
        return balances

    def get_recent_trades(self, symbol: str, limit: int = 500) -> list[Trade]:
        """Returns recent fills for a spot symbol (e.g. 'BTCUSDT')."""
        data = self._get("/api/v3/myTrades", {"symbol": symbol, "limit": limit})
        trades = []
        for t in data:
            trades.append(Trade(
                symbol=symbol,
                qty=float(t["qty"]),
                price=float(t["price"]),
                side="BUY" if t["isBuyer"] else "SELL",
                time_ms=t["time"],
            ))
        return trades


# ── OKX ──────────────────────────────────────────────────────────────────────

class OKXConnector:
    def __init__(self, api_key: str, api_secret: str, passphrase: str):
        self._key = api_key
        self._secret = api_secret.encode()
        self._passphrase = passphrase

    def _sign(self, timestamp: str, method: str, path: str, body: str = "") -> str:
        message = f"{timestamp}{method.upper()}{path}{body}"
        sig = hmac.new(self._secret, message.encode(), hashlib.sha256).digest()
        return base64.b64encode(sig).decode()

    def _get(self, path: str, params: dict = None) -> dict:
        ts = str(time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()))
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        full_path = path + query
        sig = self._sign(ts, "GET", full_path)
        headers = {
            "OK-ACCESS-KEY": self._key,
            "OK-ACCESS-SIGN": sig,
            "OK-ACCESS-TIMESTAMP": ts,
            "OK-ACCESS-PASSPHRASE": self._passphrase,
            "Content-Type": "application/json",
        }
        resp = requests.get(f"{OKX_BASE}{full_path}", headers=headers, timeout=REQUEST_TIMEOUT)
        if not resp.ok:
            raise ExchangeError(f"OKX HTTP error {resp.status_code}: {resp.text}")
        data = resp.json()
        if data.get("code") != "0":
            raise ExchangeError(f"OKX API error {data.get('code')}: {data.get('msg')}")
        return data

    def validate_and_check_permissions(self) -> dict:
        """
        Calls GET /api/v5/account/config to validate the key and inspect permissions.
        Returns {"valid": True, "warning": str|None}.
        """
        data = self._get("/api/v5/account/config")
        cfg = data.get("data", [{}])[0]
        perm = str(cfg.get("perm", ""))
        dangerous = []
        if "trade" in perm:
            dangerous.append("trading")
        if "withdraw" in perm:
            dangerous.append("withdrawals")
        warning = None
        if dangerous:
            perm_str = " and ".join(dangerous)
            warning = (
                f"Your OKX API key has {perm_str} permission(s) enabled. "
                "For security, please disable these in OKX → API → Edit and keep only "
                "'Read' permission. This tracker only needs read access."
            )
        return {"valid": True, "warning": warning}

    def get_balances(self) -> list[Balance]:
        """Returns all non-zero funding/trading balances."""
        data = self._get("/api/v5/account/balance")
        balances = []
        for account in data.get("data", []):
            for detail in account.get("details", []):
                avail = float(detail.get("availEq") or detail.get("availBal") or 0)
                frozen = float(detail.get("frozenBal") or 0)
                if avail + frozen > 0:
                    balances.append(Balance(
                        symbol=detail["ccy"],
                        free=avail,
                        locked=frozen,
                    ))
        return balances

    def get_recent_fills(self, inst_type: str = "SPOT", limit: int = 100) -> list[Trade]:
        """Returns recent trade fills."""
        data = self._get("/api/v5/trade/fills-history", {"instType": inst_type, "limit": str(limit)})
        trades = []
        for f in data.get("data", []):
            trades.append(Trade(
                symbol=f.get("instId", ""),
                qty=float(f.get("fillSz", 0)),
                price=float(f.get("fillPx", 0)),
                side="BUY" if f.get("side") == "buy" else "SELL",
                time_ms=int(f.get("ts", 0)),
            ))
        return trades


# ── MEXC ─────────────────────────────────────────────────────────────────────

class MEXCConnector:
    """
    MEXC v3 REST API connector. MEXC's API is Binance-compatible (same auth scheme,
    same endpoint paths) but uses a different base URL and header name.
    """

    def __init__(self, api_key: str, api_secret: str):
        self._key = api_key
        self._secret = api_secret.encode()

    def _sign(self, params: dict) -> str:
        query = urllib.parse.urlencode(params)
        sig = hmac.new(self._secret, query.encode(), hashlib.sha256).hexdigest()
        return f"{query}&signature={sig}"

    def _get(self, path: str, params: dict = None) -> dict:
        params = params or {}
        params["timestamp"] = int(time.time() * 1000)
        signed = self._sign(params)
        url = f"{MEXC_BASE}{path}?{signed}"
        resp = requests.get(url, headers={"X-MEXC-APIKEY": self._key}, timeout=REQUEST_TIMEOUT)
        if not resp.ok:
            data = resp.json() if resp.content else {}
            raise ExchangeError(f"MEXC error {resp.status_code}: {data.get('msg', resp.text)}")
        return resp.json()

    def validate_and_check_permissions(self) -> dict:
        """Validates the key by fetching account info. Returns a static read-only advisory."""
        self._get("/api/v3/account")
        return {
            "valid": True,
            "warning": (
                "Please confirm your MEXC API key has only Read permission. "
                "Disable Trade and Withdraw in MEXC → API Management."
            ),
        }

    def get_balances(self, min_usd_value: float = 0.0) -> list[Balance]:
        """Returns all non-zero spot balances."""
        data = self._get("/api/v3/account")
        balances = []
        for b in data.get("balances", []):
            free = float(b.get("free", 0))
            locked = float(b.get("locked", 0))
            if free + locked > 0:
                balances.append(Balance(symbol=b["asset"], free=free, locked=locked))
        return balances

    def get_recent_trades(self, symbol: str, limit: int = 500) -> list[Trade]:
        """Returns recent fills for a spot symbol (e.g. 'BTCUSDT')."""
        data = self._get("/api/v3/myTrades", {"symbol": symbol, "limit": limit})
        trades = []
        for t in data:
            trades.append(Trade(
                symbol=symbol,
                qty=float(t["qty"]),
                price=float(t["price"]),
                side="BUY" if t["isBuyer"] else "SELL",
                time_ms=t["time"],
            ))
        return trades


def get_connector(exchange: str, api_key: str, api_secret: str, passphrase: Optional[str] = None):
    """Factory — returns the right connector for the given exchange name."""
    exchange = exchange.lower()
    if exchange == "binance":
        return BinanceConnector(api_key, api_secret)
    if exchange == "okx":
        if not passphrase:
            raise ExchangeError("OKX requires a passphrase.")
        return OKXConnector(api_key, api_secret, passphrase)
    if exchange == "mexc":
        return MEXCConnector(api_key, api_secret)
    raise ExchangeError(f"Exchange '{exchange}' is not supported yet.")
