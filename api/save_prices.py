import json
import os
import io
import datetime as dt
from github import Github
from http.server import BaseHTTPRequestHandler
import time

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            ticker = data.get('ticker', '').strip()
            price_data = data.get('data', [])
            date_range = data.get('dateRange', {})
            
            if not ticker or not price_data:
                raise ValueError("Ticker and data are required")
            
            # Get GitHub token
            github_token = os.environ.get('GITHUB_TOKEN')
            if not github_token:
                raise ValueError("GitHub token not configured")
            
            # Initialize GitHub client with retry logic
            max_retries = 3
            retry_delay = 5
            
            for attempt in range(max_retries):
                try:
                    gh = Github(github_token)
                    repo = gh.get_repo("org/market-data")
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        raise e
            
            # Create CSV content
            csv_content = "Date,Open,High,Low,Close,Adj Close,Volume\n"
            for row in price_data:
                csv_content += f"{row.get('Date', '')},{row.get('Open', '')},{row.get('High', '')},{row.get('Low', '')},{row.get('Close', '')},{row.get('Adj Close', '')},{row.get('Volume', '')}\n"
            
            # Create file path
            end_date = date_range.get('end', dt.date.today().isoformat())
            file_path = f"data/{ticker}/{end_date}.csv"
            commit_message = f"feat: {ticker} prices to {end_date}"
            
            # Create or update file
            try:
                # Try to get existing file
                existing_file = repo.get_contents(file_path)
                commit = repo.update_file(
                    file_path,
                    commit_message,
                    csv_content,
                    existing_file.sha
                )
            except:
                # File doesn't exist, create new
                commit = repo.create_file(
                    file_path,
                    commit_message,
                    csv_content
                )
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            response = {
                'sha': commit['commit'].sha,
                'githubUrl': f"https://github.com/org/market-data/blob/main/{file_path}",
                'path': file_path
            }
            
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            # Send error response
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {'error': f'Failed to save prices: {str(e)}'}
            self.wfile.write(json.dumps(error_response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
