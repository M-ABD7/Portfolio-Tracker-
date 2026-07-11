import logging

from core.throttles import ExchangeSyncRateThrottle
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from exchange_connectors import ExchangeError, get_connector
from services.encryption import decrypt, encrypt
from services.sync import sync_exchange_holdings

logger = logging.getLogger(__name__)

SUPPORTED_EXCHANGES = {"binance", "okx", "mexc", "bybit"}


def _get_connection_or_404(pk, user):
    from portfolio.models import ExchangeConnection
    try:
        return ExchangeConnection.objects.get(pk=pk, user=user, is_active=True)
    except ExchangeConnection.DoesNotExist:
        return None


@extend_schema(summary="Connect an exchange via API key", tags=["Exchanges"])
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ExchangeSyncRateThrottle])
def exchange_connect(request):
    from portfolio.models import ExchangeConnection

    exchange = (request.data.get("exchange") or "").strip().lower()
    api_key = (request.data.get("apiKey") or "").strip()
    api_secret = (request.data.get("apiSecret") or "").strip()
    passphrase = (request.data.get("passphrase") or "").strip() or None

    if not exchange or not api_key or not api_secret:
        return Response({"error": "exchange, apiKey, and apiSecret are required."}, status=400)
    if exchange not in SUPPORTED_EXCHANGES:
        return Response(
            {"error": f"'{exchange}' is not supported. Supported: {', '.join(sorted(SUPPORTED_EXCHANGES))}."},
            status=400,
        )
    if exchange == "okx" and not passphrase:
        return Response({"error": "OKX requires a passphrase."}, status=400)

    try:
        connector = get_connector(exchange, api_key, api_secret, passphrase)
        result = connector.validate_and_check_permissions()
    except ExchangeError as e:
        return Response({"error": f"Could not validate API key: {e}"}, status=400)
    except Exception as e:
        return Response({"error": f"Unexpected error contacting exchange: {e}"}, status=502)

    warning = result.get("warning") or ""
    connection, created = ExchangeConnection.objects.update_or_create(
        user=request.user,
        exchange=exchange,
        defaults={
            "api_key_enc": encrypt(api_key),
            "api_secret_enc": encrypt(api_secret),
            "passphrase_enc": encrypt(passphrase) if passphrase else None,
            "is_active": True,
            "permissions_warning": warning,
        },
    )

    try:
        sync_result = sync_exchange_holdings(connection)
    except Exception as e:
        logger.exception("Initial sync failed for %s/%s", request.user.username, exchange)
        sync_result = {"synced": 0, "added": 0, "updated": 0, "removed": 0, "error": str(e)}

    # Log the sync attempt
    from .models import ExchangeSyncLog
    ExchangeSyncLog.objects.create(
        user=request.user,
        exchange=exchange,
        synced_count=sync_result.get("synced", 0),
        added_count=sync_result.get("added", 0),
        updated_count=sync_result.get("updated", 0),
        error=sync_result.get("error", ""),
    )

    return Response(
        {
            "id": connection.pk,
            "exchange": connection.exchange,
            "maskedKey": connection.masked_key(),
            "isActive": connection.is_active,
            "lastSyncedAt": connection.last_synced_at.isoformat() if connection.last_synced_at else None,
            "warning": warning or None,
            "holdingsSynced": sync_result.get("synced", 0),
            "created": created,
        },
        status=201 if created else 200,
    )


@extend_schema(summary="List all exchange connections for the current user", tags=["Exchanges"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def exchange_connections(request):
    """GET /api/exchange/connections/"""
    from portfolio.models import ExchangeConnection
    conns = ExchangeConnection.objects.filter(user=request.user, is_active=True).order_by("exchange")
    data = [
        {
            "id": c.pk,
            "exchange": c.exchange,
            "maskedKey": c.masked_key(),
            "isActive": c.is_active,
            "lastSyncedAt": c.last_synced_at.isoformat() if c.last_synced_at else None,
            "permissionsWarning": c.permissions_warning or None,
        }
        for c in conns
    ]
    return Response({"connections": data})


@extend_schema(summary="Remove an exchange connection", tags=["Exchanges"])
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def exchange_connection_detail(request, pk):
    """DELETE /api/exchange/connections/<pk>/"""
    conn = _get_connection_or_404(pk, request.user)
    if conn is None:
        return Response({"error": "Connection not found."}, status=404)
    conn.is_active = False
    conn.save(update_fields=["is_active"])
    return Response(
        {"message": f"{conn.get_exchange_display()} connection removed. Your holdings remain in the portfolio."}
    )


@extend_schema(summary="Manually trigger a balance sync", tags=["Exchanges"])
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ExchangeSyncRateThrottle])
def exchange_sync(request, pk):
    connection = _get_connection_or_404(pk, request.user)
    if connection is None:
        return Response({"error": "Connection not found."}, status=404)

    # Re-check permissions on every sync
    try:
        api_key = decrypt(connection.api_key_enc)
        api_secret = decrypt(connection.api_secret_enc)
        passphrase = decrypt(connection.passphrase_enc) if connection.passphrase_enc else None
        connector = get_connector(connection.exchange, api_key, api_secret, passphrase)
        perm_result = connector.validate_and_check_permissions()
        connection.permissions_warning = perm_result.get("warning") or ""
        connection.save(update_fields=["permissions_warning"])
    except ExchangeError as e:
        return Response({"error": f"Key validation failed: {e}"}, status=400)
    except Exception as e:
        return Response({"error": f"Could not reach exchange: {e}"}, status=502)

    try:
        sync_result = sync_exchange_holdings(connection)
    except Exception as e:
        logger.exception("Sync failed for connection %s", pk)
        return Response({"error": f"Sync failed: {e}"}, status=500)

    # Log the sync
    from .models import ExchangeSyncLog
    ExchangeSyncLog.objects.create(
        user=request.user,
        exchange=connection.exchange,
        synced_count=sync_result["synced"],
        added_count=sync_result["added"],
        updated_count=sync_result["updated"],
    )

    return Response(
        {
            "synced": sync_result["synced"],
            "added": sync_result["added"],
            "updated": sync_result["updated"],
            "removed": sync_result["removed"],
            "warning": connection.permissions_warning or None,
        }
    )
