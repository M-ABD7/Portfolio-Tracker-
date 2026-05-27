"""
Exchange connectors package.

Provides read-only connectors for Binance, OKX, MEXC, and Bybit.
Use get_connector() to instantiate the right connector by exchange name.
"""

from .base import Balance, BaseExchangeConnector, ExchangeError, Trade
from .binance import BinanceConnector
from .bybit import BybitConnector
from .mexc import MEXCConnector
from .okx import OKXConnector


def get_connector(
    exchange: str,
    api_key: str,
    api_secret: str,
    passphrase: str = None,
) -> BaseExchangeConnector:
    """
    Factory — returns the right connector instance for the given exchange name.

    Supported exchanges: binance, okx, mexc, bybit (case-insensitive).
    Raises ExchangeError for unknown exchanges or missing required parameters.
    """
    exchange = exchange.lower()
    if exchange == "binance":
        return BinanceConnector(api_key, api_secret)
    if exchange == "okx":
        if not passphrase:
            raise ExchangeError("OKX requires a passphrase.")
        return OKXConnector(api_key, api_secret, passphrase)
    if exchange == "mexc":
        return MEXCConnector(api_key, api_secret)
    if exchange == "bybit":
        return BybitConnector(api_key, api_secret)
    raise ExchangeError(f"Exchange '{exchange}' is not supported. Supported: binance, okx, mexc, bybit.")


__all__ = [
    "Balance",
    "BaseExchangeConnector",
    "ExchangeError",
    "Trade",
    "BinanceConnector",
    "OKXConnector",
    "MEXCConnector",
    "BybitConnector",
    "get_connector",
]
