"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import type { EventData } from "@/types"

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

interface MultiEventChartProps {
  events: EventData[]
}

interface EventAssetData {
  eventId: string
  eventName: string
  eventDate: string
  reindexedData: number[] // 121 days from -30 to +90
}

interface MultiEventData {
  dayLabels: string[] // ["-30d", "-29d", ..., "0d", ..., "+60d"]
  eventData: EventAssetData[]
  averageData: number[]
  medianData: number[]
}

interface DataCache {
  data: Record<string, any>
  lastDownload: number
  selectedAsset: string
  selectedEvents: string[]
}

const AVAILABLE_ASSETS = [
  { id: "S&P 500", name: "S&P 500", ticker: "^GSPC" },
  { id: "WTI Crude Oil", name: "WTI Crude Oil", ticker: "CL=F" },
  { id: "Gold", name: "Gold", ticker: "GC=F" },
  { id: "Dollar Index", name: "Dollar Index", ticker: "DX-Y.NYB" },
  { id: "10Y Treasury Yield", name: "10Y Treasury Yield", ticker: "^TNX" },
  { id: "VIX", name: "VIX", ticker: "^VIX" },
]

const EVENT_COLORS = [
  "#2563eb",
  "#dc2626",
  "#f59e0b",
  "#059669",
  "#7c3aed",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#8b5cf6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#6366f1",
]

// Cache for storing downloaded data
let multiEventDataCache: DataCache | null = null

