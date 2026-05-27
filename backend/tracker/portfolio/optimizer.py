import os

import numpy as np
import pandas as pd
from scipy.optimize import minimize

try:
    from .data_fetcher import DEFAULT_MARKET_DATA_DIR, fetch_close_prices_for_assets
except ImportError:
    from data_fetcher import DEFAULT_MARKET_DATA_DIR, fetch_close_prices_for_assets


DEFAULT_START_DATE = "2023-01-01"
DEFAULT_END_DATE = "2025-12-31"

MARKET_OPTIONS = {
    "1": ("crypto", {
        "1": ("BTC", "Bitcoin"),
        "2": ("ETH", "Ethereum"),
        "3": ("SOL", "Solana"),
        "4": ("BNB", "BNB"),
        "5": ("XRP", "Ripple"),
        "6": ("ADA", "Cardano"),
        "7": ("DOGE", "Dogecoin"),
        "8": ("AVAX", "Avalanche"),
        "9": ("DOT", "Polkadot"),
        "10": ("LINK", "Chainlink"),
    }),
    "2": ("forex", {
        "1": ("EURUSD=X", "EUR/USD"),
        "2": ("GBPUSD=X", "GBP/USD"),
        "3": ("USDJPY=X", "USD/JPY"),
        "4": ("USDCHF=X", "USD/CHF"),
        "5": ("AUDUSD=X", "AUD/USD"),
        "6": ("USDCAD=X", "USD/CAD"),
        "7": ("EURJPY=X", "EUR/JPY"),
        "8": ("GBPJPY=X", "GBP/JPY"),
        "9": ("EURGBP=X", "EUR/GBP"),
        "10": ("NZDUSD=X", "NZD/USD"),
    }),
}


def annualization_days(asset_name: str) -> int:
    upper_name = asset_name.upper()
    if upper_name.endswith("=X") or upper_name.endswith("=F"):
        return 252
    return 365


def compute_returns(price_df: pd.DataFrame) -> pd.DataFrame:
    return price_df.pct_change().dropna(how="any")


def compute_return_statistics(returns_df: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    avg_daily_returns = returns_df.mean()
    annualized_returns = pd.Series(
        {
            asset_name: (1 + avg_daily_returns[asset_name]) ** annualization_days(asset_name) - 1
            for asset_name in returns_df.columns
        }
    )
    variances = returns_df.var(ddof=0)
    return avg_daily_returns, annualized_returns, variances


def compute_covariance_matrix(returns_df: pd.DataFrame) -> pd.DataFrame:
    return returns_df.cov(ddof=0)


def portfolio_return(weights: np.ndarray, annualized_returns: np.ndarray) -> float:
    return float(np.dot(weights, annualized_returns))


def portfolio_variance(weights: np.ndarray, covariance_matrix: np.ndarray) -> float:
    return float(weights.T @ covariance_matrix @ weights)


def portfolio_metrics(
    weights: np.ndarray,
    annualized_returns: np.ndarray,
    covariance_matrix: np.ndarray,
    rf: float = 0.0,
) -> dict:
    port_return = portfolio_return(weights, annualized_returns)
    variance = portfolio_variance(weights, covariance_matrix)
    std_dev = float(np.sqrt(max(variance, 0.0)))
    sharpe = float((port_return - rf) / std_dev) if std_dev > 0 else 0.0

    return {
        "Return": port_return,
        "Variance": float(variance),
        "Std Dev": std_dev,
        "Sharpe": sharpe,
    }


def weight_constraint(weights: np.ndarray) -> float:
    return float(np.sum(weights) - 1.0)


def solve_weights(objective, initial_weights: np.ndarray) -> np.ndarray:
    asset_count = len(initial_weights)
    bounds = [(0.0, 1.0)] * asset_count
    constraints = {"type": "eq", "fun": weight_constraint}

    result = minimize(
        objective,
        initial_weights,
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"ftol": 1e-12, "eps": 1e-12},
    )

    if not result.success:
        raise ValueError(f"Optimization failed: {result.message}")

    return result.x


