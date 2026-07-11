"""Parses a Binance Account Statement CSV export ("Generate all statements")
and computes FIFO-matched holdings + realized PnL per asset.

This export is a flat ledger, not a trade table: each row is a single coin
balance change for one operation at one instant. A spot Buy is three rows
sharing the same UTC_Time: "Transaction Buy" (base coin, positive Change),
"Transaction Spend" (quote coin, negative Change), and an optional
"Transaction Fee" row. A spot Sell is "Transaction Sold" (base coin,
negative Change), "Transaction Revenue" (quote coin, positive Change), and
an optional "Transaction Fee" row. Note the two legs of one trade use
*different* Operation labels, unlike a simple ledger — so rows are grouped
by timestamp alone, then classified by which operations are present.
"""

import re
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime

import pandas as pd

REQUIRED_COLUMNS = ["User_ID", "UTC_Time", "Account", "Operation", "Coin", "Change", "Remark"]

# Column signature of Binance's Trade History export (a different, unsupported
# CSV that users sometimes download by mistake instead of Transaction History).
TRADE_HISTORY_SIGNATURE_COLUMNS = {"pair", "side", "price", "executed", "amount"}

# Binance's export uses different header spellings across variants (e.g.
# "User ID" vs "User_ID", "Time" vs "UTC_Time"). Headers are matched
# case/space/underscore-insensitively and renamed to these canonical names
# before anything downstream looks at them.
HEADER_ALIASES: dict[str, str] = {
    "userid": "User_ID",
    "time": "UTC_Time",
    "utctime": "UTC_Time",
    "account": "Account",
    "operation": "Operation",
    "coin": "Coin",
    "change": "Change",
    "remark": "Remark",
}


def _normalize_header(name: object) -> str:
    return re.sub(r"[\s_]+", "", str(name).strip().lower())

# Quote assets treated as == USD for cost-basis purposes. Trades where
# neither leg is one of these (e.g. a straight ETH/BTC conversion) are out
# of scope and reported as skipped.
STABLE_QUOTES = {"USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USD", "DAI"}

BUY_OP = "transaction buy"
SPEND_OP = "transaction spend"
SOLD_OP = "transaction sold"
REVENUE_OP = "transaction revenue"
FEE_OP = "transaction fee"
CONVERT_OP = "binance convert"
KNOWN_OPERATIONS = {BUY_OP, SPEND_OP, SOLD_OP, REVENUE_OP, FEE_OP, CONVERT_OP}

# Always out of scope, but worth a specific reason rather than the generic
# "Unsupported operation" catch-all.
NON_TRADE_OPERATIONS = {
    "transfer between spot and funding",
    "transfer between spot and strategy",
    "transfer between spot and um futures",
    "token swap - distribution",
    "launchpool subscription/redemption",
    "asset recovery",
}

SUPPORTED_ACCOUNT = "spot"


class CsvFormatError(ValueError):
    """Raised when the uploaded file doesn't look like a Binance Account Statement export."""


@dataclass
class LedgerRow:
    row_index: int
    timestamp: datetime
    account: str
    operation: str
    coin: str
    change: float


@dataclass
class TradeRow:
    row_index: int
    timestamp: datetime
    base_asset: str
    quote_asset: str
    side: str  # "buy" or "sell"
    quantity: float
    price: float
    notional: float
    fee_amount: float
    fee_asset: str


@dataclass
class ProcessedTrade:
    row: TradeRow
    realized_pnl: float | None = None  # set only for sells


@dataclass
class FifoResult:
    symbol: str
    remaining_quantity: float = 0.0
    avg_cost_basis: float = 0.0
    processed_trades: list[ProcessedTrade] = field(default_factory=list)
    total_realized_pnl: float = 0.0


