import argparse
import json
import os
import sys
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

import django
import pandas as pd


PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))


def setup_django() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tracker.settings")
    if PROJECT_ROOT not in sys.path:
        sys.path.insert(0, PROJECT_ROOT)
    django.setup()


setup_django()

from django.contrib.auth.models import User  # noqa: E402

try:  # noqa: E402
    from .models import Asset, Holding, Portfolio, PricePoint
except ImportError:  # noqa: E402
    from portfolio.models import Asset, Holding, Portfolio, PricePoint


BAR_WIDTH = 30


@dataclass
class HoldingSnapshot:
    symbol: str
    asset_name: str
    asset_type: str
    quantity: float
    cost_basis: float
    price_used: float
    total_value: float


def parse_metadata(raw_metadata: str | None) -> dict:
    if not raw_metadata:
        return {}
    try:
        parsed = json.loads(raw_metadata)
    except json.JSONDecodeError as exc:
        raise ValueError("Metadata must be valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Metadata must decode to a JSON object.")
    return parsed


def parse_decimal(raw_value: str, field_name: str) -> Decimal:
    try:
        return Decimal(raw_value)
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"{field_name} must be a valid number.") from exc


def get_or_create_user(username: str) -> User:
    user, _ = User.objects.get_or_create(username=username)
    return user


def get_or_create_portfolio(username: str, portfolio_name: str) -> Portfolio:
    user = get_or_create_user(username)
    portfolio, _ = Portfolio.objects.get_or_create(user=user, name=portfolio_name)
    return portfolio


def get_or_create_asset(symbol: str, name: str | None, asset_type: str, metadata: dict | None) -> Asset:
    cleaned_symbol = symbol.strip().upper()
    if not cleaned_symbol:
        raise ValueError("Symbol is required.")

    defaults = {
        "name": (name or cleaned_symbol).strip(),
        "asset_type": asset_type.strip().lower(),
        "metadata": metadata or {},
    }
    asset, created = Asset.objects.get_or_create(symbol=cleaned_symbol, defaults=defaults)

    if not created:
        changed = False
        if name and asset.name != name.strip():
            asset.name = name.strip()
            changed = True
        if asset_type and asset.asset_type != asset_type.strip().lower():
            asset.asset_type = asset_type.strip().lower()
            changed = True
        if metadata:
            merged_metadata = {**asset.metadata, **metadata}
            if merged_metadata != asset.metadata:
                asset.metadata = merged_metadata
                changed = True
        if changed:
            asset.save(update_fields=["name", "asset_type", "metadata"])

    return asset


def add_asset_to_portfolio(
    username: str,
    portfolio_name: str,
    symbol: str,
    quantity: float,
    cost_basis: float,
    *,
    name: str | None = None,
    asset_type: str = "stock",
    metadata: dict | None = None,
) -> Holding:
    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")
    if cost_basis < 0:
        raise ValueError("Cost basis cannot be negative.")

    portfolio = get_or_create_portfolio(username, portfolio_name)
    asset = get_or_create_asset(symbol, name, asset_type, metadata)

    holding, created = Holding.objects.get_or_create(
        portfolio=portfolio,
        asset=asset,
        defaults={"quantity": quantity, "cost_basis": cost_basis},
    )

    if not created:
        holding.quantity += quantity
        holding.cost_basis = cost_basis
        holding.save(update_fields=["quantity", "cost_basis"])

    return holding


def update_asset_in_portfolio(
    username: str,
    portfolio_name: str,
    symbol: str,
    *,
    quantity: float | None = None,
    cost_basis: float | None = None,
    name: str | None = None,
    asset_type: str | None = None,
    metadata: dict | None = None,
) -> Holding:
    portfolio = get_or_create_portfolio(username, portfolio_name)
    holding = Holding.objects.select_related("asset").filter(
        portfolio=portfolio,
        asset__symbol=symbol.strip().upper(),
    ).first()

    if holding is None:
        raise ValueError(f"{symbol.upper()} is not in portfolio '{portfolio_name}'.")

    if quantity is not None:
        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")
        holding.quantity = quantity
    if cost_basis is not None:
        if cost_basis < 0:
            raise ValueError("Cost basis cannot be negative.")
        holding.cost_basis = cost_basis
    holding.save(update_fields=["quantity", "cost_basis"])

    asset = holding.asset
    changed = False
    if name:
        asset.name = name.strip()
        changed = True
    if asset_type:
        asset.asset_type = asset_type.strip().lower()
        changed = True
    if metadata:
        asset.metadata = {**asset.metadata, **metadata}
        changed = True
    if changed:
        asset.save(update_fields=["name", "asset_type", "metadata"])

    return holding


