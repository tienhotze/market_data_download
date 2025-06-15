"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, Trash2 } from "lucide-react"
import { getQueryHistory, clearQueryHistory } from "@/lib/storage"
import type { TickerData, QueryHistoryItem } from "@/types"

interface QueryHistoryProps {
  onSelectQuery: (ticker: TickerData, dateRange: { start: string; end: string }) => void
}

export function QueryHistory({ onSelectQuery }: QueryHistoryProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])

  useEffect(() => {
    setHistory(getQueryHistory())
  }, [])

  const handleClearHistory = () => {
    clearQueryHistory()
    setHistory([])
  }

  if (history.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Queries
        </CardTitle>
        <Button variant="outline" size="sm" onClick={handleClearHistory} className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {history.map((item, index) => (
            <button
              key={index}
              onClick={() => onSelectQuery(item.ticker, item.dateRange)}
              className="p-3 text-left border rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium text-sm">{item.ticker.symbol}</div>
              <div className="text-xs text-gray-600 mt-1">{item.ticker.name}</div>
              <div className="text-xs text-gray-500 mt-1">
                {item.dateRange.start} to {item.dateRange.end}
              </div>
              <div className="text-xs text-gray-400 mt-1">{new Date(item.timestamp).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
