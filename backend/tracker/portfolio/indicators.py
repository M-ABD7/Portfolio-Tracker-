import os
import pandas as pd
import pandas_ta as ta


def clean_columns(df):
    """
    Ensure standard OHLC column names exist:
    date, open, high, low, close
    """
    for col in list(df.columns):
        key = col.strip().lower()

        if key in ["date", "datetime", "timestamp"]:
            df.rename(columns={col: "date"}, inplace=True)
        elif key == "open":
            df.rename(columns={col: "open"}, inplace=True)
        elif key == "high":
            df.rename(columns={col: "high"}, inplace=True)
        elif key == "low":
            df.rename(columns={col: "low"}, inplace=True)
        elif key == "close":
            df.rename(columns={col: "close"}, inplace=True)

    return df


# =========================================================
# ADD INDICATORS + MARKET STRUCTURE
# =========================================================
def add_indicators(df):
    """
    Adds:
    SMA_20, EMA_50, RSI_14, MACD, MACD_signal
    Support_20, Resistance_20
    """

    df = df.copy()

    # Ensure numeric
    for col in ["open", "high", "low", "close"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # ---- MOVING AVERAGES ----
    df["SMA_20"] = ta.sma(df["close"], length=20)
    df["EMA_50"] = ta.ema(df["close"], length=50)

    # ---- RSI ----
    df["RSI_14"] = ta.rsi(df["close"], length=14)

    # ---- MACD ----
    macd = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd is not None:
        df["MACD"] = macd.iloc[:, 0]
        df["MACD_signal"] = macd.iloc[:, 1]
    else:
        df["MACD"] = float("nan")
        df["MACD_signal"] = float("nan")

    # =========================================================
    # MARKET STRUCTURE (SUPPORT & RESISTANCE)
    # =========================================================
    window = 20  # structure lookback

    df["Support_20"] = df["low"].rolling(window=window).min()
    df["Resistance_20"] = df["high"].rolling(window=window).max()

    return df


# =========================================================
# PROCESS INDICATORS FOR ONE EXCEL FILE
# =========================================================
def process_indicators_for_excel(filepath):
    print(f"\n📄 Adding indicators to: {filepath}")

    xl = pd.ExcelFile(filepath)
    out_sheets = {}

    for sheet in xl.sheet_names:

        # 🚫 SKIP already processed sheets
        if sheet.startswith(("indicators_", "signals_")):
            continue

        df = pd.read_excel(filepath, sheet_name=sheet)
        df = clean_columns(df)

        required = ["date", "open", "high", "low", "close"]
        if not all(c in df.columns for c in required):
            print(f"  ⏭ Skipping {sheet} — missing OHLC columns.")
            continue

        target_sheet_name = f"indicators_{sheet}"

        # =========================================================
        # SMART UPDATE CHECK
        # =========================================================
        if target_sheet_name in xl.sheet_names:
            try:
                existing_df = pd.read_excel(filepath, sheet_name=target_sheet_name)
                existing_df = clean_columns(existing_df)

                if "date" in df.columns and "date" in existing_df.columns:
                    df["date"] = pd.to_datetime(df["date"])
                    existing_df["date"] = pd.to_datetime(existing_df["date"])

                    source_last = df["date"].max()
                    existing_last = existing_df["date"].max()

                    if pd.notna(source_last) and pd.notna(existing_last) and source_last <= existing_last:
                        print(f"  ⏭ Skipping {sheet} (Already up to date: {existing_last})")
                        continue

            except Exception as e:
                print(f"  ⚠ Could not verify existing data for {target_sheet_name}: {e}")

        # Add indicators + structure
        df = add_indicators(df)

        out_sheets[target_sheet_name] = df

    if not out_sheets:
        print("⚠ No valid sheets found to process.")
        return

    # =========================================================
    # SAVE BACK TO SAME FILE
    # =========================================================
    with pd.ExcelWriter(filepath, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
        for name, df in out_sheets.items():
            df.to_excel(writer, sheet_name=name, index=False)
            print(f"  💾 Saved {name} to Excel.")


# =========================================================
# PROCESS ALL FILES
# =========================================================
def process_all_data(root_folder):
    print(f"\n📂 Processing indicators for all Excel files in: {root_folder}")

    for file in os.listdir(root_folder):
        if file.endswith(".xlsx") and not file.startswith("~$"):
            process_indicators_for_excel(os.path.join(root_folder, file))


if __name__ == "__main__":
    import sys
    folder = sys.argv[1] if len(sys.argv) > 1 else r"D:\Project\portfolio_tracker\market_data"
    process_all_data(folder)
