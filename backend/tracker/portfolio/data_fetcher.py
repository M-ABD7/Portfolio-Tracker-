import yfinance as yf
import pandas as pd
import os

PORTFOLIO_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.dirname(os.path.dirname(PORTFOLIO_DIR))
DEFAULT_MARKET_DATA_DIR = os.path.join(PROJECT_ROOT, "market_data")
YFINANCE_CACHE_DIR = os.path.join(DEFAULT_MARKET_DATA_DIR, ".yf_cache")

os.makedirs(YFINANCE_CACHE_DIR, exist_ok=True)
try:
    yf.set_tz_cache_location(YFINANCE_CACHE_DIR)
except Exception:
    pass

CRYPTO_SYMBOL_ALIASES = {
    "BTC": "BTC-USD",
    "ETH": "ETH-USD",
    "SOL": "SOL-USD",
    "BNB": "BNB-USD",
}


def normalize_asset_symbol(symbol: str) -> tuple[str, str]:
    cleaned = symbol.strip()
    upper_cleaned = cleaned.upper()
    normalized = CRYPTO_SYMBOL_ALIASES.get(upper_cleaned, cleaned)
    display_name = upper_cleaned if upper_cleaned in CRYPTO_SYMBOL_ALIASES else cleaned
    return normalized, display_name


def download_market_data(
    symbol: str,
    *,
    period=None,
    interval="1d",
    start=None,
    end=None,
) -> pd.DataFrame:
    # `repair=True` helps correct occasional 100x Yahoo price glitches for some assets.
    return yf.download(
        tickers=symbol,
        period=period,
        interval=interval,
        start=start,
        end=end,
        auto_adjust=False,
        repair=True,
        progress=False,
    )


def fetch_from_backup(symbol: str):
    print(f"Using backup for {symbol} (fallback triggered)")
    return None


def get_live_price(symbol: str) -> float | None:
    try:
        ticker = yf.Ticker(symbol)

        fetch_attempts = [
            ("1d", "1m"),
            ("5d", "1m"),
            ("5d", "5m"),
            ("1mo", "1d"),
            ("5d", "1d"),
        ]

        for period, interval in fetch_attempts:
            try:
                data = ticker.history(period=period, interval=interval)
                if not data.empty:
                    current_price = data["Close"].iloc[-1]
                    return float(current_price)
            except Exception:
                continue

        raise ValueError("No live data returned")
    except Exception as exc:
        print(f"Error fetching live price for {symbol}: {exc}")
        return fetch_from_backup(symbol)

# FLATTEN MULTIINDEX COLUMNS
def flatten_columns(df: pd.DataFrame):
    if isinstance(df.columns, pd.MultiIndex):
        new_cols = []
        for col in df.columns.values:
            parts = [str(p) for p in col if p not in ("", None)]
            new_cols.append("_".join(parts).strip())
        df.columns = new_cols
    else:
        df.columns = [str(c) for c in df.columns]
    return df


# CLEAN & STANDARDIZE OHLC COLUMNS

def clean_ohlc(df: pd.DataFrame):
    df = flatten_columns(df)
    rename_map = {}

    for col in df.columns:
        c = col.lower()

        if "date" in c or "time" in c:
            rename_map[col] = "Date"
        elif "open" in c:
            rename_map[col] = "open"
        elif "high" in c:
            rename_map[col] = "high"
        elif "low" in c:
            rename_map[col] = "low"
        elif "close" in c and "adj" not in c:
            rename_map[col] = "close"
        elif "volume" in c:
            df.drop(columns=[col], inplace=True)

    df.rename(columns=rename_map, inplace=True)

    #  FIX TIMEZONE ERROR HERE
    if "Date" in df.columns:
        try:
            df["Date"] = pd.to_datetime(df["Date"])
            if df["Date"].dt.tz is not None:
                df["Date"] = df["Date"].dt.tz_localize(None)
        except Exception:
            pass

    # Correct column order
    desired_order = ["Date", "open", "high", "low", "close"]
    cols = [c for c in desired_order if c in df.columns]

    df = df[cols]

    return df


