import os
import pandas as pd
import numpy as np


# =========================================================
# RISK CLASSIFICATION
# =========================================================
def classify_risk(volatility, max_drawdown, win_rate):

    if volatility < 0.02 and win_rate >= 60 and abs(max_drawdown) < 0.10:
        return "LOW RISK"

    elif volatility < 0.05 and win_rate >= 50 and abs(max_drawdown) < 0.20:
        return "MEDIUM RISK"

    else:
        return "HIGH RISK"


# =========================================================
# 1️⃣ CLASSIC BACKTEST (Opposite Signal Exit)
# =========================================================
def run_backtest_signal_exit(df):

    print("\n===== CLASSIC SIGNAL EXIT BACKTEST =====")

    df = df.reset_index(drop=True)
    df.columns = [c.lower() for c in df.columns]

    if "signal" not in df.columns:
        return

    trades = []
    current_trade = None

    for i in range(len(df)):

        signal = df.loc[i, "signal"]

        if signal == "BUY":
            price = df.loc[i, "low"]   # for BUY

            if current_trade is None:
                current_trade = ("LONG", price)

            elif current_trade[0] == "SHORT":
                trades.append((current_trade[0], current_trade[1], price))
                current_trade = None

        elif signal == "SELL":
            price = df.loc[i, "high"]  # for SELL

            if current_trade is None:
                current_trade = ("SHORT", price)

            elif current_trade[0] == "LONG":
                trades.append((current_trade[0], current_trade[1], price))
                current_trade = None

    returns = []

    for trade in trades:
        ttype, entry, exitp = trade

        if ttype == "LONG":
            ret = (exitp - entry) / entry
        else:
            ret = (entry - exitp) / entry

        returns.append(ret)

    if not returns:
        print("No trades.")
        return

    returns = pd.Series(returns)

    print("\n=========== SUMMARY ===========")
    print(f"Total Trades : {len(returns)}")
    print(f"Total Profit : {returns.sum():.6f}")
    print(f"Win Rate     : {(returns > 0).mean()*100:.2f}%")
    print(f"Volatility   : {returns.std():.4f}")
    print(f"Max Drawdown : {returns.cumsum().min():.4f}")
    print(f"Risk Level   : {classify_risk(returns.std(), returns.cumsum().min(), (returns > 0).mean()*100)}")


# =========================================================
# 2️⃣ STRUCTURE-BASED TP/SL BACKTEST
# =========================================================
def run_backtest_structure(df):

    print("\n===== STRUCTURE TP/SL BACKTEST =====")

    df = df.reset_index(drop=True)
    df.columns = [c.lower() for c in df.columns]

    required = ["signal", "tp", "sl", "high", "low", "close"]
    if not all(col in df.columns for col in required):
        print("Missing TP/SL columns.")
        return

    trades = []

    for i in range(len(df)):

        signal = df.loc[i, "signal"]

        if signal not in ["BUY", "SELL"]:
            continue

        entry = df.loc[i, "close"]
        tp = df.loc[i, "tp"]
        sl = df.loc[i, "sl"]

        if pd.isna(tp) or pd.isna(sl):
            continue

        for j in range(i + 1, len(df)):

            high = df.loc[j, "high"]
            low = df.loc[j, "low"]

            if signal == "BUY":

                if high >= tp:
                    trades.append((signal, entry, tp, "TP"))
                    break

                if low <= sl:
                    trades.append((signal, entry, sl, "SL"))
                    break

            elif signal == "SELL":

                if low <= tp:
                    trades.append((signal, entry, tp, "TP"))
                    break

                if high >= sl:
                    trades.append((signal, entry, sl, "SL"))
                    break

    if not trades:
        print("No trades.")
        return

    returns = []
    tp_hits = 0
    sl_hits = 0

    for trade in trades:
        ttype, entry, exitp, outcome = trade

        if outcome == "TP":
            tp_hits += 1
        else:
            sl_hits += 1

        if ttype == "BUY":
            ret = (exitp - entry) / entry
        else:
            ret = (entry - exitp) / entry

        returns.append(ret)

    returns = pd.Series(returns)

    print("\n=========== SUMMARY ===========")
    print(f"Total Trades : {len(returns)}")
    print(f"TP Hits      : {tp_hits}")
    print(f"SL Hits      : {sl_hits}")
    print(f"TP Hit Rate  : {(tp_hits/len(returns))*100:.2f}%")
    print(f"Total Profit : {returns.sum():.6f}")
    print(f"Win Rate     : {(returns > 0).mean()*100:.2f}%")
    print(f"Volatility   : {returns.std():.4f}")
    print(f"Max Drawdown : {returns.cumsum().min():.4f}")
    print(f"Risk Level   : {classify_risk(returns.std(), returns.cumsum().min(), (returns > 0).mean()*100)}")


# =========================================================
# RUN BOTH FOR EACH FILE
# =========================================================
def backtest_all(folder):

    print("\nSTEP 4: Running Backtests\n")

    for file in os.listdir(folder):

        if not file.endswith(".xlsx"):
            continue

        path = os.path.join(folder, file)

        xl = pd.ExcelFile(path)

        if "signals_1d" not in xl.sheet_names:
            continue

        print("\n===================================")
        print(f"File: {file}")
        print("===================================\n")

        df = pd.read_excel(path, sheet_name="signals_1d")

        run_backtest_signal_exit(df)
        run_backtest_structure(df)

    print("\nCompleted Successfully")


if __name__ == "__main__":
    backtest_all("market_data")