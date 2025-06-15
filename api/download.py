import json
import yfinance as yf
import pandas as pd
from http.server import BaseHTTPRequestHandler
import time

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            tickers = data.get('tickers', [])
            start_date = data.get('start')
            end_date = data.get('end')
            
            if not tickers or not start_date or not end_date:
                raise ValueError("Missing required parameters")
            
            # Download data with retry logic
            df = None
            max_retries = 3
            retry_delay = 5
            
            for attempt in range(max_retries):
                try:
                    if len(tickers) == 1:
                        df = yf.download(tickers[0], start=start_date, end=end_date, progress=False)
                    else:
                        df = yf.download(" ".join(tickers), start=start_date, end=end_date, group_by='ticker', progress=False)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        raise e
            
            if df is None or df.empty:
                raise ValueError(f"No data found for ticker(s): {', '.join(tickers)}")
            
            # Convert to list of dictionaries
            result_data = []
            
            if len(tickers) == 1:
                # Single ticker
                df_reset = df.reset_index()
                for _, row in df_reset.iterrows():
                    result_data.append({
                        'Date': row['Date'].strftime('%Y-%m-%d') if pd.notna(row['Date']) else '',
                        'Open': float(row['Open']) if pd.notna(row['Open']) else None,
                        'High': float(row['High']) if pd.notna(row['High']) else None,
                        'Low': float(row['Low']) if pd.notna(row['Low']) else None,
                        'Close': float(row['Close']) if pd.notna(row['Close']) else None,
                        'Adj Close': float(row['Adj Close']) if pd.notna(row['Adj Close']) else None,
                        'Volume': int(row['Volume']) if pd.notna(row['Volume']) else None
                    })
            else:
                # Multiple tickers - for now, just return the first ticker's data
                ticker = tickers[0]
                if ticker in df.columns.levels[0]:
                    ticker_df = df[ticker].reset_index()
                    for _, row in ticker_df.iterrows():
                        result_data.append({
                            'Date': row['Date'].strftime('%Y-%m-%d') if pd.notna(row['Date']) else '',
                            'Open': float(row['Open']) if pd.notna(row['Open']) else None,
                            'High': float(row['High']) if pd.notna(row['High']) else None,
                            'Low': float(row['Low']) if pd.notna(row['Low']) else None,
                            'Close': float(row['Close']) if pd.notna(row['Close']) else None,
                            'Adj Close': float(row['Adj Close']) if pd.notna(row['Adj Close']) else None,
                            'Volume': int(row['Volume']) if pd.notna(row['Volume']) else None
                        })
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'data': result_data,
                'ticker': tickers[0] if tickers else '',
                'start': start_date,
                'end': end_date
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            # Send error response
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {'error': f'Download failed: {str(e)}'}
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
