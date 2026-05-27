import sys
import os
import pandas as pd

# Add current directory to path so we can import tracker
sys.path.append(os.getcwd())

from tracker.portfolio.data_fetcher import fetch_timeframes, save_to_excel, TIMEFRAMES

def test_fetch():
    symbol = "BTC-USD"
    print(f"Testing fetch for {symbol}...")
    
    # 1. Fresh Fetch
    print("\n--- FRESH FETCH TEST ---")
    # Ensure no existing file
    safe_name = symbol.replace("=", "_").replace("-", "_")
    filepath = os.path.join("market_data", f"{safe_name}.xlsx")
    if os.path.exists(filepath):
        os.remove(filepath)
        
    data = fetch_timeframes(symbol, TIMEFRAMES)
    save_to_excel(symbol, data)
    
    for tf, df in data.items():
        if not df.empty:
            min_date = df['Date'].min()
            max_date = df['Date'].max()
            print(f"{tf}: {len(df)} rows. Range: {min_date} to {max_date}")
        else:
            print(f"{tf}: EMPTY")

    # 2. Incremental Fetch Test
    print("\n--- INCREMENTAL FETCH TEST ---")
    # Run again, should update
    data_2 = fetch_timeframes(symbol, TIMEFRAMES)
    save_to_excel(symbol, data_2)
    
    for tf, df in data_2.items():
        if not df.empty:
            print(f"{tf}: {len(df)} rows (After update)")

if __name__ == "__main__":
    test_fetch()