def min_variance_weights(covariance_matrix: np.ndarray) -> np.ndarray:
    asset_count = len(covariance_matrix)
    seed_weights = [np.ones(asset_count) / asset_count]
    seed_weights.extend(np.eye(asset_count))

    rng = np.random.default_rng(42)
    seed_weights.extend(rng.dirichlet(np.ones(asset_count), size=24))

    best_weights = None
    best_variance = None

    for initial_weights in seed_weights:
        try:
            weights = solve_weights(
                lambda current_weights: portfolio_variance(current_weights, covariance_matrix),
                initial_weights=np.asarray(initial_weights, dtype=float),
            )
        except ValueError:
            continue

        variance = portfolio_variance(weights, covariance_matrix)
        if best_variance is None or variance < best_variance:
            best_weights = weights
            best_variance = variance

    if best_weights is None:
        raise ValueError("Minimum variance optimization failed for all starting points.")

    return best_weights


def max_sharpe_weights(
    annualized_returns: np.ndarray,
    covariance_matrix: np.ndarray,
    rf: float = 0.0,
) -> np.ndarray:
    asset_count = len(annualized_returns)

    def neg_sharpe(weights: np.ndarray) -> float:
        ret = float(np.dot(weights, annualized_returns))
        var = float(weights.T @ covariance_matrix @ weights)
        std = float(np.sqrt(max(var, 1e-10)))
        return -(ret - rf) / std

    seed_weights = [np.ones(asset_count) / asset_count]
    seed_weights.extend(np.eye(asset_count))

    rng = np.random.default_rng(42)
    seed_weights.extend(rng.dirichlet(np.ones(asset_count), size=24))

    best_weights = None
    best_sharpe = None

    for initial_weights in seed_weights:
        try:
            weights = solve_weights(neg_sharpe, np.asarray(initial_weights, dtype=float))
        except ValueError:
            continue

        ret = float(np.dot(weights, annualized_returns))
        var = float(weights.T @ covariance_matrix @ weights)
        std = float(np.sqrt(max(var, 1e-10)))
        sharpe = (ret - rf) / std if std > 0 else 0.0

        if best_sharpe is None or sharpe > best_sharpe:
            best_weights = weights
            best_sharpe = sharpe

    if best_weights is None:
        return np.ones(asset_count) / asset_count

    return best_weights


def balanced_weights(min_weights: np.ndarray, max_weights: np.ndarray) -> np.ndarray:
    return (min_weights + max_weights) / 2.0


def build_risk_profile_table(
    asset_names: list[str],
    annualized_returns: pd.Series,
    covariance_df: pd.DataFrame,
    conservative_weights: np.ndarray,
    balanced_portfolio_weights: np.ndarray,
    aggressive_weights: np.ndarray,
    rf: float = 0.0,
) -> pd.DataFrame:
    covariance_matrix = covariance_df.values
    annualized_return_values = annualized_returns.values

    rows = []
    portfolios = [
        ("Conservative", conservative_weights),
        ("Balanced", balanced_portfolio_weights),
        ("Aggressive", aggressive_weights),
    ]

    for profile_name, weights in portfolios:
        row = {"Profile": profile_name}
        for asset_name, weight in zip(asset_names, weights):
            row[f"{asset_name} Weight"] = float(weight)

        row.update(
            portfolio_metrics(
                weights=weights,
                annualized_returns=annualized_return_values,
                covariance_matrix=covariance_matrix,
                rf=rf,
            )
        )
        rows.append(row)

    return pd.DataFrame(rows)


def analyze_prices(price_df: pd.DataFrame, rf: float = 0.0) -> dict:
    if price_df.empty:
        raise ValueError("No price data available for optimization.")

    if isinstance(price_df.index, pd.DatetimeIndex):
        price_df = price_df.sort_index()

    returns_df = compute_returns(price_df)
    if returns_df.empty:
        raise ValueError("Not enough price history to compute daily returns.")

    avg_daily_returns, annualized_returns, variances = compute_return_statistics(returns_df)
    covariance_df = compute_covariance_matrix(returns_df)

    # Annualize the covariance matrix so variance/std dev/Sharpe are on the same scale as annualized returns.
    ann_factor = max(annualization_days(name) for name in price_df.columns)
    annualized_cov_df = covariance_df * ann_factor

    conservative = min_variance_weights(annualized_cov_df.values)
    aggressive = max_sharpe_weights(annualized_returns.values, annualized_cov_df.values, rf=rf)
    balanced = balanced_weights(conservative, aggressive)

    risk_table = build_risk_profile_table(
        asset_names=list(price_df.columns),
        annualized_returns=annualized_returns,
        covariance_df=annualized_cov_df,
        conservative_weights=conservative,
        balanced_portfolio_weights=balanced,
        aggressive_weights=aggressive,
        rf=rf,
    )

    return {
        "close_prices": price_df,
        "daily_returns": returns_df,
        "return_statistics": pd.DataFrame(
            {
                "Avg Daily Return": avg_daily_returns,
                "Annual Return": annualized_returns,
                "Variance": variances,
            }
        ),
        "covariance_matrix": covariance_df,
        "risk_table": risk_table,
    }