def _read_ledger_rows(file) -> tuple[list[LedgerRow], list[dict]]:
    try:
        df = pd.read_csv(file)
    except Exception as exc:  # pandas raises several distinct error types
        raise CsvFormatError(f"Could not read file as CSV: {exc}") from exc

    rename_map = {
        col: HEADER_ALIASES[_normalize_header(col)]
        for col in df.columns
        if _normalize_header(col) in HEADER_ALIASES
    }
    df = df.rename(columns=rename_map)

    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        normalized_cols = {_normalize_header(col) for col in df.columns}
        if TRADE_HISTORY_SIGNATURE_COLUMNS.issubset(normalized_cols):
            raise CsvFormatError(
                "This looks like a Binance Trade History export. Please upload "
                "the Transaction History (Account Statement) export instead — "
                "it has columns Time, Account, Operation, Coin, Change."
            )
        raise CsvFormatError(
            "This doesn't look like a Binance Account Statement export — "
            f"missing column(s): {', '.join(missing)}. Found columns: {', '.join(df.columns)}."
        )

    rows: list[LedgerRow] = []
    skipped: list[dict] = []

    for position, row in enumerate(df.to_dict(orient="records"), start=1):
        account = str(row["Account"]).strip()
        if account.lower() != SUPPORTED_ACCOUNT:
            skipped.append({"row": position, "reason": f"Unsupported account: {account!r} (only Spot is supported)"})
            continue

        try:
            change = float(str(row["Change"]).replace(",", "").strip())
        except ValueError:
            skipped.append({"row": position, "reason": f"Could not parse Change value: {row['Change']!r}"})
            continue

        try:
            timestamp = pd.to_datetime(row["UTC_Time"]).to_pydatetime()
        except (ValueError, TypeError):
            skipped.append({"row": position, "reason": f"Could not parse UTC_Time value: {row['UTC_Time']!r}"})
            continue

        rows.append(
            LedgerRow(
                row_index=position,
                timestamp=timestamp,
                account=account,
                operation=str(row["Operation"]).strip(),
                coin=str(row["Coin"]).strip().upper(),
                change=change,
            )
        )

    return rows, skipped


def _single_coin(rows: list[LedgerRow]) -> str | None:
    coins = {row.coin for row in rows}
    return next(iter(coins)) if len(coins) == 1 else None


