import type { TickerData, QueryHistoryItem } from "@/types"

const STORAGE_KEY = "market-data-query-history"
const MAX_HISTORY_ITEMS = 10

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
