import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            query = data.get('q', '').strip().upper()
            limit = data.get('limit', 10)
            
            if len(query) < 1:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps([]).encode())
                return
            
            # Comprehensive list of popular tickers
            all_tickers = {
                # Major Tech Stocks
                'AAPL': {'name': 'Apple Inc.', 'type': 'Equity'},
                'MSFT': {'name': 'Microsoft Corporation', 'type': 'Equity'},
                'GOOGL': {'name': 'Alphabet Inc. Class A', 'type': 'Equity'},
                'GOOG': {'name': 'Alphabet Inc. Class C', 'type': 'Equity'},
                'AMZN': {'name': 'Amazon.com Inc.', 'type': 'Equity'},
                'TSLA': {'name': 'Tesla Inc.', 'type': 'Equity'},
                'META': {'name': 'Meta Platforms Inc.', 'type': 'Equity'},
                'NVDA': {'name': 'NVIDIA Corporation', 'type': 'Equity'},
                'NFLX': {'name': 'Netflix Inc.', 'type': 'Equity'},
                'ADBE': {'name': 'Adobe Inc.', 'type': 'Equity'},
                'CRM': {'name': 'Salesforce Inc.', 'type': 'Equity'},
                'ORCL': {'name': 'Oracle Corporation', 'type': 'Equity'},
                'IBM': {'name': 'International Business Machines', 'type': 'Equity'},
                
                # Financial Stocks
                'JPM': {'name': 'JPMorgan Chase & Co.', 'type': 'Equity'},
                'BAC': {'name': 'Bank of America Corp.', 'type': 'Equity'},
                'WFC': {'name': 'Wells Fargo & Company', 'type': 'Equity'},
                'GS': {'name': 'Goldman Sachs Group Inc.', 'type': 'Equity'},
                'MS': {'name': 'Morgan Stanley', 'type': 'Equity'},
                'V': {'name': 'Visa Inc.', 'type': 'Equity'},
                'MA': {'name': 'Mastercard Inc.', 'type': 'Equity'},
                'PYPL': {'name': 'PayPal Holdings Inc.', 'type': 'Equity'},
                
                # Healthcare & Pharma
                'JNJ': {'name': 'Johnson & Johnson', 'type': 'Equity'},
                'PFE': {'name': 'Pfizer Inc.', 'type': 'Equity'},
                'UNH': {'name': 'UnitedHealth Group Inc.', 'type': 'Equity'},
                'MRNA': {'name': 'Moderna Inc.', 'type': 'Equity'},
                'ABBV': {'name': 'AbbVie Inc.', 'type': 'Equity'},
                
                # Consumer & Retail
                'WMT': {'name': 'Walmart Inc.', 'type': 'Equity'},
                'HD': {'name': 'Home Depot Inc.', 'type': 'Equity'},
                'DIS': {'name': 'Walt Disney Company', 'type': 'Equity'},
                'NKE': {'name': 'Nike Inc.', 'type': 'Equity'},
                'SBUX': {'name': 'Starbucks Corporation', 'type': 'Equity'},
                'MCD': {'name': 'McDonald\'s Corporation', 'type': 'Equity'},
                'KO': {'name': 'Coca-Cola Company', 'type': 'Equity'},
                'PEP': {'name': 'PepsiCo Inc.', 'type': 'Equity'},
                
                # Energy & Utilities
                'XOM': {'name': 'Exxon Mobil Corporation', 'type': 'Equity'},
                'CVX': {'name': 'Chevron Corporation', 'type': 'Equity'},
                'NEE': {'name': 'NextEra Energy Inc.', 'type': 'Equity'},
                
                # ETFs
                'SPY': {'name': 'SPDR S&P 500 ETF Trust', 'type': 'ETF'},
                'QQQ': {'name': 'Invesco QQQ Trust', 'type': 'ETF'},
                'VTI': {'name': 'Vanguard Total Stock Market ETF', 'type': 'ETF'},
                'IWM': {'name': 'iShares Russell 2000 ETF', 'type': 'ETF'},
                'EFA': {'name': 'iShares MSCI EAFE ETF', 'type': 'ETF'},
                'VEA': {'name': 'Vanguard FTSE Developed Markets ETF', 'type': 'ETF'},
                'VWO': {'name': 'Vanguard FTSE Emerging Markets ETF', 'type': 'ETF'},
                'GLD': {'name': 'SPDR Gold Shares', 'type': 'ETF'},
                'SLV': {'name': 'iShares Silver Trust', 'type': 'ETF'},
                'TLT': {'name': 'iShares 20+ Year Treasury Bond ETF', 'type': 'ETF'},
                
                # Crypto
                'BTC-USD': {'name': 'Bitcoin USD', 'type': 'Cryptocurrency'},
                'ETH-USD': {'name': 'Ethereum USD', 'type': 'Cryptocurrency'},
                'ADA-USD': {'name': 'Cardano USD', 'type': 'Cryptocurrency'},
                'DOT-USD': {'name': 'Polkadot USD', 'type': 'Cryptocurrency'},
                'DOGE-USD': {'name': 'Dogecoin USD', 'type': 'Cryptocurrency'},
                
                # Indices
                '^GSPC': {'name': 'S&P 500', 'type': 'Index'},
                '^DJI': {'name': 'Dow Jones Industrial Average', 'type': 'Index'},
                '^IXIC': {'name': 'NASDAQ Composite', 'type': 'Index'},
                '^RUT': {'name': 'Russell 2000', 'type': 'Index'},
                '^VIX': {'name': 'CBOE Volatility Index', 'type': 'Index'},
            }
            
            results = []
            
            # Search for exact matches first
            if query in all_tickers:
                ticker_info = all_tickers[query]
                results.append({
                    'symbol': query,
                    'name': ticker_info['name'],
                    'type': ticker_info['type']
                })
            
            # Then search for partial matches
            for symbol, info in all_tickers.items():
                if len(results) >= limit:
                    break
                    
                # Skip if already added
                if any(r['symbol'] == symbol for r in results):
                    continue
                    
                # Check if query matches symbol or name
                if (query in symbol or 
                    symbol.startswith(query) or 
                    query in info['name'].upper()):
                    results.append({
                        'symbol': symbol,
                        'name': info['name'],
                        'type': info['type']
                    })
            
            # Sort results by relevance (exact matches first, then by symbol length)
            def sort_key(item):
                symbol = item['symbol']
                if symbol == query:
                    return (0, len(symbol))  # Exact match, shortest first
                elif symbol.startswith(query):
                    return (1, len(symbol))  # Starts with query, shortest first
                else:
                    return (2, len(symbol))  # Contains query, shortest first
            
            results.sort(key=sort_key)
            results = results[:limit]
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
            
        except Exception as e:
            print(f"Search error: {e}")
            # Send error response
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {'error': f'Search failed: {str(e)}'}
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
