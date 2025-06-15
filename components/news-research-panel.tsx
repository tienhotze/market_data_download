"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronRight, Download, ExternalLink, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TickerData, NewsItem, ResearchItem } from "@/types"

interface NewsResearchPanelProps {
  ticker: TickerData
  newsData: NewsItem[]
  researchData: ResearchItem[]
  loading: boolean
}

export function NewsResearchPanel({ ticker, newsData, researchData, loading }: NewsResearchPanelProps) {
  const [expandedNews, setExpandedNews] = useState<Set<string>>(new Set())
  const [expandedResearch, setExpandedResearch] = useState<Set<string>>(new Set())
  const [savingNews, setSavingNews] = useState(false)
  const [savingResearch, setSavingResearch] = useState(false)
  const { toast } = useToast()

  const toggleNewsExpanded = (id: string) => {
    const newExpanded = new Set(expandedNews)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedNews(newExpanded)
  }

  const toggleResearchExpanded = (id: string) => {
    const newExpanded = new Set(expandedResearch)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedResearch(newExpanded)
  }

  const handleSaveNews = async () => {
    setSavingNews(true)
    try {
      const response = await fetch("/api/save_docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.symbol,
          type: "news",
          items: newsData,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success!",
          description: (
            <div>
              <p>News saved to GitHub</p>
              <p className="text-xs text-gray-600 mt-1">SHA: {result.sha}</p>
              <a
                href={result.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                View commit →
              </a>
            </div>
          ),
        })
      } else {
        throw new Error("Failed to save news")
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save news to GitHub. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingNews(false)
    }
  }

  const handleSaveResearch = async () => {
    setSavingResearch(true)
    try {
      const response = await fetch("/api/save_docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.symbol,
          type: "research",
          items: researchData,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success!",
          description: (
            <div>
              <p>Research saved to GitHub</p>
              <p className="text-xs text-gray-600 mt-1">SHA: {result.sha}</p>
              <a
                href={result.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                View commit →
              </a>
            </div>
          ),
        })
      } else {
        throw new Error("Failed to save research")
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save research to GitHub. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingResearch(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading news and research...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* News Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>News - {ticker.symbol}</CardTitle>
          <Button
            onClick={handleSaveNews}
            disabled={newsData.length === 0 || savingNews}
            className="flex items-center gap-2"
          >
            {savingNews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Save JSON
          </Button>
        </CardHeader>
        <CardContent>
          {newsData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No news data available.</div>
          ) : (
            <div className="space-y-2">
              {newsData.map((item) => (
                <Collapsible key={item.id}>
                  <CollapsibleTrigger
                    onClick={() => toggleNewsExpanded(item.id)}
                    className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 rounded-md border"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.publisher} • {new Date(item.publishedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {expandedNews.has(item.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3">
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-700 mb-2">{item.summary}</p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:underline text-xs"
                      >
                        Read full article
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Research Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Research - {ticker.symbol}</CardTitle>
          <Button
            onClick={handleSaveResearch}
            disabled={researchData.length === 0 || savingResearch}
            className="flex items-center gap-2"
          >
            {savingResearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Save JSON
          </Button>
        </CardHeader>
        <CardContent>
          {researchData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No research data available.</div>
          ) : (
            <div className="space-y-2">
              {researchData.map((item) => (
                <Collapsible key={item.id}>
                  <CollapsibleTrigger
                    onClick={() => toggleResearchExpanded(item.id)}
                    className="flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 rounded-md border"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.publisher} • {new Date(item.publishedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {expandedResearch.has(item.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3">
                    <div className="pt-2 border-t">
                      <p className="text-sm text-gray-700 mb-2">{item.summary}</p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:underline text-xs"
                      >
                        Read full report
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
