"""
Base classes and shared data types for all exchange connectors.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


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
    """Raised when an exchange API call fails or returns an unexpected response."""


class BaseExchangeConnector(ABC):
    """
    Abstract base for all exchange connectors. Read-only methods only.
    """

    REQUEST_TIMEOUT: int = 10  # seconds

    @abstractmethod
    def validate_and_check_permissions(self) -> dict:
        """
        Validate API key and inspect permission flags.
        Returns {"valid": True, "warning": str | None}.
        Raises ExchangeError if the key is invalid.
        """

    @abstractmethod
    def get_balances(self) -> list:
        """
        Fetch all non-zero spot balances.
        Returns list of Balance dataclasses.
        Raises ExchangeError on API failure.
        """