export function MultiEventChart({ events }: MultiEventChartProps) {
  const [selectedAsset, setSelectedAsset] = useState("S&P 500")
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [multiEventData, setMultiEventData] = useState<MultiEventData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>("")

  // Generate day labels from -30 to +60
  const generateDayLabels = (): string[] => {
    const labels: string[] = []
    for (let i = -30; i <= 90; i++) {
      if (i === 0) {
        labels.push("0d")
      } else {
        labels.push(`${i > 0 ? "+" : ""}${i}d`)
      }
    }
    return labels
  }

  const shouldRefreshData = (): boolean => {
    if (!multiEventDataCache) {
      return true // No cache
    }

    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const cacheExpired = now - multiEventDataCache.lastDownload > oneHour

    // Check if selection changed
    const eventsArray = Array.from(selectedEvents).sort()
    const cachedEventsArray = multiEventDataCache.selectedEvents.sort()
    const selectionChanged =
      selectedAsset !== multiEventDataCache.selectedAsset ||
      JSON.stringify(eventsArray) !== JSON.stringify(cachedEventsArray)

    return cacheExpired || selectionChanged
  }

  const fetchMultiEventData = async (forceUpdate = false) => {
    if (selectedEvents.size === 0) {
      setMultiEventData(null)
      return
    }

    // Check if we can use cached data
    if (!forceUpdate && !shouldRefreshData()) {
      console.log("Using cached multi-event data")
      setMultiEventData(multiEventDataCache!.data)
      setLastUpdate(new Date(multiEventDataCache!.lastDownload).toLocaleTimeString())
      return
    }

    setLoading(true)
    setError(null)

    try {
      const eventDataPromises = Array.from(selectedEvents).map(async (eventId) => {
        const event = events.find((e) => e.id === eventId)
        if (!event) return null

        const response = await fetch("/api/event-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventDate: event.date,
            incrementalUpdate: !forceUpdate && multiEventDataCache !== null,
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${event.name}`)
        }

        const data = await response.json()
        const assetData = data.assets[selectedAsset]

        if (!assetData) {
          throw new Error(`No data available for ${selectedAsset} in ${event.name}`)
        }

        // Generate comprehensive data for this event (-30 to +60 days)
        const eventDate = new Date(event.date)
        const reindexedData: number[] = []

        for (let i = -30; i <= 90; i++) {
          const targetDate = new Date(eventDate)
          targetDate.setDate(eventDate.getDate() + i)
          const targetDateStr = targetDate.toISOString().split("T")[0]

          // Find data for this date
          const dataIndex = assetData.dates.findIndex((d: string) => d === targetDateStr)
          if (dataIndex !== -1) {
            reindexedData.push(assetData.reindexed[dataIndex])
          } else {
            // Use forward fill logic - find closest previous date
            let lastKnownValue = 100 // Default baseline
            for (let j = dataIndex >= 0 ? dataIndex - 1 : assetData.dates.length - 1; j >= 0; j--) {
              const checkDate = new Date(assetData.dates[j])
              if (checkDate <= targetDate) {
                lastKnownValue = assetData.reindexed[j]
                break
              }
            }
            reindexedData.push(lastKnownValue)
          }
        }

        return {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.date,
          reindexedData,
        }
      })

      const eventDataResults = await Promise.all(eventDataPromises)
      const validEventData = eventDataResults.filter((data): data is EventAssetData => data !== null)

      if (validEventData.length === 0) {
        throw new Error("No valid event data found")
      }

      // Calculate average and median for each day
      const dayLabels = generateDayLabels()
      const averageData: number[] = []
      const medianData: number[] = []

      for (let dayIndex = 0; dayIndex < 121; dayIndex++) {
        const dayValues = validEventData.map((event) => event.reindexedData[dayIndex]).filter((val) => !isNaN(val))

        if (dayValues.length > 0) {
          // Calculate average
          const average = dayValues.reduce((sum, val) => sum + val, 0) / dayValues.length
          averageData.push(average)

          // Calculate median
          const sortedValues = [...dayValues].sort((a, b) => a - b)
          const median =
            sortedValues.length % 2 === 0
              ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
              : sortedValues[Math.floor(sortedValues.length / 2)]
          medianData.push(median)
        } else {
          averageData.push(100)
          medianData.push(100)
        }
      }

      const resultData = {
        dayLabels,
        eventData: validEventData,
        averageData,
        medianData,
      }

      // Update cache
      const now = Date.now()
      multiEventDataCache = {
        data: resultData,
        lastDownload: now,
        selectedAsset,
        selectedEvents: Array.from(selectedEvents),
      }

      setMultiEventData(resultData)
      setLastUpdate(new Date(now).toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch multi-event data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMultiEventData()
  }, [selectedEvents, selectedAsset])

  const handleUpdate = () => {
    fetchMultiEventData(true)
  }

  const handleEventToggle = (eventId: string, checked: boolean) => {
    const newSelected = new Set(selectedEvents)
    if (checked) {
      newSelected.add(eventId)
    } else {
      newSelected.delete(eventId)
    }
    setSelectedEvents(newSelected)
  }

  const handleSelectAll = () => {
    setSelectedEvents(new Set(events.map((e) => e.id)))
  }

  const handleClearAll = () => {
    setSelectedEvents(new Set())
  }

  const handleSubgroupToggle = (subgroupEvents: EventData[], checked: boolean) => {
    const newSelected = new Set(selectedEvents)
    subgroupEvents.forEach((event) => {
      if (checked) {
        newSelected.add(event.id)
      } else {
        newSelected.delete(event.id)
      }
    })
    setSelectedEvents(newSelected)
  }

  // Enhanced event grouping with subgroups
  const groupedEvents = events.reduce(
    (acc, event) => {
      const category = event.category
      let subgroup = "Other"

      // Define subgroups based on event names and categories
      if (category === "Geopolitical") {
        if (
          event.name.includes("Operation") ||
          event.name.includes("War") ||
          event.name.includes("Attack") ||
          event.name.includes("Strike")
        ) {
          subgroup = "Military Operations"
        } else if (event.name.includes("Iran") || event.name.includes("Hezbollah") || event.name.includes("Hamas")) {
          subgroup = "Middle East Conflicts"
        } else {
          subgroup = "Other Geopolitical"
        }
      } else if (category === "Fed") {
        subgroup = "Federal Reserve Policy"
      } else if (category === "Financial Crisis" || category === "Banking") {
        subgroup = "Financial System"
      } else if (category === "Pandemic") {
        subgroup = "Health Crisis"
      } else {
        subgroup = category
      }

      if (!acc[category]) {
        acc[category] = {}
      }
      if (!acc[category][subgroup]) {
        acc[category][subgroup] = []
      }
      acc[category][subgroup].push(event)
      return acc
    },
    {} as Record<string, Record<string, EventData[]>>,
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Multi-Event Comparison</span>
            <div className="flex items-center gap-2">
              {lastUpdate && <span className="text-sm text-gray-500">Last updated: {lastUpdate}</span>}
              <Button onClick={handleUpdate} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Update
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Compare market impact across multiple events for a single asset. Select events and asset to analyze.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Asset Selection */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Asset:</label>
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ASSETS.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Select Events ({selectedEvents.size} selected):</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {Object.entries(groupedEvents).map(([category, subgroups]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-800 bg-gray-200 px-3 py-2 rounded">{category}</h3>
                  {Object.entries(subgroups).map(([subgroup, subgroupEvents]) => {
                    const allSelected = subgroupEvents.every((event) => selectedEvents.has(event.id))
                    const someSelected = subgroupEvents.some((event) => selectedEvents.has(event.id))

                    return (
                      <div key={subgroup} className="space-y-2 ml-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`${category}-${subgroup}`}
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected
                            }}
                            onCheckedChange={(checked) => handleSubgroupToggle(subgroupEvents, checked as boolean)}
                          />
                          <label
                            htmlFor={`${category}-${subgroup}`}
                            className="text-sm font-semibold text-gray-700 cursor-pointer"
                          >
                            {subgroup} ({subgroupEvents.length})
                          </label>
                        </div>
                        {subgroupEvents
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((event) => (
                            <div key={event.id} className="flex items-start space-x-2 ml-6">
                              <Checkbox
                                id={event.id}
                                checked={selectedEvents.has(event.id)}
                                onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)}
                              />
                              <label htmlFor={event.id} className="text-sm cursor-pointer">
                                <div className="font-medium">{event.name}</div>
                                <div className="text-xs text-gray-500">{new Date(event.date).toLocaleDateString()}</div>
                              </label>
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading multi-event analysis data...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-red-600">
              <p className="font-semibold">Error loading data</p>
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {multiEventData && (
        <>
          {/* Multi-Event Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-Event Impact Comparison: {selectedAsset}</CardTitle>
              <CardDescription>
                Reindexed to 100 on each event start date. Showing {multiEventData.eventData.length} events with average
                trend line.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <Plot
                  data={[
                    // Individual event traces
                    ...multiEventData.eventData.map((eventData, index) => ({
                      x: multiEventData.dayLabels,
                      y: eventData.reindexedData,
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: eventData.eventName,
                      line: {
                        color: EVENT_COLORS[index % EVENT_COLORS.length],
                        width: 1,
                      },
                      opacity: 0.6,
                      hoverinfo: "skip" as const,
                    })),
                    // Average trace
                    {
                      x: multiEventData.dayLabels,
                      y: multiEventData.averageData,
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: "Average",
                      line: {
                        color: "#000000",
                        width: 3,
                      },
                      hoverinfo: "skip" as const,
                    },
                    // Event start line
                    {
                      x: ["0d", "0d"],
                      y: [80, 120],
                      type: "scatter" as const,
                      mode: "lines" as const,
                      name: "Start Date",
                      line: { color: "#dc2626", width: 2, dash: "dash" },
                      showlegend: false,
                      hoverinfo: "skip" as const,
                    },
                  ]}
                  layout={{
                    xaxis: {
                      title: "Days from Event Start",
                      type: "category",
                    },
                    yaxis: {
                      title: "Reindexed Value (Event Date = 100)",
                      range: [80, 120],
                    },
                    hovermode: "closest",
                    showlegend: true,
                    legend: {
                      orientation: "h",
                      y: 1.15,
                      x: 0.5,
                      xanchor: "center",
                      yanchor: "bottom",
                      font: { size: 10 },
                      bgcolor: "rgba(255,255,255,0.8)",
                      bordercolor: "#E5E7EB",
                      borderwidth: 1,
                    },
                    margin: { t: 120, b: 60, l: 60, r: 20 },
                    annotations: [
                      {
                        x: "0d",
                        y: 100,
                        text: "Start Date",
                        showarrow: true,
                        arrowhead: 2,
                        arrowcolor: "#dc2626",
                        bgcolor: "rgba(220, 38, 38, 0.1)",
                        bordercolor: "#dc2626",
                        borderwidth: 1,
                      },
                    ],
                  }}
                  config={{
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
                  }}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Multi-Event Data Table */}
          <Card>
            <CardHeader>
              <CardTitle>Multi-Event Data Table</CardTitle>
              <CardDescription>
                Reindexed values for {selectedAsset} across {multiEventData.eventData.length} events with statistical
                aggregations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto">
                <style jsx>{`
                  .frozen-table {
                    position: relative;
                  }
                  .frozen-table th:first-child,
                  .frozen-table td:first-child {
                    position: sticky;
                    left: 0;
                    background: white;
                    z-index: 10;
                    border-right: 1px solid #e5e7eb;
                  }
                  .frozen-table thead th {
                    position: sticky;
                    top: 0;
                    background: white;
                    z-index: 20;
                    border-bottom: 1px solid #e5e7eb;
                  }
                  .frozen-table th:first-child {
                    z-index: 30;
                  }
                `}</style>
                <Table className="frozen-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-16">Days</TableHead>
                      {multiEventData.eventData.map((eventData) => (
                        <TableHead key={eventData.eventId} className="text-center min-w-24">
                          {eventData.eventName}
                          <br />
                          <span className="text-xs text-gray-500">{eventData.eventDate}</span>
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-20 bg-blue-50">Average</TableHead>
                      <TableHead className="text-center min-w-20 bg-green-50">Median</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multiEventData.dayLabels.map((dayLabel, index) => {
                      const isStartDate = dayLabel === "0d"

                      return (
                        <TableRow key={dayLabel} className={isStartDate ? "bg-red-50" : ""}>
                          <TableCell className="font-medium">
                            <span className={isStartDate ? "font-bold text-red-600" : ""}>{dayLabel}</span>
                          </TableCell>

                          {/* Individual event values */}
                          {multiEventData.eventData.map((eventData) => {
                            const value = eventData.reindexedData[index]
                            const change = value - 100

                            return (
                              <TableCell key={eventData.eventId} className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <span>{value?.toFixed(2) || "N/A"}</span>
                                  {!isStartDate && change !== 0 && (
                                    <span className={`text-xs ${change > 0 ? "text-green-600" : "text-red-600"}`}>
                                      {change > 0 ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            )
                          })}

                          {/* Average */}
                          <TableCell className="text-center bg-blue-50">
                            <span className="font-semibold">{multiEventData.averageData[index]?.toFixed(2)}</span>
                          </TableCell>

                          {/* Median */}
                          <TableCell className="text-center bg-green-50">
                            <span className="font-semibold">{multiEventData.medianData[index]?.toFixed(2)}</span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>
                Percentage changes from event start date and maximum drawdown for each event
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Event</TableHead>
                      <TableHead className="text-center min-w-20">7d %</TableHead>
                      <TableHead className="text-center min-w-20">14d %</TableHead>
                      <TableHead className="text-center min-w-20">30d %</TableHead>
                      <TableHead className="text-center min-w-20">60d %</TableHead>
                      <TableHead className="text-center min-w-20">90d %</TableHead>
                      <TableHead className="text-center min-w-24">Max Drawdown %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {multiEventData.eventData.map((eventData) => {
                      const startValue = 100 // Event start date value
                      const day7Value = eventData.reindexedData[37] // Index 37 = Day +7
                      const day14Value = eventData.reindexedData[44] // Index 44 = Day +14
                      const day30Value = eventData.reindexedData[60] // Index 60 = Day +30
                      const day60Value = eventData.reindexedData[90] // Index 90 = Day +60
                      const day90Value = eventData.reindexedData[120] // Index 120 = Day +90

                      // Calculate percentage changes
                      const day7Change = ((day7Value - startValue) / startValue) * 100
                      const day14Change = ((day14Value - startValue) / startValue) * 100
                      const day30Change = ((day30Value - startValue) / startValue) * 100
                      const day60Change = ((day60Value - startValue) / startValue) * 100
                      const day90Change = ((day90Value - startValue) / startValue) * 100

                      // Calculate max drawdown from start date to day +90
                      const postEventData = eventData.reindexedData.slice(30, 121) // From day 0 to day +90
                      const minValue = Math.min(...postEventData)
                      const maxDrawdown = ((minValue - startValue) / startValue) * 100

                      return (
                        <TableRow key={eventData.eventId}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-semibold">{eventData.eventName}</div>
                              <div className="text-xs text-gray-500">{eventData.eventDate}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${day7Change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day7Change?.toFixed(2) || "N/A"}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${day14Change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day14Change?.toFixed(2) || "N/A"}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${day30Change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day30Change?.toFixed(2) || "N/A"}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${day60Change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day60Change?.toFixed(2) || "N/A"}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${day90Change >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {day90Change?.toFixed(2) || "N/A"}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-red-600">{maxDrawdown?.toFixed(2) || "N/A"}%</span>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {/* Total Events Row */}
                    <TableRow className="bg-gray-100 font-semibold">
                      <TableCell className="font-bold">Total Events</TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-700">{multiEventData.eventData.length}</span>
                      </TableCell>
                    </TableRow>

                    {/* Average Row */}
                    <TableRow className="bg-blue-50 font-semibold">
                      <TableCell className="font-bold">Average</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[37] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className={avg >= 0 ? "text-green-600" : "text-red-600"}>{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[44] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className={avg >= 0 ? "text-green-600" : "text-red-600"}>{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[60] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className={avg >= 0 ? "text-green-600" : "text-red-600"}>{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[90] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className={avg >= 0 ? "text-green-600" : "text-red-600"}>{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[120] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className={avg >= 0 ? "text-green-600" : "text-red-600"}>{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => {
                              const postEventData = e.reindexedData.slice(30, 121)
                              const minValue = Math.min(...postEventData)
                              return ((minValue - 100) / 100) * 100
                            })
                            .filter((v) => !isNaN(v))
                          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          return <span className="text-red-600">{avg.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                    </TableRow>

                    {/* Median Row */}
                    <TableRow className="bg-green-50 font-semibold">
                      <TableCell className="font-bold">Median</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[37] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return (
                            <span className={median >= 0 ? "text-green-600" : "text-red-600"}>
                              {median.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[44] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return (
                            <span className={median >= 0 ? "text-green-600" : "text-red-600"}>
                              {median.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[60] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return (
                            <span className={median >= 0 ? "text-green-600" : "text-red-600"}>
                              {median.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[90] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return (
                            <span className={median >= 0 ? "text-green-600" : "text-red-600"}>
                              {median.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => ((e.reindexedData[120] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return (
                            <span className={median >= 0 ? "text-green-600" : "text-red-600"}>
                              {median.toFixed(2)}%
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const values = multiEventData.eventData
                            .map((e) => {
                              const postEventData = e.reindexedData.slice(30, 121)
                              const minValue = Math.min(...postEventData)
                              return ((minValue - 100) / 100) * 100
                            })
                            .filter((v) => !isNaN(v))
                            .sort((a, b) => a - b)
                          const median =
                            values.length > 0
                              ? values.length % 2 === 0
                                ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
                                : values[Math.floor(values.length / 2)]
                              : 0
                          return <span className="text-red-600">{median.toFixed(2)}%</span>
                        })()}
                      </TableCell>
                    </TableRow>

                    {/* Count of Positive Changes Row */}
                    <TableRow className="bg-yellow-50 font-semibold">
                      <TableCell className="font-bold">Count +ve Changes</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = multiEventData.eventData
                            .map((e) => ((e.reindexedData[37] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v) && v > 0).length
                          return <span className="text-blue-600">{count}</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = multiEventData.eventData
                            .map((e) => ((e.reindexedData[44] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v) && v > 0).length
                          return <span className="text-blue-600">{count}</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = multiEventData.eventData
                            .map((e) => ((e.reindexedData[60] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v) && v > 0).length
                          return <span className="text-blue-600">{count}</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = multiEventData.eventData
                            .map((e) => ((e.reindexedData[90] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v) && v > 0).length
                          return <span className="text-blue-600">{count}</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const count = multiEventData.eventData
                            .map((e) => ((e.reindexedData[120] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v) && v > 0).length
                          return <span className="text-blue-600">{count}</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-400">N/A</span>
                      </TableCell>
                    </TableRow>

                    {/* Percentage of Positive Changes Row */}
                    <TableRow className="bg-orange-50 font-semibold">
                      <TableCell className="font-bold">% +ve Changes</TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const validValues = multiEventData.eventData
                            .map((e) => ((e.reindexedData[37] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const positiveCount = validValues.filter((v) => v > 0).length
                          const percentage = validValues.length > 0 ? (positiveCount / validValues.length) * 100 : 0
                          return <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const validValues = multiEventData.eventData
                            .map((e) => ((e.reindexedData[44] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const positiveCount = validValues.filter((v) => v > 0).length
                          const percentage = validValues.length > 0 ? (positiveCount / validValues.length) * 100 : 0
                          return <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const validValues = multiEventData.eventData
                            .map((e) => ((e.reindexedData[60] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const positiveCount = validValues.filter((v) => v > 0).length
                          const percentage = validValues.length > 0 ? (positiveCount / validValues.length) * 100 : 0
                          return <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const validValues = multiEventData.eventData
                            .map((e) => ((e.reindexedData[90] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const positiveCount = validValues.filter((v) => v > 0).length
                          const percentage = validValues.length > 0 ? (positiveCount / validValues.length) * 100 : 0
                          return <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        {(() => {
                          const validValues = multiEventData.eventData
                            .map((e) => ((e.reindexedData[120] - 100) / 100) * 100)
                            .filter((v) => !isNaN(v))
                          const positiveCount = validValues.filter((v) => v > 0).length
                          const percentage = validValues.length > 0 ? (positiveCount / validValues.length) * 100 : 0
                          return <span className="text-blue-600">{percentage.toFixed(1)}%</span>
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-gray-400">N/A</span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
