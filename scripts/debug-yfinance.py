# Simple test to debug yfinance issue
print("Testing yfinance download...")

try:
    import yfinance as yf
    print("✓ yfinance imported successfully")
    
    # Test 1: Basic ticker creation
    try:
        ticker = yf.Ticker("SPY")
        print("✓ Ticker object created")
    except Exception as e:
        print(f"✗ Ticker creation failed: {e}")
        
    # Test 2: Simple download
    try:
        print("Attempting download...")
        data = yf.download("SPY", period="1mo", progress=False)
        print(f"✓ Download successful: {data.shape}")
        print(f"Columns: {list(data.columns)}")
        print(f"Date range: {data.index[0]} to {data.index[-1]}")
    except Exception as e:
        print(f"✗ Download failed: {e}")
        import traceback
        print(traceback.format_exc())
        
    # Test 3: Alternative approach
    try:
        print("Trying alternative approach...")
        ticker = yf.Ticker("SPY")
        data2 = ticker.history(period="1mo")
        print(f"✓ Alternative successful: {data2.shape}")
    except Exception as e:
        print(f"✗ Alternative failed: {e}")
        
except ImportError as e:
    print(f"✗ Import failed: {e}")
    
print("Debug complete!")
