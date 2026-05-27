import sys
import os

try:
    import yfinance as yf
    import pandas as pd
    import pandas_ta as ta
    import openpyxl
    with open("verify_log.txt", "w") as f:
        f.write("Success: All imports verified.\n")
except Exception as e:
    with open("verify_log.txt", "w") as f:
        f.write(f"Error: {e}\n")
