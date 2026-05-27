from rest_framework.throttling import ScopedRateThrottle


class AuthRateThrottle(ScopedRateThrottle):
    """10 requests/minute for auth endpoints (login, register)."""
    scope = "auth"


class ExchangeSyncRateThrottle(ScopedRateThrottle):
    """6 requests/hour for exchange sync endpoints."""
    scope = "exchange_sync"