def parse_binance_csv(file) -> tuple[list[TradeRow], list[dict]]:
    """Reads a Binance Account Statement CSV and reconstructs trades.

    Returns (trade_rows, skipped) where `skipped` is a list of
    {"row": <1-based row number>, "reason": <str>} for rows that were
    dropped (unsupported operation/account, ambiguous trade grouping, etc.)
    rather than raising, so a partially-usable file still imports what it
    can. A lone, unmatched Transaction Fee row is dropped silently.
    """
    ledger_rows, skipped = _read_ledger_rows(file)

    groups: dict[datetime, list[LedgerRow]] = defaultdict(list)
    for row in ledger_rows:
        operation_key = row.operation.strip().lower()
        if operation_key in KNOWN_OPERATIONS:
            groups[row.timestamp].append(row)
        elif operation_key in NON_TRADE_OPERATIONS:
            skipped.append({"row": row.row_index, "reason": f"Non-trade operation: {row.operation!r}"})
        else:
            skipped.append({"row": row.row_index, "reason": f"Unsupported operation: {row.operation!r}"})

    trades: list[TradeRow] = []

    for timestamp, group_rows in groups.items():
        by_op: dict[str, list[LedgerRow]] = defaultdict(list)
        for row in group_rows:
            by_op[row.operation.strip().lower()].append(row)

        fee_by_coin: dict[str, float] = defaultdict(float)
        for row in by_op.get(FEE_OP, []):
            fee_by_coin[row.coin] += abs(row.change)

        row_indices = [row.row_index for row in group_rows]
        has_buy_leg = BUY_OP in by_op and SPEND_OP in by_op
        has_sell_leg = SOLD_OP in by_op and REVENUE_OP in by_op
        convert_rows = by_op.get(CONVERT_OP, [])
        has_convert = len(convert_rows) >= 2

        if sum([has_buy_leg, has_sell_leg, has_convert]) > 1:
            skipped.extend(
                {"row": idx, "reason": f"Ambiguous event at {timestamp}: contains multiple trade types"}
                for idx in row_indices
            )
            continue

        if has_convert:
            net_by_coin: dict[str, float] = defaultdict(float)
            for row in convert_rows:
                net_by_coin[row.coin] += row.change
            nonzero = {coin: net for coin, net in net_by_coin.items() if abs(net) > 1e-12}

            if len(nonzero) != 2:
                skipped.extend(
                    {
                        "row": idx,
                        "reason": f"Ambiguous convert event at {timestamp}: expected 2 coins with net change, found {len(nonzero)}",
                    }
                    for idx in row_indices
                )
                continue

            spent = [(coin, -net) for coin, net in nonzero.items() if net < 0]
            received = [(coin, net) for coin, net in nonzero.items() if net > 0]

            if len(spent) != 1 or len(received) != 1:
                skipped.extend(
                    {"row": idx, "reason": f"Ambiguous convert event at {timestamp}: could not determine direction"}
                    for idx in row_indices
                )
                continue

            spent_coin, spent_amount = spent[0]
            received_coin, received_amount = received[0]

            if spent_coin in STABLE_QUOTES and received_coin not in STABLE_QUOTES:
                side, base_asset, quote_asset = "buy", received_coin, spent_coin
                quantity, notional = received_amount, spent_amount
            elif received_coin in STABLE_QUOTES and spent_coin not in STABLE_QUOTES:
                side, base_asset, quote_asset = "sell", spent_coin, received_coin
                quantity, notional = spent_amount, received_amount
            else:
                skipped.extend(
                    {"row": idx, "reason": "Crypto-to-crypto convert not supported (no USD cost basis)"}
                    for idx in row_indices
                )
                continue

            if quantity <= 1e-12:
                skipped.extend(
                    {"row": idx, "reason": f"Quantity must be greater than zero at {timestamp}"}
                    for idx in row_indices
                )
                continue

            trades.append(
                TradeRow(
                    row_index=min(row_indices),
                    timestamp=timestamp,
                    base_asset=base_asset,
                    quote_asset=quote_asset,
                    side=side,
                    quantity=quantity,
                    price=notional / quantity,
                    notional=notional,
                    fee_amount=0.0,
                    fee_asset="",
                )
            )
            continue

        if has_buy_leg:
            base_asset = _single_coin(by_op[BUY_OP])
            quote_asset = _single_coin(by_op[SPEND_OP])
            if base_asset is None or quote_asset is None:
                skipped.extend(
                    {"row": idx, "reason": f"Ambiguous buy event at {timestamp}: multiple coins on one leg"}
                    for idx in row_indices
                )
                continue
            if quote_asset not in STABLE_QUOTES:
                skipped.extend(
                    {
                        "row": idx,
                        "reason": f"Unsupported quote currency {quote_asset!r} at {timestamp} (only stablecoin quotes are supported)",
                    }
                    for idx in row_indices
                )
                continue

            quantity = sum(row.change for row in by_op[BUY_OP])
            notional = sum(abs(row.change) for row in by_op[SPEND_OP])
            fee_amount, fee_asset = 0.0, ""
            if base_asset in fee_by_coin:
                quantity -= fee_by_coin[base_asset]
            if quote_asset in fee_by_coin:
                fee_amount, fee_asset = fee_by_coin[quote_asset], quote_asset

            if quantity <= 1e-12:
                skipped.extend(
                    {"row": idx, "reason": f"Quantity must be greater than zero at {timestamp}"}
                    for idx in row_indices
                )
                continue

            trades.append(
                TradeRow(
                    row_index=min(row_indices),
                    timestamp=timestamp,
                    base_asset=base_asset,
                    quote_asset=quote_asset,
                    side="buy",
                    quantity=quantity,
                    price=notional / quantity,
                    notional=notional,
                    fee_amount=fee_amount,
                    fee_asset=fee_asset,
                )
            )
            continue

        if has_sell_leg:
            base_asset = _single_coin(by_op[SOLD_OP])
            quote_asset = _single_coin(by_op[REVENUE_OP])
            if base_asset is None or quote_asset is None:
                skipped.extend(
                    {"row": idx, "reason": f"Ambiguous sell event at {timestamp}: multiple coins on one leg"}
                    for idx in row_indices
                )
                continue
            if quote_asset not in STABLE_QUOTES:
                skipped.extend(
                    {
                        "row": idx,
                        "reason": f"Unsupported quote currency {quote_asset!r} at {timestamp} (only stablecoin quotes are supported)",
                    }
                    for idx in row_indices
                )
                continue

            quantity = sum(abs(row.change) for row in by_op[SOLD_OP])
            notional = sum(row.change for row in by_op[REVENUE_OP])
            fee_amount, fee_asset = 0.0, ""
            if quote_asset in fee_by_coin:
                fee_amount, fee_asset = fee_by_coin[quote_asset], quote_asset
            # A fee paid in the base coin on a sell isn't covered by the
            # known export shape — left unnetted, same as any other
            # fee-asset mismatch (see compute_fifo).

            if quantity <= 1e-12:
                skipped.extend(
                    {"row": idx, "reason": f"Quantity must be greater than zero at {timestamp}"}
                    for idx in row_indices
                )
                continue

            trades.append(
                TradeRow(
                    row_index=min(row_indices),
                    timestamp=timestamp,
                    base_asset=base_asset,
                    quote_asset=quote_asset,
                    side="sell",
                    quantity=quantity,
                    price=notional / quantity,
                    notional=notional,
                    fee_amount=fee_amount,
                    fee_asset=fee_asset,
                )
            )
            continue

        # No complete Buy/Spend, Sold/Revenue, or Convert pair in this bucket.
        # A lone unmatched Fee row, or a lone unmatched Convert row (len < 2,
        # so it never reached the has_convert branch above), has nothing to
        # attach to — drop quietly rather than reporting it.
        leftover_rows = [
            row
            for row in group_rows
            if row.operation.strip().lower() not in {FEE_OP, CONVERT_OP}
        ]
        if not leftover_rows:
            continue
        skipped.extend(
            {"row": idx, "reason": f"Incomplete trade event at {timestamp}: missing matching Buy/Spend or Sold/Revenue rows"}
            for idx in row_indices
        )

    trades.sort(key=lambda t: t.timestamp)
    return trades, skipped


