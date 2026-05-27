import yfinance as yf
print("Start")
try:
    df = yf.download("BTC-USD", period="1d", interval="1h", progress=False)
    print(f"Fetched: {len(df)} rows")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
print("End")
