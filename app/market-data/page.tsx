"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SearchSection } from "@/components/search-section"
import { DataTabs } from "@/components/data-tabs"
import { QueryHistory } from "@/components/query-history"
import { Disclaimer } from "@/components/disclaimer"
import { Button } from "@/components/ui/button"
import { TrendingUp, ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { TickerData, NewsItem, ResearchItem } from "@/types"

export default function MarketDataPage() {
  const router = useRouter()
  const [selectedTicker, setSelectedTicker] = useState<TickerData | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState("1mo")
  const [pricesData, setPricesData] = useState<any[]>([])
  const [newsData, setNewsData] = useState<NewsItem[]>([])
  const [researchData, setResearchData] = useState<ResearchItem[]>([])
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <h1 className="text-4xl font-bold text-gray-900">Market Data Downloader</h1>
            <Button
              onClick={() => router.push("/event-analysis")}
              variant="default"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <TrendingUp className="h-4 w-4" />
              Event Analysis
            </Button>
          </div>
          <p className="text-lg text-gray-600">Search, preview and save market data to GitHub</p>
        </header>

        <div className="max-w-6xl mx-auto space-y-6">
          <SearchSection
            selectedTicker={selectedTicker}
            setSelectedTicker={setSelectedTicker}
            dateRange={dateRange}
            setDateRange={setDateRange}
            setPricesData={setPricesData}
            setNewsData={setNewsData}
            setResearchData={setResearchData}
            loading={loading}
            setLoading={setLoading}
          />

          {selectedTicker && (
            <DataTabs
              ticker={selectedTicker}
              dateRange={dateRange}
              pricesData={pricesData}
              newsData={newsData}
              researchData={researchData}
              loading={loading}
              period={selectedPeriod}
            />
          )}

          <QueryHistory
            onSelectQuery={(ticker, range) => {
              setSelectedTicker(ticker)
              setDateRange(range)
            }}
          />

          <Disclaimer />
        </div>
      </div>
    </div>
  )
}