# FETCH TIMEFRAMES FOR ONE ASSET
def fetch_timeframes(symbol: str, timeframes: dict, output_dir=None):
    output_dir = output_dir or DEFAULT_MARKET_DATA_DIR
    result = {}
    
    # Construct path to check for existing data
    safe_name = symbol.replace("=", "_").replace("-", "_")
    filepath = os.path.join(output_dir, f"{safe_name}.xlsx")
    
    existing_data = {}
    if os.path.exists(filepath):
        print(f" Found existing data for {symbol}, loading...")
        try:
            existing_data = pd.read_excel(filepath, sheet_name=None)
            # Ensure Date is datetime
            for sheet, df in existing_data.items():
                if "Date" in df.columns:
                    df["Date"] = pd.to_datetime(df["Date"])
        except Exception as e:
            print(f" Error loading existing data: {e}")

    for tf, (period, interval) in timeframes.items():
        start_date = None
        use_period = period
        
        # Check if we have existing data for this timeframe
        if tf in existing_data and not existing_data[tf].empty:
            last_date = existing_data[tf]["Date"].max()
            if pd.notna(last_date):
                print(f" Updating {symbol} [{tf}] from {last_date}")
                start_date = last_date
                use_period = None # Use start instead of period

        print(f" Fetching {symbol} | {tf} (Period: {use_period}, Start: {start_date})")

        try:
            df = download_market_data(
                symbol,
                period=use_period,
                interval=interval,
                start=start_date,
            )
        except Exception as e:
            print(f" Error fetching {symbol} [{tf}]: {e}")
            df = pd.DataFrame()

        # FALLBACK: If empty and we were trying a specific period (Fresh fetch), try MAX
        if df.empty and start_date is None and use_period != "max":
            print(f" No data for {symbol} [{tf}] with period {use_period}. Switching to MAX...")
            try:
                df = download_market_data(
                    symbol,
                    period="max",
                    interval=interval,
                )
            except Exception:
                pass

        if df.empty:
            print(f" No data found for {symbol} [{tf}]")
            # If we have existing data, keep it
            if tf in existing_data:
                result[tf] = existing_data[tf]
            continue

        df.reset_index(inplace=True)
        df = clean_ohlc(df)
        
        # Merge with existing if available
        if tf in existing_data:
            old_df = existing_data[tf]
            # Concatenate
            combined = pd.concat([old_df, df])
            # Drop duplicates based on Date
            combined.drop_duplicates(subset=["Date"], keep="last", inplace=True)
            combined.sort_values("Date", inplace=True)
            result[tf] = combined
            print(f" {symbol} [{tf}] → Updated: {len(combined)} rows (New: {len(df)})")
        else:
            result[tf] = df
            print(f" {symbol} [{tf}] → New: {len(df)} rows")

    return result

# SAVE MULTIPLE TIMEFRAMES TO ONE EXCEL
def save_to_excel(symbol: str, data_dict: dict, output_dir=None):
    output_dir = output_dir or DEFAULT_MARKET_DATA_DIR
    os.makedirs(output_dir, exist_ok=True)

    safe_name = symbol.replace("=", "_").replace("-", "_")
    filepath = os.path.join(output_dir, f"{safe_name}.xlsx")

    with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
        for tf, df in data_dict.items():
            df.to_excel(writer, sheet_name=tf, index=False)

    print(f"💾 Saved Excel: {filepath}")


