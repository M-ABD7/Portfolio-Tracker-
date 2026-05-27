import base64
import hashlib
import hmac
import time
import urllib.parse

import requests

from .base import Balance, BaseExchangeConnector, ExchangeError, Trade

OKX_BASE = "https://www.okx.com"


class OKXConnector(BaseExchangeConnector):
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
        resp = requests.get(f"{OKX_BASE}{full_path}", headers=headers, timeout=self.REQUEST_TIMEOUT)
        if not resp.ok:
            raise ExchangeError(f"OKX HTTP error {resp.status_code}: {resp.text}")
        data = resp.json()
        if data.get("code") != "0":
            raise ExchangeError(f"OKX API error {data.get('code')}: {data.get('msg')}")
        return data

    def validate_and_check_permissions(self) -> dict:
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
                "For security, please disable these in OKX -> API -> Edit and keep only "
                "'Read' permission. This tracker only needs read access."
            )
        return {"valid": True, "warning": warning}

    def get_balances(self) -> list:
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

    def get_recent_fills(self, inst_type: str = "SPOT", limit: int = 100) -> list:
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
