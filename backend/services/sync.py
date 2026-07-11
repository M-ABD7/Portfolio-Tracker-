"""
Exchange sync service.

Contains the core logic for fetching live balances from an exchange and
upserting Holdings in the user portfolio. Extracted from portfolio/api.py
to make the logic testable and reusable by the new apps/exchanges/ views.
"""

import logging

from django.utils import timezone

from exchange_connectors import ExchangeError, get_connector
from services.encryption import decrypt

logger = logging.getLogger(__name__)


def sync_exchange_holdings(connection) -> dict:
    """
    Fetch live balances from the exchange and upsert Holdings for the user.

    Args:
        connection: ExchangeConnection model instance (legacy portfolio app or new app)

    Returns:
        {"synced": int, "added": int, "updated": int, "removed": int}

    Raises:
        ExchangeError: if the exchange API call fails
    """
    from portfolio.models import Asset, Holding  # imported here to keep service layer decoupled

    api_key = decrypt(connection.api_key_enc)
    api_secret = decrypt(connection.api_secret_enc)
    passphrase = decrypt(connection.passphrase_enc) if connection.passphrase_enc else None

    connector = get_connector(connection.exchange, api_key, api_secret, passphrase)
    balances = connector.get_balances()

    # Get or create portfolio for this user (uses legacy helper during transition)
    from portfolio.api import get_or_create_portfolio
    portfolio = get_or_create_portfolio(connection.user)
    exchange_label = connection.get_exchange_display()

    added = updated = synced = 0
    touched_asset_ids = set()

    for bal in balances:
        symbol = bal.symbol.upper()
        # Skip dust stablecoins
        if symbol in ("USDT", "BUSD", "USDC", "TUSD", "DAI") and bal.total < 1:
            continue
        if bal.total <= 0:
            continue

        asset, _ = Asset.objects.get_or_create(
            symbol=symbol,
            defaults={
                "name": symbol,
                "asset_type": "crypto",
                "metadata": {},
            },
        )
        touched_asset_ids.add(asset.id)

        # Try to compute weighted avg cost basis from recent trades
        cost_basis = None
        try:
            if connection.exchange == "binance":
                trades = connector.get_recent_trades(f"{symbol}USDT")
                buy_trades = [t for t in trades if t.side == "BUY"]
                if buy_trades:
                    total_qty = sum(t.qty for t in buy_trades)
                    total_cost = sum(t.qty * t.price for t in buy_trades)
                    cost_basis = total_cost / total_qty if total_qty else None
            elif connection.exchange == "okx":
                fills = connector.get_recent_fills()
                relevant = [f for f in fills if symbol in f.symbol and f.side == "BUY"]
                if relevant:
                    total_qty = sum(f.qty for f in relevant)
                    total_cost = sum(f.qty * f.price for f in relevant)
                    cost_basis = total_cost / total_qty if total_qty else None
        except Exception:
            pass  # Cost basis is optional; continue without it

        holding = Holding.objects.filter(
            portfolio=portfolio,
            asset=asset,
            metadata__exchange=exchange_label,
        ).first()

        if holding:
            holding.quantity = bal.total
            if cost_basis is not None and holding.cost_basis is None:
                holding.cost_basis = cost_basis
            holding.metadata = {**holding.metadata, "exchange": exchange_label, "source": "sync"}
            holding.save(update_fields=["quantity", "cost_basis", "metadata"])
            updated += 1
        else:
            Holding.objects.create(
                portfolio=portfolio,
                asset=asset,
                quantity=bal.total,
                cost_basis=cost_basis,
                metadata={"exchange": exchange_label, "source": "sync"},
            )
            added += 1
        synced += 1

    # Remove holdings for this connection's exchange that are no longer present
    # in the fetched balances (fully sold, or fallen below the dust threshold).
    stale_qs = Holding.objects.filter(
        portfolio=portfolio,
        metadata__exchange=exchange_label,
    ).exclude(asset_id__in=touched_asset_ids)
    removed = stale_qs.count()
    if removed:
        logger.info(
            "Reconciling %d stale holding(s) for %s/%s: %s",
            removed,
            connection.user.username,
            connection.exchange,
            list(stale_qs.values_list("asset__symbol", flat=True)),
        )
        stale_qs.delete()

    connection.last_synced_at = timezone.now()
    connection.save(update_fields=["last_synced_at"])

    logger.info(
        "Sync complete for %s/%s: synced=%d added=%d updated=%d removed=%d",
        connection.user.username,
        connection.exchange,
        synced,
        added,
        updated,
        removed,
    )
    return {"synced": synced, "added": added, "updated": updated, "removed": removed}
