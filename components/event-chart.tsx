"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown, RefreshCw, Copy } from "lucide-react"
import type { EventData } from "@/types"
import { eventDataDB, ASSET_NAMES } from "@/lib/indexeddb"
import { toast } from "@/components/ui/use-toast"

// Import Plotly dynamically with proper configuration
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  ),
})

// Import dynamic from Next.js
import dynamic from "next/dynamic"

interface EventChartProps {
  event: EventData
}

interface AssetData {
  dates: string[]
  prices: number[]
  reindexed: number[]
  assetName: string
  eventPrice: number
}

interface ComprehensiveData {
  dates: string[]
  daysFromStart: number[]
  assetData: Record<string, { prices: number[]; reindexed: number[] }>
}

interface PriceChange {
  days: number
  date: string | null
  changes: Record<string, { absolute: number; percentage: number; value: number; rawValue: number } | null>
}

const ASSET_COLORS = {
  "S&P 500": "#2563eb",
  "WTI Crude Oil": "#dc2626",
  Gold: "#f59e0b",
  "Dollar Index": "#059669",
  "10Y Treasury Yield": "#7c3aed",
  VIX: "#ec4899",
}

const copyTableToClipboard = async (tableId: string, tableName: string) => {
  try {
    const table = document.getElementById(tableId)
    if (!table) return

    let csvContent = ""
    const rows = table.querySelectorAll("tr")

    rows.forEach((row) => {
      const cells = row.querySelectorAll("th, td")
      const rowData = Array.from(cells).map((cell) => {
        // Clean up the cell text
        const text = cell.textContent?.trim() || ""
        // Handle cells with line breaks or multiple elements
        return text.replace(/\s+/g, " ").replace(/,/g, ";")
      })
      csvContent += rowData.join(",") + "\n"
    })

    await navigator.clipboard.writeText(csvContent)
    toast({
      title: "Table Copied",
      description: `${tableName} has been copied to clipboard as CSV format.`,
    })
  } catch (error) {
    console.error("Failed to copy table:", error)
    toast({
      title: "Copy Failed",
      description: "Failed to copy table to clipboard.",
      variant: "destructive",
    })
  }
}

