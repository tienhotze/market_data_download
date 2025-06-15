"use client"

import { useState } from "react"
import { SearchSection } from "@/components/search-section"
import { DataTabs } from "@/components/data-tabs"
import { QueryHistory } from "@/components/query-history"
import { Disclaimer } from "@/components/disclaimer"
import type { TickerData, NewsItem, ResearchItem } from "@/types"

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState<TickerData | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null)
  const [pricesData, setPricesData] = useState<any[]>([])
  const [newsData, setNewsData] = useState<NewsItem[]>([])
  const [researchData, setResearchData] = useState<ResearchItem[]>([])
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Market Data Downloader</h1>
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

          {selectedTicker && dateRange && (
            <DataTabs
              ticker={selectedTicker}
              dateRange={dateRange}
              pricesData={pricesData}
              newsData={newsData}
              researchData={researchData}
              loading={loading}
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