def remove_asset_from_portfolio(username: str, portfolio_name: str, symbol: str) -> bool:
    portfolio = get_or_create_portfolio(username, portfolio_name)
    deleted, _ = Holding.objects.filter(
        portfolio=portfolio,
        asset__symbol=symbol.strip().upper(),
    ).delete()
    return deleted > 0


def latest_price_for_asset(asset: Asset, holding: Holding) -> float:
    latest_point = PricePoint.objects.filter(asset=asset).order_by("-timestamp").first()
    if latest_point is not None and latest_point.close is not None:
        return float(latest_point.close)
    if holding.cost_basis is not None:
        return float(holding.cost_basis)
    return 0.0


def build_portfolio_snapshot(username: str, portfolio_name: str) -> pd.DataFrame:
    portfolio = get_or_create_portfolio(username, portfolio_name)
    holdings = (
        Holding.objects.select_related("asset")
        .filter(portfolio=portfolio)
        .order_by("asset__symbol")
    )

    snapshots: list[HoldingSnapshot] = []
    for holding in holdings:
        asset = holding.asset
        price_used = latest_price_for_asset(asset, holding)
        total_value = float(holding.quantity) * price_used
        snapshots.append(
            HoldingSnapshot(
                symbol=asset.symbol,
                asset_name=asset.name,
                asset_type=asset.asset_type,
                quantity=float(holding.quantity),
                cost_basis=float(holding.cost_basis or 0.0),
                price_used=price_used,
                total_value=total_value,
            )
        )

    if not snapshots:
        return pd.DataFrame(
            columns=[
                "symbol",
                "name",
                "asset_type",
                "quantity",
                "cost_basis",
                "price_used",
                "total_value",
                "allocation_pct",
            ]
        )

    df = pd.DataFrame(
        [
            {
                "symbol": item.symbol,
                "name": item.asset_name,
                "asset_type": item.asset_type,
                "quantity": item.quantity,
                "cost_basis": item.cost_basis,
                "price_used": item.price_used,
                "total_value": item.total_value,
            }
            for item in snapshots
        ]
    )
    total_portfolio_value = float(df["total_value"].sum())
    if total_portfolio_value > 0:
        df["allocation_pct"] = (df["total_value"] / total_portfolio_value) * 100
    else:
        df["allocation_pct"] = 0.0
    return df.sort_values(by="allocation_pct", ascending=False).reset_index(drop=True)


def render_portfolio_table(df: pd.DataFrame) -> str:
    if df.empty:
        return "Portfolio is empty."

    formatted = df.copy()
    for column in ["quantity", "cost_basis", "price_used", "total_value", "allocation_pct"]:
        formatted[column] = formatted[column].map(lambda value: f"{value:,.2f}")
    return formatted.to_string(index=False)


def render_portfolio_visual(df: pd.DataFrame) -> str:
    if df.empty:
        return "No holdings to visualize."

    lines = ["\nPortfolio Allocation"]
    for row in df.itertuples(index=False):
        filled = int(round((row.allocation_pct / 100) * BAR_WIDTH))
        bar = "#" * filled + "-" * max(BAR_WIDTH - filled, 0)
        lines.append(f"{row.symbol:<10} [{bar}] {row.allocation_pct:6.2f}%")
    return "\n".join(lines)


def summarize_portfolio(username: str, portfolio_name: str) -> str:
    df = build_portfolio_snapshot(username, portfolio_name)
    total_value = float(df["total_value"].sum()) if not df.empty else 0.0
    lines = [
        f"\nPortfolio: {portfolio_name}",
        f"User: {username}",
        f"Total Holdings: {len(df)}",
        f"Estimated Value: {total_value:,.2f}",
        "",
        render_portfolio_table(df),
        render_portfolio_visual(df),
    ]
    return "\n".join(lines)


def prompt(message: str, *, allow_empty: bool = False) -> str:
    while True:
        value = input(message).strip()
        if value or allow_empty:
            return value
        print("This field is required.")


def prompt_float(message: str, *, allow_empty: bool = False) -> float | None:
    while True:
        raw_value = input(message).strip()
        if not raw_value and allow_empty:
            return None
        try:
            return float(parse_decimal(raw_value, message))
        except ValueError as exc:
            print(exc)


