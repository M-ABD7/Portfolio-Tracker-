import logging
import os
import pandas as pd

logger = logging.getLogger(__name__)

# =========================================================
# SIGNAL GENERATION LOGIC
# =========================================================


def generate_signal(row):
    try:
        # Skip rows where key indicators are NaN — return HOLD rather than letting
        # NaN comparisons silently evaluate to False and produce wrong signals.
        if pd.isna(row["SMA_20"]) or pd.isna(row["EMA_50"]) or pd.isna(row["RSI_14"]) or pd.isna(row["MACD"]) or pd.isna(row["MACD_signal"]):
            return "HOLD"
        if (
            row["SMA_20"] < row["EMA_50"] and
            row["MACD"] < row["MACD_signal"] and
            row["RSI_14"] > 40
        ):
            return "BUY"
        if (
            row["SMA_20"] > row["EMA_50"] and
            row["MACD"] > row["MACD_signal"] and
            row["RSI_14"] < 60
        ):
            return "SELL"
    except Exception:
        logger.exception("generate_signal failed for row")
        return "HOLD"
    return "HOLD"


# =========================================================
# PROCESS SIGNALS
# =========================================================
def process_signals_for_excel(filepath):
    print(f"\n📄 Processing Signals for: {filepath}")

    try:
        xl = pd.ExcelFile(filepath)
    except Exception as e:
        print(f"❌ Failed to open {filepath}: {e}")
        return

    output_sheets = {}

    for sheet in xl.sheet_names:

        # Only process indicator sheets
        if not sheet.startswith("indicators_"):
            continue

        print(f"  ➜ Reading sheet: {sheet}")

        df = pd.read_excel(filepath, sheet_name=sheet)

        # Required structure columns
        required_cols = [
            "SMA_20", "EMA_50", "RSI_14",
            "MACD", "MACD_signal",
            "Support_20", "Resistance_20"
        ]

        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            print(f"❌ Missing columns in {sheet}: {missing}")
            continue

        # -----------------------------------------------------
        # Generate Signals
        # -----------------------------------------------------
        df["Signal"] = df.apply(generate_signal, axis=1)

        # -----------------------------------------------------
        # STRUCTURE-BASED TP / SL
        # -----------------------------------------------------
        df["TP"] = None
        df["SL"] = None

        for i in range(len(df)):

            signal = df.loc[i, "Signal"]

            if signal == "BUY":
                df.loc[i, "TP"] = df.loc[i, "Resistance_20"]
                df.loc[i, "SL"] = df.loc[i, "Support_20"]

            elif signal == "SELL":
                df.loc[i, "TP"] = df.loc[i, "Support_20"]
                df.loc[i, "SL"] = df.loc[i, "Resistance_20"]

        target_sheet_name = f"signals_{sheet.replace('indicators_', '')}"
        output_sheets[target_sheet_name] = df

        print(f"  ✔ Signals + TP/SL generated for {sheet}")

    if not output_sheets:
        print("⚠ No valid indicator sheets found.")
        return

    # Replace sheets completely (no smart skip)
    with pd.ExcelWriter(filepath, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
        for sheet_name, df in output_sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            print(f"  💾 Saved sheet: {sheet_name}")


# =========================================================
# PROCESS ALL FILES
# =========================================================
def process_all_signals(root_folder):
    print(f"\n📂 Scanning folder: {root_folder}")

    if not os.path.isdir(root_folder):
        print(f"⚠ Folder not found: {root_folder}")
        return

    for file in os.listdir(root_folder):
        if file.endswith(".xlsx") and not file.startswith("~$"):
            full_path = os.path.join(root_folder, file)
            process_signals_for_excel(full_path)


if __name__ == "__main__":
    import sys
    folder = sys.argv[1] if len(sys.argv) > 1 else "market_data"
    process_all_signals(folder)
