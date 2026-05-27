"""
Encryption service — thin re-export of the portfolio app's Fernet utilities.

After Phase 9 removes the legacy `portfolio` app, inline the Fernet logic here directly.
"""

from portfolio.encryption import decrypt, encrypt  # noqa: F401

__all__ = ["encrypt", "decrypt"]
