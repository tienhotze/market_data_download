import json
import yfinance as yf
from http.server import BaseHTTPRequestHandler
import time

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            ticker_symbol = data.get('ticker', '').strip()
            
            if not ticker_symbol:
                raise ValueError("Ticker symbol is required")
            
            # Get ticker object with retry logic
            ticker = None
            max_retries = 3
            retry_delay = 5
            
            for attempt in range(max_retries):
                try:
                    ticker = yf.Ticker(ticker_symbol)
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        raise e
            
            news_data = []
            research_data = []
            
            # Fetch news
            try:
                news = ticker.news
                for item in news[:10]:  # Limit to 10 items
                    news_data.append({
                        'id': item.get('uuid', f"news_{len(news_data)}"),
                        'title': item.get('title', ''),
                        'publisher': item.get('publisher', ''),
                        'publishedAt': item.get('providerPublishTime', ''),
                        'url': item.get('link', ''),
                        'summary': item.get('summary', '')
                    })
            except Exception as e:
                print(f"Error fetching news: {e}")
            
            # Fetch research (analyst recommendations)
            try:
                recommendations = ticker.recommendations
                if recommendations is not None and not recommendations.empty:
                    for _, row in recommendations.tail(10).iterrows():  # Last 10 recommendations
                        research_data.append({
                            'id': f"research_{len(research_data)}",
                            'title': f"{row.get('Firm', 'Unknown')} - {row.get('To Grade', 'N/A')}",
                            'publisher': row.get('Firm', 'Unknown'),
                            'publishedAt': str(row.name) if row.name else '',
                            'url': '',
                            'summary': f"Grade: {row.get('To Grade', 'N/A')}, Previous: {row.get('From Grade', 'N/A')}"
                        })
            except Exception as e:
                print(f"Error fetching research: {e}")
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'news': news_data,
                'research': research_data,
                'ticker': ticker_symbol
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            # Send error response
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {'error': f'Failed to fetch docs: {str(e)}'}
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
