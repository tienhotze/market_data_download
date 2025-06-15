export interface TickerData {
  symbol: string
  name: string
  type: string
}

export interface PriceData {
  Date: string
  Open: number
  High: number
  Low: number
  Close: number
  "Adj Close": number
  Volume: number
}

export interface NewsItem {
  id: string
  title: string
  publisher: string
  publishedAt: string
  url: string
  summary: string
}

export interface ResearchItem {
  id: string
  title: string
  publisher: string
  publishedAt: string
  url: string
  summary: string
}

export interface QueryHistoryItem {
  ticker: TickerData
  dateRange: { start: string; end: string }
  timestamp: string
}

export interface GitHubCommitResponse {
  sha: string
  githubUrl: string
}