def interactive_menu() -> None:
    username = prompt("Enter username: ")
    portfolio_name = prompt("Enter portfolio name: ")

    actions = {
        "1": "Add asset",
        "2": "Update asset",
        "3": "Remove asset",
        "4": "Show portfolio",
        "5": "Exit",
    }

    while True:
        print("\n=== Portfolio Asset Manager ===")
        for key, label in actions.items():
            print(f"{key}. {label}")

        choice = prompt("Select an action: ")

        try:
            if choice == "1":
                symbol = prompt("Symbol: ")
                name = prompt("Name (optional): ", allow_empty=True)
                asset_type = prompt("Asset type [crypto/forex/commodity/stock]: ")
                quantity = prompt_float("Quantity: ")
                cost_basis = prompt_float("Cost basis per unit: ")
                metadata_input = prompt("Metadata JSON (optional): ", allow_empty=True)
                metadata = parse_metadata(metadata_input)
                add_asset_to_portfolio(
                    username,
                    portfolio_name,
                    symbol,
                    quantity or 0.0,
                    cost_basis or 0.0,
                    name=name or None,
                    asset_type=asset_type,
                    metadata=metadata,
                )
                print(f"{symbol.upper()} added to {portfolio_name}.")

            elif choice == "2":
                symbol = prompt("Symbol to update: ")
                quantity = prompt_float("New quantity (leave blank to keep current): ", allow_empty=True)
                cost_basis = prompt_float("New cost basis (leave blank to keep current): ", allow_empty=True)
                name = prompt("New name (optional): ", allow_empty=True)
                asset_type = prompt("New asset type (optional): ", allow_empty=True)
                metadata_input = prompt("Metadata JSON to merge (optional): ", allow_empty=True)
                metadata = parse_metadata(metadata_input)
                update_asset_in_portfolio(
                    username,
                    portfolio_name,
                    symbol,
                    quantity=quantity,
                    cost_basis=cost_basis,
                    name=name or None,
                    asset_type=asset_type or None,
                    metadata=metadata,
                )
                print(f"{symbol.upper()} updated.")

            elif choice == "3":
                symbol = prompt("Symbol to remove: ")
                if remove_asset_from_portfolio(username, portfolio_name, symbol):
                    print(f"{symbol.upper()} removed from {portfolio_name}.")
                else:
                    print(f"{symbol.upper()} was not found in {portfolio_name}.")

            elif choice == "4":
                print(summarize_portfolio(username, portfolio_name))

            elif choice == "5":
                print("Exiting asset manager.")
                return

            else:
                print("Invalid selection. Choose 1, 2, 3, 4, or 5.")

        except ValueError as exc:
            print(f"Error: {exc}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage portfolio assets and visualize allocations.")
    parser.add_argument("--username", help="Username that owns the portfolio.")
    parser.add_argument("--portfolio", help="Portfolio name.")
    parser.add_argument(
        "--action",
        choices=["add", "update", "remove", "show", "interactive"],
        default="interactive",
        help="Action to perform.",
    )
    parser.add_argument("--symbol", help="Asset symbol, for example BTC or EURUSD=X.")
    parser.add_argument("--name", help="Human-readable asset name.")
    parser.add_argument("--asset-type", help="Asset type.")
    parser.add_argument("--quantity", type=float, help="Holding quantity.")
    parser.add_argument("--cost-basis", type=float, help="Cost basis per unit.")
    parser.add_argument("--metadata", help="JSON metadata to attach to the asset.")
    return parser


def validate_required_args(args: argparse.Namespace) -> tuple[str, str]:
    if not args.username or not args.portfolio:
        raise ValueError("--username and --portfolio are required for non-interactive actions.")
    return args.username, args.portfolio


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.action == "interactive":
        interactive_menu()
        return

    username, portfolio_name = validate_required_args(args)
    metadata = parse_metadata(args.metadata)

    if args.action == "add":
        if args.symbol is None or args.quantity is None or args.cost_basis is None:
            raise ValueError("--symbol, --quantity, and --cost-basis are required for add.")
        add_asset_to_portfolio(
            username,
            portfolio_name,
            args.symbol,
            args.quantity,
            args.cost_basis,
            name=args.name,
            asset_type=args.asset_type or "stock",
            metadata=metadata,
        )
        print(f"{args.symbol.upper()} added to {portfolio_name}.")

    elif args.action == "update":
        if args.symbol is None:
            raise ValueError("--symbol is required for update.")
        update_asset_in_portfolio(
            username,
            portfolio_name,
            args.symbol,
            quantity=args.quantity,
            cost_basis=args.cost_basis,
            name=args.name,
            asset_type=args.asset_type,
            metadata=metadata,
        )
        print(f"{args.symbol.upper()} updated.")

    elif args.action == "remove":
        if args.symbol is None:
            raise ValueError("--symbol is required for remove.")
        removed = remove_asset_from_portfolio(username, portfolio_name, args.symbol)
        if removed:
            print(f"{args.symbol.upper()} removed from {portfolio_name}.")
        else:
            print(f"{args.symbol.upper()} was not found in {portfolio_name}.")

    elif args.action == "show":
        print(summarize_portfolio(username, portfolio_name))


if __name__ == "__main__":
    main()