def optimize_from_prices(price_df: pd.DataFrame, rf: float = 0.0) -> pd.DataFrame:
    return analyze_prices(price_df, rf=rf)["risk_table"]


def optimize_portfolio(
    symbols: list[str],
    start_date: str = DEFAULT_START_DATE,
    end_date: str = DEFAULT_END_DATE,
    rf: float = 0.0,
) -> pd.DataFrame:
    if not symbols or len(symbols) < 2:
        raise ValueError("Please provide at least two assets for optimization.")

    prices = fetch_close_prices_for_assets(
        symbols=symbols,
        timeframe="1d",
        start_date=start_date,
        end_date=end_date,
    )

    if prices.empty:
        raise ValueError("No close-price data was returned for the selected assets and optimizer date range.")

    return optimize_from_prices(prices, rf=rf)


def export_optimizer_workbook(
    symbols: list[str],
    start_date: str = DEFAULT_START_DATE,
    end_date: str = DEFAULT_END_DATE,
    rf: float = 0.0,
    output_path: str | None = None,
) -> str:
    prices = fetch_close_prices_for_assets(
        symbols=symbols,
        timeframe="1d",
        start_date=start_date,
        end_date=end_date,
    )

    analysis = analyze_prices(prices, rf=rf)

    if output_path is None:
        safe_assets = "_".join(asset.strip().upper().replace("=", "_").replace("-", "_") for asset in symbols)
        output_path = os.path.join(DEFAULT_MARKET_DATA_DIR, f"optimizer_check_{safe_assets}.xlsx")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        analysis["close_prices"].to_excel(writer, sheet_name="close_prices")
        analysis["daily_returns"].to_excel(writer, sheet_name="daily_returns")
        analysis["return_statistics"].to_excel(writer, sheet_name="return_statistics")
        analysis["covariance_matrix"].to_excel(writer, sheet_name="covariance_matrix")
        format_table_for_display(analysis["risk_table"]).to_excel(writer, sheet_name="risk_table", index=False)

    return output_path


def format_table_for_display(table: pd.DataFrame) -> pd.DataFrame:
    formatted = table.copy()
    weight_columns = [col for col in formatted.columns if col.endswith(" Weight")]
    metric_columns = ["Return", "Variance", "Std Dev", "Sharpe"]

    for column in weight_columns:
        formatted[column] = formatted[column].map(
            lambda value: f"{round(float(value) * 100, 2):g}%"
        )

    for column in metric_columns:
        formatted[column] = formatted[column].map(lambda value: round(float(value), 6))

    return formatted


def choose_market() -> tuple[str, dict]:
    print("\nSelect Market:")
    print("1. Crypto")
    print("2. Forex")

    choice = input("Enter choice: ").strip()
    if choice not in MARKET_OPTIONS:
        raise ValueError("Invalid market choice.")

    return MARKET_OPTIONS[choice]


def choose_assets(asset_options: dict) -> list[str]:
    print("\nAvailable Assets:")
    for key, (symbol, label) in asset_options.items():
        print(f"{key}. {label} ({symbol})")

    selected_keys = [item.strip() for item in input("Select assets (comma separated): ").split(",") if item.strip()]
    if len(selected_keys) < 2:
        raise ValueError("Please choose at least two assets.")

    invalid_keys = [key for key in selected_keys if key not in asset_options]
    if invalid_keys:
        raise ValueError(f"Invalid asset choice(s): {', '.join(invalid_keys)}")

    selected_symbols = []
    for key in selected_keys:
        symbol = asset_options[key][0]
        if symbol not in selected_symbols:
            selected_symbols.append(symbol)

    if len(selected_symbols) < 2:
        raise ValueError("Please choose at least two different assets.")

    return selected_symbols


if __name__ == "__main__":
    market_name, asset_options = choose_market()
    selected_assets = choose_assets(asset_options)

    print(f"\nRunning optimizer for {market_name}: {', '.join(selected_assets)}")
    risk_table = optimize_portfolio(selected_assets)
    workbook_path = export_optimizer_workbook(selected_assets)

    print("\nFinal Risk Table\n")
    print(format_table_for_display(risk_table).to_string(index=False))
    print(f"\nWorkbook saved to: {workbook_path}")
