import os

from data_fetcher import fetch_multiple_assets, TIMEFRAMES, FOREX, choose_market
from indicators import process_all_data
from signals import process_all_signals
from backtest import backtest_all

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "market_data")

def main():
    print("\n==============================")
    print(" FOREX PORTFOLIO POC RUNNER ")
    print("==============================\n")

    #  Select forex symbols
    symbols = choose_market()

    #  Fetch data
    print("\nSTEP 1: Fetching Market Data")
    fetch_multiple_assets(symbols, TIMEFRAMES, output_dir=DATA_DIR)

    #  Add indicators
    print("\nSTEP 2: Computing Indicators")
    process_all_data(DATA_DIR)

    #  Generate signals
    print("\nSTEP 3: Generating Trading Signals")
    process_all_signals(DATA_DIR)

    #  Run backtest
    print("\nSTEP 4: Running Backtests")
    backtest_all(DATA_DIR)

    print("\nCompleted Successfully")

if __name__ == "__main__":
    main()
