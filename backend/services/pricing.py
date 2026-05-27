"""
Pricing service — thin re-export of yfinance data-fetcher utilities.

After Phase 9 removes the legacy `portfolio` app, inline the fetcher logic here directly.
"""

from portfolio.data_fetcher import (  # noqa: F401
    download_market_data,
    fetch_timeframes,
    get_live_price,
)

__all__ = ["get_live_price", "download_market_data", "fetch_timeframes"]
