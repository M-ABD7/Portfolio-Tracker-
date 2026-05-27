import hashlib
import hmac
import time
import urllib.parse

import requests

from .base import Balance, BaseExchangeConnector, ExchangeError, Trade

BINANCE_BASE = "https://api.binance.com"


class BinanceConnector(BaseExchangeConnector):
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
        resp = requests.get(url, headers={"X-MBX-APIKEY": self._key}, timeout=self.REQUEST_TIMEOUT)
        if not resp.ok:
            data = resp.json() if resp.content else {}
            raise ExchangeError(f"Binance error {resp.status_code}: {data.get('msg', resp.text)}")
        return resp.json()

    def validate_and_check_permissions(self) -> dict:
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
                "For security, please disable these in Binance -> API Management and keep only "
                "'Read Info' / 'Enable Reading'. This tracker only needs read access."
            )
        return {"valid": True, "warning": warning}

    def get_balances(self) -> list:
        data = self._get("/api/v3/account")
        balances = []
        for b in data.get("balances", []):
            free = float(b["free"])
            locked = float(b["locked"])
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
