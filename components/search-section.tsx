"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, Loader2, X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { saveQueryToHistory, saveRecentTicker, getRecentTickers, clearRecentTickers } from "@/lib/storage"
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

const PERIOD_OPTIONS = [
  { label: "1 Month", value: "1mo", description: "Last 1 month" },
  { label: "2 Months", value: "2mo", description: "Last 2 months" },
  { label: "3 Months", value: "3mo", description: "Last 3 months" },
  { label: "6 Months", value: "6mo", description: "Last 6 months" },
  { label: "1 Year", value: "1y", description: "Last 1 year" },
  { label: "2 Years", value: "2y", description: "Last 2 years" },
  { label: "5 Years", value: "5y", description: "Last 5 years" },
  { label: "10 Years", value: "10y", description: "Last 10 years" },
  { label: "Max", value: "max", description: "All available data" },
]

// Popular tickers for quick selection (including S&P 500)
const POPULAR_TICKERS: TickerData[] = [
  { symbol: "^GSPC", name: "S&P 500 Index", type: "Index" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "ETF" },
  { symbol: "AAPL", name: "Apple Inc.", type: "Equity" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "Equity" },
  { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity" },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Equity" },
  { symbol: "TSLA", name: "Tesla Inc.", type: "Equity" },
  { symbol: "META", name: "Meta Platforms Inc.", type: "Equity" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "Equity" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
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
  const [manualTicker, setManualTicker] = useState("")
  const [searchResults, setSearchResults] = useState<TickerData[]>([])
  const [showResults, setShowResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState("1mo")
  const [recentTickers, setRecentTickers] = useState<TickerData[]>([])
  const { toast } = useToast()

  // Load recent tickers on component mount
  useEffect(() => {
    setRecentTickers(getRecentTickers())
  }, [])

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

  const handleManualKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleManualDownload()
    }
  }

  const handleTickerSelect = (ticker: TickerData) => {
    setSelectedTicker(ticker)
    setSearchQuery(ticker.symbol)
    setManualTicker("") // Clear manual input when selecting from search
    setShowResults(false)

    // Save to recent tickers and update state
    saveRecentTicker(ticker)
    setRecentTickers(getRecentTickers())
  }

  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period)
    // Set a dummy date range for compatibility with existing code
    const now = new Date()
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    setDateRange({
      start: start.toISOString().split("T")[0],
      end: now.toISOString().split("T")[0],
    })
  }

  const handleClearRecentTickers = () => {
    clearRecentTickers()
    setRecentTickers([])
  }

  const handleManualDownload = async () => {
    if (!manualTicker.trim() || !selectedPeriod) {
      toast({
        title: "Missing Information",
        description: "Please enter a ticker symbol and select a time period",
        variant: "destructive",
      })
      return
    }

    const tickerSymbol = manualTicker.trim().toUpperCase()

    // Create a temporary ticker object for manual input
    const manualTickerData: TickerData = {
      symbol: tickerSymbol,
      name: `${tickerSymbol} (Manual Entry)`,
      type: "Manual",
    }

    setSelectedTicker(manualTickerData)
    setSearchQuery("") // Clear search when using manual input

    // Save to recent tickers
    saveRecentTicker(manualTickerData)
    setRecentTickers(getRecentTickers())

    await downloadData(manualTickerData)
  }

  const handleDownload = async () => {
    if (!selectedTicker || !selectedPeriod) return
    await downloadData(selectedTicker)
  }

  const downloadData = async (ticker: TickerData) => {
    setLoading(true)
    try {
      // Save query to history with period info
      const dummyRange = { start: `${selectedPeriod} ago`, end: "today" }
      saveQueryToHistory(ticker, dummyRange)

      // Download prices using period (with extra month for technical indicators)
      const pricesResponse = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickers: [ticker.symbol],
          period: selectedPeriod,
          extraData: true, // Request extra data for technical indicators
        }),
      })

      if (pricesResponse.ok) {
        const pricesResult = await pricesResponse.json()
        console.log("Price data received:", pricesResult)
        setPricesData(pricesResult.data || [])

        if (pricesResult.source) {
          toast({
            title: "Data Downloaded",
            description: `Successfully downloaded ${pricesResult.rows || 0} data points for ${ticker.symbol} from ${pricesResult.source}`,
          })
        }
      } else {
        const errorData = await pricesResponse.json()
        console.error("Download error:", errorData)
        throw new Error(errorData.error || "Failed to download prices")
      }

      // Fetch news and research
      const docsResponse = await fetch("/api/fetch_docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.symbol,
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
        description: error instanceof Error ? error.message : "Failed to download data. Please try again.",
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
                  placeholder="Search ticker symbols (e.g., AAPL, TSLA, SPY)"
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

          {/* Manual Ticker Input Section */}
          <div className="border-t pt-4">
            <div className="mb-2">
              <span className="text-sm font-medium text-gray-700">Or enter ticker manually:</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Download className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Enter any ticker (e.g., ^TNX, CL=F, GC=F, EURUSD=X)"
                  value={manualTicker}
                  onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
                  onKeyPress={handleManualKeyPress}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleManualDownload}
                disabled={loading || !manualTicker.trim() || !selectedPeriod}
                variant="secondary"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Download"}
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Works with any symbol: stocks, indices (^TNX), futures (CL=F), forex (EURUSD=X), crypto (BTC-USD)
            </div>
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

          {/* Recent Tickers */}
          {recentTickers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Recent searches:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearRecentTickers}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentTickers.map((ticker) => (
                  <Button
                    key={ticker.symbol}
                    variant="outline"
                    size="sm"
                    onClick={() => handleTickerSelect(ticker)}
                    className="text-xs bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    {ticker.symbol}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Period Selection */}
          <div>
            <span className="text-sm font-medium text-gray-700 mb-2 block">Select time period:</span>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {PERIOD_OPTIONS.map((period) => (
                <Button
                  key={period.value}
                  variant={selectedPeriod === period.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePeriodSelect(period.value)}
                  className="text-xs"
                  title={period.description}
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Main Download Button (for search results) */}
          {selectedTicker && !manualTicker && (
            <div className="flex justify-center">
              <Button
                onClick={handleDownload}
                disabled={!selectedTicker || !selectedPeriod || loading}
                className="w-full md:w-auto px-8"
                size="lg"
              >
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
          )}

          {/* Selected Ticker Display */}
          {selectedTicker && (
            <div className="p-3 bg-blue-50 rounded-md">
              <div className="font-medium text-blue-900">{selectedTicker.symbol}</div>
              <div className="text-sm text-blue-700">{selectedTicker.name}</div>
              {selectedPeriod && (
                <div className="text-xs text-blue-600 mt-1">
                  Period: {PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.description}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
