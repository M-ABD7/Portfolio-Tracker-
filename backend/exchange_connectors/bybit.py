import hashlib
import hmac
import time
import urllib.parse

import requests

from .base import Balance, BaseExchangeConnector, ExchangeError

BYBIT_BASE = "https://api.bybit.com"


class BybitConnector(BaseExchangeConnector):
    """
    Bybit V5 REST API connector (read-only).
    Uses HMAC-SHA256 with X-BAPI-* headers for authentication.
    """

    def __init__(self, api_key: str, api_secret: str):
        self._key = api_key
        self._secret = api_secret.encode()

    def _sign(self, timestamp: str, recv_window: str, params_str: str) -> str:
        payload = f"{timestamp}{self._key}{recv_window}{params_str}"
        return hmac.new(self._secret, payload.encode(), hashlib.sha256).hexdigest()

    def _get(self, path: str, params: dict = None) -> dict:
        params = params or {}
        ts = str(int(time.time() * 1000))
        recv_window = "5000"
        query = urllib.parse.urlencode(params)
        sig = self._sign(ts, recv_window, query)
        headers = {
            "X-BAPI-API-KEY": self._key,
            "X-BAPI-TIMESTAMP": ts,
            "X-BAPI-RECV-WINDOW": recv_window,
            "X-BAPI-SIGN": sig,
        }
        url = f"{BYBIT_BASE}{path}"
        if query:
            url = f"{url}?{query}"
        resp = requests.get(url, headers=headers, timeout=self.REQUEST_TIMEOUT)
        if not resp.ok:
            raise ExchangeError(f"Bybit HTTP {resp.status_code}: {resp.text}")
        data = resp.json()
        if data.get("retCode") != 0:
            raise ExchangeError(
                f"Bybit API error {data.get('retCode')}: {data.get('retMsg')}"
            )
        return data

    def validate_and_check_permissions(self) -> dict:
        data = self._get("/v5/user/query-api")
        info = data.get("result", {})
        perms = info.get("permissions", {})
        dangerous = []
        if perms.get("Trade"):
            dangerous.append("trading")
        if perms.get("Withdraw"):
            dangerous.append("withdrawals")
        warning = None
        if dangerous:
            perm_str = " and ".join(dangerous)
            warning = (
                f"Your Bybit API key has {perm_str} permission(s) enabled. "
                "For security, enable only 'Read-Only' under Bybit -> API Management. "
                "This tracker only needs read access."
            )
        return {"valid": True, "warning": warning}

    def get_balances(self) -> list:
        data = self._get("/v5/account/wallet-balance", {"accountType": "SPOT"})
        balances = []
        for account in data.get("result", {}).get("list", []):
            for coin in account.get("coin", []):
                free = float(coin.get("availableToWithdraw") or 0)
                locked = float(coin.get("locked") or 0)
                if free + locked > 0:
                    balances.append(Balance(
                        symbol=coin["coin"],
                        free=free,
                        locked=locked,
                    ))
        return balances
