"use client"

import type React from "react"

import { useState } from "react"
import { Search, Calendar, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { formatDateForAPI, formatDateForDisplay, getQuickRangeDate } from "@/lib/date-utils"
import { saveQueryToHistory } from "@/lib/storage"
import type { TickerData } from "@/types"

interface SearchSectionProps {
  selectedTicker: TickerData | null
  setSelectedTicker: (ticker: TickerData | null) => void
  dateRange: { start: string; end: string } | null
  setDateRange: (range: { start: string; end: string } | null) => void
  setPricesData: (data: any[]) => void
  setNewsData: (data: any[]) => void
  setResearchData: (data: any[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void
}

const QUICK_RANGES = [
  { label: "1m", months: 1 },
  { label: "2m", months: 2 },
  { label: "3m", months: 3 },
  { label: "6m", months: 6 },
  { label: "12m", months: 12 },
  { label: "24m", months: 24 },
  { label: "60m", months: 60 },
]

// Popular tickers for quick selection
const POPULAR_TICKERS: TickerData[] = [
  { symbol: "AAPL", name: "Apple Inc.", type: "Equity" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "Equity" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Equity" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Equity" },
  { symbol: "META", name: "Meta Platforms Inc.", type: "Equity" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "Equity" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
  { symbol: "BTC-USD", name: "Bitcoin USD", type: "Cryptocurrency" },
]

export function SearchSection({
  selectedTicker,
  setSelectedTicker,
  dateRange,
  setDateRange,
  setPricesData,
  setNewsData,
  setResearchData,
  loading,
  setLoading,
}: SearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<TickerData[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const { toast } = useToast()

  // Simple search function without debouncing
  const performSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, limit: 10 }),
      })

      if (response.ok) {
        const results = await response.json()
        if (Array.isArray(results)) {
          setSearchResults(results)
          setShowResults(true)
        } else {
          setSearchResults([])
          setShowResults(false)
        }
      } else {
        const errorData = await response.json()
        toast({
          title: "Search Error",
          description: errorData.error || "Failed to search tickers",
          variant: "destructive",
        })
        setSearchResults([])
        setShowResults(false)
      }
    } catch (error) {
      console.error("Search error:", error)
      toast({
        title: "Search Error",
        description: "Failed to search tickers",
        variant: "destructive",
      })
      setSearchResults([])
      setShowResults(false)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleSearchClick = () => {
    performSearch(searchQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      performSearch(searchQuery)
    }
  }

  const handleTickerSelect = (ticker: TickerData) => {
    setSelectedTicker(ticker)
    setSearchQuery(ticker.symbol)
    setShowResults(false)
  }

  const handleQuickRange = (months: number) => {
    const { start, end } = getQuickRangeDate(months)
    setStartDate(formatDateForDisplay(start))
    setEndDate(formatDateForDisplay(end))
    setDateRange({ start: formatDateForAPI(start), end: formatDateForAPI(end) })
  }

  const handleDateChange = () => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      setDateRange({
        start: formatDateForAPI(start),
        end: formatDateForAPI(end),
      })
    }
  }

  const handleDownload = async () => {
    if (!selectedTicker || !dateRange) return

    setLoading(true)
    try {
      // Save query to history
      saveQueryToHistory(selectedTicker, dateRange)

      // Download prices
      const pricesResponse = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: [selectedTicker.symbol],
          start: dateRange.start,
          end: dateRange.end,
        }),
      })

      if (pricesResponse.ok) {
        const pricesResult = await pricesResponse.json()
        setPricesData(pricesResult.data || [])
      }

      // Fetch news and research
      const docsResponse = await fetch("/api/fetch_docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker.symbol,
        }),
      })

      if (docsResponse.ok) {
        const docsResult = await docsResponse.json()
        setNewsData(docsResult.news || [])
        setResearchData(docsResult.research || [])
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Search Section */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Enter ticker symbol (e.g., AAPL, TSLA, SPY)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearchClick} disabled={searchLoading || !searchQuery}>
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {/* Search Results */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((ticker) => (
                  <button
                    key={ticker.symbol}
                    onClick={() => handleTickerSelect(ticker)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{ticker.symbol}</div>
                    <div className="text-sm text-gray-600">{ticker.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Popular Tickers */}
          <div>
            <span className="text-sm font-medium text-gray-700 mb-2 block">Popular tickers:</span>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TICKERS.map((ticker) => (
                <Button
                  key={ticker.symbol}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTickerSelect(ticker)}
                  className="text-xs"
                >
                  {ticker.symbol}
                </Button>
              ))}
            </div>
          </div>

          {/* Quick Range Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium text-gray-700 self-center mr-2">Quick ranges:</span>
            {QUICK_RANGES.map((range) => (
              <Button key={range.label} variant="outline" size="sm" onClick={() => handleQuickRange(range.months)}>
                {range.label}
              </Button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onBlur={handleDateChange}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onBlur={handleDateChange}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleDownload} disabled={!selectedTicker || !dateRange || loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                "Download Data"
              )}
            </Button>
          </div>

          {/* Selected Ticker Display */}
          {selectedTicker && (
            <div className="p-3 bg-blue-50 rounded-md">
              <div className="font-medium text-blue-900">{selectedTicker.symbol}</div>
              <div className="text-sm text-blue-700">{selectedTicker.name}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
