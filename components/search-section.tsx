"use client"

import { useState, useEffect, useCallback } from "react"
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

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
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
          setSearchResults(results)
          setShowResults(true)
        }
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setSearchLoading(false)
      }
    }, 2000),
    [],
  )

  useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery, debouncedSearch])

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
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tickers (e.g., AAPL, TSLA, SPY)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchLoading && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-gray-400" />}
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

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
