"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PricesTable } from "@/components/prices-table"
import { NewsResearchPanel } from "@/components/news-research-panel"
import type { TickerData, NewsItem, ResearchItem } from "@/types"

interface DataTabsProps {
  ticker: TickerData
  dateRange: { start: string; end: string }
  pricesData: any[]
  newsData: NewsItem[]
  researchData: ResearchItem[]
  loading: boolean
}

export function DataTabs({ ticker, dateRange, pricesData, newsData, researchData, loading }: DataTabsProps) {
  return (
    <Tabs defaultValue="prices" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="prices">Prices</TabsTrigger>
        <TabsTrigger value="news-research">News & Research</TabsTrigger>
      </TabsList>

      <TabsContent value="prices" className="mt-4">
        <PricesTable ticker={ticker} dateRange={dateRange} data={pricesData} loading={loading} />
      </TabsContent>

      <TabsContent value="news-research" className="mt-4">
        <NewsResearchPanel ticker={ticker} newsData={newsData} researchData={researchData} loading={loading} />
      </TabsContent>
    </Tabs>
  )
}
