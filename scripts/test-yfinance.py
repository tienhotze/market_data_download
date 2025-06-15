import yfinance as yf
import datetime as dt

# Test basic yfinance functionality
print("Testing yfinance...")

# Test 1: Simple ticker info
try:
    spy = yf.Ticker("SPY")
    info = spy.info
    print(f"SPY info available: {'symbol' in info}")
except Exception as e:
    print(f"SPY info failed: {e}")

# Test 2: Download recent data
try:
    end_date = dt.date.today()
    start_date = end_date - dt.timedelta(days=30)
    
    print(f"Downloading SPY from {start_date} to {end_date}")
    
    # Method 1: Direct download
    df1 = yf.download("SPY", start=start_date, end=end_date, progress=False)
    print(f"Method 1 - Direct download: {df1.shape}")
    print(f"Columns: {list(df1.columns)}")
    print(f"First few rows:")
    print(df1.head())
    
except Exception as e:
    print(f"Download test failed: {e}")
    import traceback
    print(traceback.format_exc())

# Test 3: Ticker history method
try:
    spy = yf.Ticker("SPY")
    df2 = spy.history(start=start_date, end=end_date)
    print(f"Method 2 - Ticker history: {df2.shape}")
    print(f"Columns: {list(df2.columns)}")
    
except Exception as e:
    print(f"Ticker history test failed: {e}")

print("Test complete!")