def compute_fifo(rows: list[TradeRow]) -> dict[str, FifoResult]:
    """Groups trades by base asset and FIFO-matches sells against buys.

    Buy fees are folded into the lot's cost basis; sell fees are subtracted
    from proceeds. Fees paid in an asset other than the trade's quote
    currency are not netted (no USD price is available for them here) and
    are simply ignored in the PnL math.
    """
    by_symbol: dict[str, list[TradeRow]] = {}
    for row in rows:
        by_symbol.setdefault(row.base_asset, []).append(row)

    results: dict[str, FifoResult] = {}

    for symbol, symbol_rows in by_symbol.items():
        symbol_rows.sort(key=lambda r: r.timestamp)
        lots: deque[list[float]] = deque()  # each entry: [quantity, unit_cost]
        result = FifoResult(symbol=symbol)

        for row in symbol_rows:
            fee_usd = row.fee_amount if row.fee_asset == row.quote_asset else 0.0

            if row.side == "buy":
                unit_cost = (row.notional + fee_usd) / row.quantity
                lots.append([row.quantity, unit_cost])
                result.processed_trades.append(ProcessedTrade(row=row))
                continue

            # sell: match against oldest lots first
            remaining_to_sell = row.quantity
            fee_per_unit = fee_usd / row.quantity if row.quantity else 0.0
            realized_pnl = 0.0

            while remaining_to_sell > 1e-12 and lots:
                lot = lots[0]
                matched_qty = min(lot[0], remaining_to_sell)
                realized_pnl += matched_qty * (row.price - fee_per_unit - lot[1])
                lot[0] -= matched_qty
                remaining_to_sell -= matched_qty
                if lot[0] <= 1e-12:
                    lots.popleft()

            if remaining_to_sell > 1e-12:
                # Selling more than we have on record (e.g. history predates
                # the CSV's start date) — treat the excess as zero-cost.
                realized_pnl += remaining_to_sell * (row.price - fee_per_unit)

            result.processed_trades.append(ProcessedTrade(row=row, realized_pnl=realized_pnl))
            result.total_realized_pnl += realized_pnl

        remaining_qty = sum(lot[0] for lot in lots)
        remaining_cost = sum(lot[0] * lot[1] for lot in lots)
        result.remaining_quantity = remaining_qty
        result.avg_cost_basis = (remaining_cost / remaining_qty) if remaining_qty > 1e-12 else 0.0

        results[symbol] = result

    return results
