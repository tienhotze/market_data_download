import type { TickerData, QueryHistoryItem } from "@/types"

const STORAGE_KEY = "market-data-query-history"
const RECENT_TICKERS_KEY = "market-data-recent-tickers"
const MAX_HISTORY_ITEMS = 10
const MAX_RECENT_TICKERS = 15

export function saveQueryToHistory(ticker: TickerData, dateRange: { start: string; end: string }): void {
  if (typeof window === "undefined") return

  const history = getQueryHistory()

  // Remove duplicate if exists
  const filteredHistory = history.filter(
    (item) =>
      item.ticker.symbol !== ticker.symbol ||
      item.dateRange.start !== dateRange.start ||
      item.dateRange.end !== dateRange.end,
  )

  // Add new item at the beginning
  const newItem: QueryHistoryItem = {
    ticker,
    dateRange,
    timestamp: new Date().toISOString(),
  }

  const updatedHistory = [newItem, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory))

  // Also save to recent tickers
  saveRecentTicker(ticker)
}

export function saveRecentTicker(ticker: TickerData): void {
  if (typeof window === "undefined") return

  try {
    const recentTickers = getRecentTickers()

    // Remove if already exists
    const filteredTickers = recentTickers.filter((t) => t.symbol !== ticker.symbol)

    // Add to beginning
    const updatedTickers = [ticker, ...filteredTickers].slice(0, MAX_RECENT_TICKERS)

    localStorage.setItem(RECENT_TICKERS_KEY, JSON.stringify(updatedTickers))
  } catch (error) {
    console.error("Error saving recent ticker:", error)
  }
}

export function getRecentTickers(): TickerData[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(RECENT_TICKERS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Error reading recent tickers:", error)
    return []
  }
}

export function getQueryHistory(): QueryHistoryItem[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Error reading query history:", error)
    return []
  }
}

export function clearQueryHistory(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

export function clearRecentTickers(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RECENT_TICKERS_KEY)
}