def fetch_close_prices_for_assets(symbols: list, timeframe="1d", output_dir=None, start_date=None, end_date=None):
    output_dir = output_dir or DEFAULT_MARKET_DATA_DIR
    close_frames = []

    if timeframe not in TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe: {timeframe}")

    start_ts = pd.to_datetime(start_date) if start_date else None
    end_ts = pd.to_datetime(end_date) if end_date else None
    download_end = end_ts + pd.Timedelta(days=1) if end_ts is not None else None

    for raw_symbol in symbols:
        symbol, display_name = normalize_asset_symbol(raw_symbol)
        print(f"Fetching close prices for {display_name} [{timeframe}]")

        if start_ts is not None or end_ts is not None:
            try:
                df = download_market_data(
                    symbol,
                    start=start_ts,
                    end=download_end,
                    interval="1d",
                )
            except Exception as e:
                print(f" Error fetching {display_name} daily closes: {e}")
                df = pd.DataFrame()

            if not df.empty:
                df.reset_index(inplace=True)
                df = clean_ohlc(df)
        else:
            timeframe_config = {timeframe: TIMEFRAMES[timeframe]}
            data_dict = fetch_timeframes(symbol, timeframe_config, output_dir=output_dir)
            df = data_dict.get(timeframe, pd.DataFrame())

        if df.empty or "Date" not in df.columns or "close" not in df.columns:
            print(f"Skipping {display_name}: close data unavailable")
            continue

        if start_ts is not None:
            df = df[df["Date"] >= start_ts]
        if end_ts is not None:
            df = df[df["Date"] <= end_ts]

        if df.empty:
            print(f"Skipping {display_name}: no rows found in requested date range")
            continue

        asset_close = df[["Date", "close"]].copy()
        asset_close.rename(columns={"close": display_name}, inplace=True)
        close_frames.append(asset_close)

    if not close_frames:
        return pd.DataFrame()

    merged = close_frames[0]
    for asset_close in close_frames[1:]:
        merged = merged.merge(asset_close, on="Date", how="outer")

    merged.sort_values("Date", inplace=True)
    merged.set_index("Date", inplace=True)

    return merged.dropna(how="all")


# FETCH MULTIPLE ASSETS
def fetch_multiple_assets(symbols: list, timeframes: dict, output_dir=None):
    output_dir = output_dir or DEFAULT_MARKET_DATA_DIR
    for symbol in symbols:
        print("\n=========================================")
        print(f"📡 Fetching all timeframes for {symbol}")
        print("=========================================")

        data_dict = fetch_timeframes(symbol, timeframes, output_dir=output_dir)
        if data_dict:
            save_to_excel(symbol, data_dict, output_dir=output_dir)
        else:
            print(f"⚠️ No data fetched for {symbol}")

    print("\n🎯 All assets fetched successfully!")

# USER SELECTION

CRYPTO = {
    "1": "BTC-USD",
    "2": "ETH-USD",
    "3": "SOL-USD",
    "4": "BNB-USD",
}

FOREX = {
    "1": "JPY=X",
    "2": "GBPUSD=X",
    "3": "EURJPY=X",
    "4": "GBPJPY=X",
    "5": "EURGBP=X",
    "6": "EURUSD=X",
    "7":"USDJPY=X",
    "8":"USDCHF=X",
    "9":"AUDUSD=X",
    "10":"USDCAD=X",
}

COMMODITY = {
    "1": "XAUUSD=X",
    "2": "GC=F",
    "3": "CL=F"
}

TIMEFRAMES = {
    "15m": ("60d", "15m"),
    "1h": ("730d", "1h"),
    "4h": ("730d", "4h"),
    "1d": ("6y", "1d")
}

def choose_market():
    print("\nSelect Market:")
    print("1. Crypto")
    print("2. Forex")
    print("3. Commodity")

    choice = input("Enter choice: ").strip()

    if choice == "1":
        for k, v in CRYPTO.items():
            print(f"{k}. {v}")
        nums = input("Select assets: ").split(",")
        return [CRYPTO[n.strip()] for n in nums]

    if choice == "2":
        for k, v in FOREX.items():
            print(f"{k}. {v}")
        nums = input("Select assets: ").split(",")
        return [FOREX[n.strip()] for n in nums]

    if choice == "3":
        for k, v in COMMODITY.items():
            print(f"{k}. {v}")
        nums = input("Select assets: ").split(",")
        return [COMMODITY[n.strip()] for n in nums]

    print("Invalid choice. Try again.")
    return choose_market()


# MAIN
if __name__ == "__main__":
    print("\n=== Portfolio Data Fetcher ===")
    symbols = choose_market()
    fetch_multiple_assets(symbols, TIMEFRAMES)