export function EventChart({ event }: EventChartProps) {
  const [assetData, setAssetData] = useState<Record<string, AssetData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(
    new Set(["S&P 500", "WTI Crude Oil", "Gold", "Dollar Index", "10Y Treasury Yield", "VIX"]),
  )
  const [lastUpdate, setLastUpdate] = useState<string>("")
  const [dataSource, setDataSource] = useState<string>("")

  useEffect(() => {
    if (event) {
      fetchEventData()
    }
  }, [event])

  const fetchEventData = async () => {
    setLoading(true)
    setError(null)
    setDataSource("")

    try {
      console.log(`Fetching data for event: ${event.name} (${event.date})`)

      const assetDataPromises = ASSET_NAMES.map(async (assetName) => {
        try {
          // First try to calculate from cached closing prices
          console.log(`Attempting to calculate data for ${assetName} from cache`)
          const calculatedData = await eventDataDB.calculateEventData(event.id, assetName, event.date, 30, 60)

          if (calculatedData && calculatedData.dates && calculatedData.dates.length > 0) {
            console.log(
              `Successfully calculated data for ${assetName} from cache (${calculatedData.dates.length} data points)`,
            )
            return { assetName, data: calculatedData, source: "cache" }
          }

          // If no cached data, try to fetch from API
          console.log(`No cached data for ${assetName}, fetching from API`)
          const response = await fetch("/api/event-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventDate: event.date,
              assetsToFetch: [assetName],
            }),
          })

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`)
          }

          const apiData = await response.json()
          const assetApiData = apiData.assets?.[assetName]

          if (!assetApiData || !assetApiData.dates || assetApiData.dates.length === 0) {
            throw new Error(`No valid data returned from API for ${assetName}`)
          }

          // Store in IndexedDB for future use
          await eventDataDB.storeEventData(event.id, assetName, event.date, assetApiData)
          console.log(
            `Successfully fetched and stored data for ${assetName} from API (${assetApiData.dates.length} data points)`,
          )

          return { assetName, data: assetApiData, source: "api" }
        } catch (error) {
          console.error(`Failed to get data for ${assetName}:`, error)
          return { assetName, data: null, source: "failed" }
        }
      })

      const results = await Promise.all(assetDataPromises)
      const finalAssetData: Record<string, AssetData> = {}
      const sources: string[] = []

      results.forEach(({ assetName, data, source }) => {
        if (data && data.dates && data.dates.length > 0) {
          finalAssetData[assetName] = data
          sources.push(`${assetName}: ${source}`)
        } else {
          console.warn(`Skipping ${assetName} - no valid data available`)
        }
      })

      console.log(`Final asset data loaded:`, Object.keys(finalAssetData))

      if (Object.keys(finalAssetData).length === 0) {
        throw new Error("No asset data could be loaded. Please try refreshing or check if asset data is available.")
      }

      setAssetData(finalAssetData)
      setLastUpdate(new Date().toLocaleTimeString())
      setDataSource(`Loaded ${Object.keys(finalAssetData).length} assets (${sources.join(", ")})`)
    } catch (err) {
      console.error("Error in fetchEventData:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = () => {
    fetchEventData()
  }

  const toggleAsset = (assetName: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetName)) {
      newSelected.delete(assetName)
    } else {
      newSelected.add(assetName)
    }
    setSelectedAssets(newSelected)
  }

  const generateComprehensiveData = (): ComprehensiveData | null => {
    if (!assetData || Object.keys(assetData).length === 0) {
      console.warn("No asset data available for comprehensive data generation")
      return null
    }

    // Generate all calendar days from -30 to +60
    const eventDate = new Date(event.date)
    const allDates: string[] = []
    const daysFromStart: number[] = []

    for (let i = -30; i <= 60; i++) {
      const date = new Date(eventDate)
      date.setDate(eventDate.getDate() + i)
      allDates.push(date.toISOString().split("T")[0])
      daysFromStart.push(i)
    }

    const comprehensiveAssetData: Record<string, { prices: number[]; reindexed: number[] }> = {}

    // For each asset, create comprehensive data with forward fill
    Object.entries(assetData).forEach(([assetName, data]) => {
      // Add null checks for data structure
      if (!data || !data.prices || !data.reindexed || !data.dates) {
        console.warn(`Incomplete data for ${assetName}:`, data)
        return // Skip this asset if data is incomplete
      }

      const comprehensivePrices: number[] = []
      const comprehensiveReindexed: number[] = []

      // Use safe fallbacks for initial values
      let lastKnownPrice = data.prices && data.prices.length > 0 ? data.prices[0] : 100
      let lastKnownReindexed = data.reindexed && data.reindexed.length > 0 ? data.reindexed[0] : 100

      allDates.forEach((date) => {
        // Find if we have data for this date
        const dataIndex = data.dates ? data.dates.findIndex((d) => d === date) : -1

        if (dataIndex !== -1 && data.prices && data.reindexed) {
          // We have data for this date
          if (data.prices[dataIndex] !== undefined) {
            lastKnownPrice = data.prices[dataIndex]
          }
          if (data.reindexed[dataIndex] !== undefined) {
            lastKnownReindexed = data.reindexed[dataIndex]
          }
        }
        // If no data, use last known values (forward fill)

        comprehensivePrices.push(lastKnownPrice)
        comprehensiveReindexed.push(lastKnownReindexed)
      })

      comprehensiveAssetData[assetName] = {
        prices: comprehensivePrices,
        reindexed: comprehensiveReindexed,
      }
    })

    return {
      dates: allDates,
      daysFromStart,
      assetData: comprehensiveAssetData,
    }
  }

  const calculatePriceChanges = (): PriceChange[] => {
    const comprehensiveData = generateComprehensiveData()
    if (!comprehensiveData || !comprehensiveData.assetData || Object.keys(comprehensiveData.assetData).length === 0) {
      console.warn("No comprehensive data available for price change calculations")
      return []
    }

    const intervals = [5, 10, 20, 40, 60]
    const changes: PriceChange[] = []

    // Find event date index (should be at day 0)
    const eventIndex = comprehensiveData.daysFromStart.findIndex((day) => day === 0)
    if (eventIndex === -1) {
      console.warn("Event date not found in comprehensive data")
      return []
    }

    intervals.forEach((days) => {
      const targetIndex = comprehensiveData.daysFromStart.findIndex((day) => day === days)

      if (targetIndex === -1) {
        // Add entry with null data
        const assetChanges: Record<
          string,
          { absolute: number; percentage: number; value: number; rawValue: number } | null
        > = {}
        Object.keys(comprehensiveData.assetData).forEach((assetName) => {
          assetChanges[assetName] = null
        })

        changes.push({
          days,
          date: null,
          changes: assetChanges,
        })
        return
      }

      const targetDate = comprehensiveData.dates[targetIndex]
      const assetChanges: Record<
        string,
        { absolute: number; percentage: number; value: number; rawValue: number } | null
      > = {}

      Object.entries(comprehensiveData.assetData).forEach(([assetName, data]) => {
        const reindexedValue = data.reindexed[targetIndex]
        const rawValue = data.prices[targetIndex]
        const absolute = reindexedValue - 100
        const percentage = reindexedValue / 100 - 1

        assetChanges[assetName] = {
          absolute,
          percentage: percentage * 100,
          value: reindexedValue,
          rawValue: rawValue,
        }
      })

      changes.push({
        days,
        date: targetDate,
        changes: assetChanges,
      })
    })

    return changes
  }

  const formatRawValue = (rawValue: number, assetName: string): string => {
    if (assetName === "10Y Treasury Yield") {
      return `${rawValue.toFixed(3)}%`
    } else if (assetName === "VIX") {
      return rawValue.toFixed(2)
    } else if (assetName === "S&P 500") {
      return rawValue.toFixed(0)
    } else if (assetName === "WTI Crude Oil") {
      return `$${rawValue.toFixed(2)}`
    } else if (assetName === "Gold") {
      return `$${rawValue.toFixed(0)}`
    } else if (assetName === "Dollar Index") {
      return rawValue.toFixed(2)
    }
    return rawValue.toFixed(2)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading event analysis data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading data</p>
            <p className="text-sm">{error}</p>
            <Button onClick={handleUpdate} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assetData || Object.keys(assetData).length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-600">
            <p className="font-semibold">No data available</p>
            <p className="text-sm">Please select an event to analyze</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare chart data for selected assets
  const chartTraces = Object.entries(assetData)
    .filter(([assetName]) => selectedAssets.has(assetName))
    .filter(([assetName, data]) => data && data.dates && data.reindexed && data.dates.length > 0)
    .map(([assetName, data]) => ({
      x: data.dates,
      y: data.reindexed,
      type: "scatter" as const,
      mode: "lines" as const,
      name: assetName,
      line: {
        color: ASSET_COLORS[assetName as keyof typeof ASSET_COLORS] || "#6b7280",
        width: 2,
      },
    }))

  // Add event date vertical line
  const eventTrace = {
    x: [event.date, event.date],
    y: [50, 150], // Extended range for full visibility
    type: "scatter" as const,
    mode: "lines" as const,
    name: "Event Date",
    line: { color: "#dc2626", width: 2, dash: "dash" },
    showlegend: false,
  }

  const allTraces = [...chartTraces, eventTrace]
  const priceChanges = calculatePriceChanges()
  const comprehensiveData = generateComprehensiveData()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Multi-Asset Impact Analysis: {event.name}</span>
            <div className="flex items-center gap-2">
              {lastUpdate && <span className="text-sm text-gray-500">Last updated: {lastUpdate}</span>}
              <Button onClick={handleUpdate} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Update
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Reindexed to 100 on event date ({event.date}). Showing 30 days before to 60 days after. Note: 10Y yield and
            VIX use additive reindexing (current - start + 100).
            {dataSource && <div className="text-xs text-green-600 mt-1">{dataSource}</div>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Asset Selection Buttons */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(assetData).map((assetName) => (
              <Button
                key={assetName}
                variant={selectedAssets.has(assetName) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAsset(assetName)}
                className="text-xs"
                style={{
                  backgroundColor: selectedAssets.has(assetName)
                    ? ASSET_COLORS[assetName as keyof typeof ASSET_COLORS]
                    : undefined,
                  borderColor: ASSET_COLORS[assetName as keyof typeof ASSET_COLORS],
                }}
              >
                {assetName}
              </Button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-96">
            {allTraces.length > 1 ? (
              <Plot
                data={allTraces}
                layout={{
                  xaxis: {
                    title: "Date",
                    type: "date",
                  },
                  yaxis: {
                    title: "Reindexed Value (Event Date = 100)",
                    range: [80, 120], // Set visible range from 80 to 120
                  },
                  hovermode: "closest",
                  showlegend: true,
                  legend: {
                    orientation: "h",
                    y: -0.2,
                    x: 0.5,
                    xanchor: "center",
                  },
                  margin: { t: 50, b: 80, l: 60, r: 20 },
                  annotations: [
                    {
                      x: event.date,
                      y: 100,
                      text: event.name,
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No chart data available. Please select assets or refresh data.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Price Changes Summary Table */}
      {priceChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Post-Event Price Changes Summary</span>
              <Button
                onClick={() => copyTableToClipboard("price-changes-table", "Price Changes Summary")}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Table
              </Button>
            </CardTitle>
            <CardDescription>
              Percentage changes relative to event date baseline (100). Raw values shown in parentheses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <Table id="price-changes-table">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="sticky left-0 bg-white z-10 border-r py-1 px-2 text-sm">Period</TableHead>
                    <TableHead className="sticky left-16 bg-white z-10 border-r py-1 px-2 text-sm">Date</TableHead>
                    {Object.keys(assetData).map((assetName) => (
                      <TableHead key={assetName} className="text-center min-w-32 py-1 px-2 text-sm">
                        {assetName}
                        <br />
                        <span className="text-xs text-gray-500">% Change (Raw)</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceChanges.map((change) => (
                    <TableRow key={change.days} className="h-8">
                      <TableCell className="sticky left-0 bg-white z-10 border-r font-medium py-1 px-2 text-sm">
                        +{change.days} days
                      </TableCell>
                      <TableCell className="sticky left-16 bg-white z-10 border-r py-1 px-2 text-sm">
                        {change.date || "N/A"}
                      </TableCell>
                      {Object.entries(assetData).map(([assetName, _]) => {
                        const assetChange = change.changes[assetName]
                        if (!assetChange) {
                          return (
                            <TableCell key={assetName} className="text-center text-gray-400 py-1 px-2 text-sm">
                              N/A
                            </TableCell>
                          )
                        }

                        const isPositive = assetChange.percentage > 0
                        const isNegative = assetChange.percentage < 0

                        return (
                          <TableCell key={assetName} className="text-center py-1 px-2 text-sm">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`font-medium text-xs ${
                                  isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-600"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {assetChange.percentage.toFixed(2)}%
                              </span>
                              <span className="text-xs text-gray-500">
                                ({formatRawValue(assetChange.rawValue, assetName)})
                              </span>
                              <span className="text-xs">
                                {isPositive ? (
                                  <TrendingUp className="h-3 w-3 text-green-600" />
                                ) : isNegative ? (
                                  <TrendingDown className="h-3 w-3 text-red-600" />
                                ) : null}
                              </span>
                            </div>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comprehensive Calendar Data Table */}
      {comprehensiveData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Complete Calendar Data Table</span>
              <Button
                onClick={() => copyTableToClipboard("calendar-data-table", "Complete Calendar Data")}
                variant="outline"
                size="sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Table
              </Button>
            </CardTitle>
            <CardDescription>
              All calendar days from -30d to +60d including weekends. Missing prices forward-filled from previous day.
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
                .frozen-table th:nth-child(2),
                .frozen-table td:nth-child(2) {
                  position: sticky;
                  left: 80px;
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
                .frozen-table th:first-child,
                .frozen-table th:nth-child(2) {
                  z-index: 30;
                }
              `}</style>
              <Table className="frozen-table" id="calendar-data-table">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="min-w-20 py-1 px-2 text-sm">Date</TableHead>
                    <TableHead className="min-w-16 text-center py-1 px-2 text-sm">Days</TableHead>
                    {Object.keys(comprehensiveData.assetData).map((assetName) => (
                      <TableHead key={`${assetName}-raw`} className="text-center min-w-24 py-1 px-2 text-sm">
                        {assetName}
                        <br />
                        <span className="text-xs text-gray-500">Raw</span>
                      </TableHead>
                    ))}
                    {Object.keys(comprehensiveData.assetData).map((assetName) => (
                      <TableHead key={`${assetName}-reindexed`} className="text-center min-w-24 py-1 px-2 text-sm">
                        {assetName}
                        <br />
                        <span className="text-xs text-gray-500">Reindexed</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprehensiveData.dates.map((date, index) => {
                    const isEventDate = comprehensiveData.daysFromStart[index] === 0
                    const daysFromStart = comprehensiveData.daysFromStart[index]

                    return (
                      <TableRow key={date} className={`h-8 ${isEventDate ? "bg-red-50" : ""}`}>
                        <TableCell className="font-medium py-1 px-2 text-sm">
                          {date}
                          {isEventDate && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Event
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono py-1 px-2 text-sm">
                          <span className={isEventDate ? "font-bold text-red-600" : ""}>
                            {daysFromStart === 0 ? "0d" : `${daysFromStart > 0 ? "+" : ""}${daysFromStart}d`}
                          </span>
                        </TableCell>

                        {/* Raw Prices */}
                        {Object.entries(comprehensiveData.assetData).map(([assetName, data]) => (
                          <TableCell key={`${assetName}-raw-${index}`} className="text-center py-1 px-2 text-sm">
                            {data.prices[index]?.toFixed(assetName === "10Y Treasury Yield" ? 3 : 2) || "N/A"}
                            {assetName === "10Y Treasury Yield" && "%"}
                          </TableCell>
                        ))}

                        {/* Reindexed Values */}
                        {Object.entries(comprehensiveData.assetData).map(([assetName, data]) => {
                          const reindexedValue = data.reindexed[index]
                          const change = reindexedValue - 100

                          return (
                            <TableCell
                              key={`${assetName}-reindexed-${index}`}
                              className="text-center py-1 px-2 text-sm"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>{reindexedValue?.toFixed(2) || "N/A"}</span>
                                {!isEventDate && change !== 0 && (
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
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
