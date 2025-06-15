"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PricesTable } from "@/components/prices-table"
import { NewsResearchPanel } from "@/components/news-research-panel"
import { ChartsTab } from "@/components/charts-tab"
import type { TickerData, NewsItem, ResearchItem } from "@/types"

interface DataTabsProps {
  ticker: TickerData
  dateRange: { start: string; end: string } | null
  pricesData: any[]
  newsData: NewsItem[]
  researchData: ResearchItem[]
  loading: boolean
  period?: string
}

export function DataTabs({ ticker, dateRange, pricesData, newsData, researchData, loading, period }: DataTabsProps) {
  return (
    <Tabs defaultValue="prices" className="w-full">
      {/* First Row of Tabs */}
      <TabsList className="grid w-full grid-cols-2 mb-2">
        <TabsTrigger value="prices">Prices</TabsTrigger>
        <TabsTrigger value="news-research">News & Research</TabsTrigger>
      </TabsList>

      {/* Second Row of Tabs */}
      <TabsList className="grid w-full grid-cols-1 mb-4">
        <TabsTrigger value="charts">Charts & Technical Analysis</TabsTrigger>
      </TabsList>

      <TabsContent value="prices" className="mt-4">
        <PricesTable ticker={ticker} dateRange={dateRange} data={pricesData} loading={loading} period={period} />
      </TabsContent>

      <TabsContent value="news-research" className="mt-4">
        <NewsResearchPanel ticker={ticker} newsData={newsData} researchData={researchData} loading={loading} />
      </TabsContent>

      <TabsContent value="charts" className="mt-4">
        <ChartsTab ticker={ticker} pricesData={pricesData} loading={loading} period={period} />
      </TabsContent>
    </Tabs>
  )
}
