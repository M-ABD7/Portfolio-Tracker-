import hashlib
import hmac
import time
import urllib.parse

import requests

from .base import Balance, BaseExchangeConnector, ExchangeError, Trade

MEXC_BASE = "https://api.mexc.com"


class MEXCConnector(BaseExchangeConnector):
    """
    MEXC v3 REST API connector. MEXC uses a Binance-compatible auth scheme
    (HMAC-SHA256, same endpoint paths) but with a different base URL and header.
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
        resp = requests.get(url, headers={"X-MEXC-APIKEY": self._key}, timeout=self.REQUEST_TIMEOUT)
        if not resp.ok:
            data = resp.json() if resp.content else {}
            raise ExchangeError(f"MEXC error {resp.status_code}: {data.get('msg', resp.text)}")
        return resp.json()

    def validate_and_check_permissions(self) -> dict:
        self._get("/api/v3/account")
        return {
            "valid": True,
            "warning": (
                "Please confirm your MEXC API key has only Read permission. "
                "Disable Trade and Withdraw in MEXC -> API Management."
            ),
        }

    def get_balances(self) -> list:
        data = self._get("/api/v3/account")
        balances = []
        for b in data.get("balances", []):
            free = float(b.get("free", 0))
            locked = float(b.get("locked", 0))
            if free + locked > 0:
                balances.append(Balance(symbol=b["asset"], free=free, locked=locked))
        return balances

    def get_recent_trades(self, symbol: str, limit: int = 500) -> list:
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
