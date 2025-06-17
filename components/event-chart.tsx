"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import type { EventData } from "@/types"
import { eventDataDB, ASSET_NAMES } from "@/lib/indexeddb"

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

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

interface DataCache {
  data: Record<string, AssetData>
  lastDownload: number
  eventDate: string
}

const ASSET_COLORS = {
  "S&P 500": "#2563eb",
  "WTI Crude Oil": "#dc2626",
  Gold: "#f59e0b",
  "Dollar Index": "#059669",
  "10Y Treasury Yield": "#7c3aed",
  VIX: "#ec4899",
}

// Global cache for storing downloaded data - persists across component re-renders
const globalDataCache: DataCache | null = null

export function EventChart({ event }: EventChartProps) {
  const [assetData, setAssetData] = useState<Record<string, AssetData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(
    new Set(["S&P 500", "WTI Crude Oil", "Gold", "Dollar Index", "10Y Treasury Yield", "VIX"]),
  )
  const [lastUpdate, setLastUpdate] = useState<string>("")
  const [githubSaveStatus, setGithubSaveStatus] = useState<string>("")

  // Track if this is initial session load
  const isInitialLoad = useRef(true)
  const lastActionTime = useRef<number>(0)

  useEffect(() => {
    if (event) {
      handleEventChange()
    }
  }, [event])

  const shouldDownloadData = async (isManualUpdate = false): Promise<boolean> => {
    // Always download if manual update button pressed
    if (isManualUpdate) {
      console.log("Manual update requested - downloading data")
      return true
    }

    // Always download on initial session load
    if (isInitialLoad.current) {
      console.log("Initial session load - checking cache")
      return true
    }

    // Check if we have fresh cached data for all assets
    for (const assetName of ASSET_NAMES) {
      const isFresh = await eventDataDB.isDataFresh(event.id, assetName, 1)
      if (!isFresh) {
        console.log(`Stale data for ${assetName} - need to download`)
        return true
      }
    }

    console.log("All data is fresh in cache - no download needed")
    return false
  }

  const fetchEventData = async (isManualUpdate = false) => {
    setLoading(true)
    setError(null)
    setGithubSaveStatus("")

    try {
      const assetDataPromises = ASSET_NAMES.map(async (assetName) => {
        try {
          // First try to calculate from cached closing prices
          const calculatedData = await eventDataDB.calculateEventData(event.id, assetName, event.date, 30, 60)

          if (calculatedData && !isManualUpdate) {
            console.log(`Using cached closing prices for ${assetName}`)
            return { assetName, data: calculatedData }
          }

          // If no cached data or manual update, fetch fresh data
          console.log(`Fetching fresh data for ${assetName}`)
          const response = await fetch("/api/event-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventDate: event.date,
              assetsToFetch: [assetName],
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to fetch data for ${assetName}`)
          }

          const data = await response.json()
          const assetData = data.assets[assetName]

          if (!assetData) {
            throw new Error(`No data available for ${assetName}`)
          }

          // Store in IndexedDB
          await eventDataDB.storeEventData(event.id, assetName, event.date, assetData)

          return { assetName, data: assetData }
        } catch (error) {
          console.error(`Failed to get data for ${assetName}:`, error)
          return { assetName, data: null } // Return null instead of mock data
        }
      })

      const results = await Promise.all(assetDataPromises)
      const finalAssetData: Record<string, any> = {}

      results.forEach(({ assetName, data }) => {
        if (data) {
          finalAssetData[assetName] = data
        }
        // Skip assets with no data - no mock data generation
      })

      setAssetData(finalAssetData)
      setLastUpdate(new Date().toLocaleTimeString())
      setGithubSaveStatus(`Loaded data for ${Object.keys(finalAssetData).length} assets`)

      // Mark initial load as complete
      if (isInitialLoad.current) {
        isInitialLoad.current = false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  const handleEventChange = () => {
    // Record the time of this action
    lastActionTime.current = Date.now()
    fetchEventData(false)
  }

  const handleUpdate = () => {
    // Manual update - always download
    fetchEventData(true)
  }

  const toggleAsset = (assetName: string) => {
    // Record action time but don't trigger data download
    lastActionTime.current = Date.now()

    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetName)) {
      newSelected.delete(assetName)
    } else {
      newSelected.add(assetName)
    }
    setSelectedAssets(newSelected)
  }

  const calculateDaysFromStart = (currentDate: string, eventDate: string): number => {
    const current = new Date(currentDate)
    const event = new Date(eventDate)
    const diffTime = current.getTime() - event.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const generateComprehensiveData = (): ComprehensiveData | null => {
    if (!assetData) return null

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
      const comprehensivePrices: number[] = []
      const comprehensiveReindexed: number[] = []

      let lastKnownPrice = data.prices[0] || 100 // Fallback price
      let lastKnownReindexed = data.reindexed[0] || 100 // Fallback reindexed

      allDates.forEach((date) => {
        // Find if we have data for this date
        const dataIndex = data.dates.findIndex((d) => d === date)

        if (dataIndex !== -1) {
          // We have data for this date
          lastKnownPrice = data.prices[dataIndex]
          lastKnownReindexed = data.reindexed[dataIndex]
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
    if (!comprehensiveData) return []

    const intervals = [5, 10, 20, 40, 60]
    const changes: PriceChange[] = []

    // Find event date index (should be at day 0)
    const eventIndex = comprehensiveData.daysFromStart.findIndex((day) => day === 0)
    if (eventIndex === -1) return []

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
            <span>Loading multi-asset event analysis data...</span>
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
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assetData) {
    return null
  }

  // Prepare chart data for selected assets
  const chartTraces = Object.entries(assetData)
    .filter(([assetName]) => selectedAssets.has(assetName))
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
      hoverinfo: "skip" as const, // Remove hover functionality
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
    hoverinfo: "skip" as const,
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
              {githubSaveStatus && <span className="text-xs text-green-600">{githubSaveStatus}</span>}
              <Button onClick={handleUpdate} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Update
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Reindexed to 100 on event date ({event.date}). Showing 30 days before to 60 days after. Note: 10Y yield and
            VIX use additive reindexing (current - start + 100).
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
          </div>
        </CardContent>
      </Card>

      {/* Price Changes Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Post-Event Price Changes Summary</CardTitle>
          <CardDescription>
            Percentage changes relative to event date baseline (100). Raw values shown in parentheses. Based on
            comprehensive calendar data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 border-r">Period</TableHead>
                  <TableHead className="sticky left-16 bg-white z-10 border-r">Date</TableHead>
                  {Object.keys(assetData).map((assetName) => (
                    <TableHead key={assetName} className="text-center min-w-32">
                      {assetName}
                      <br />
                      <span className="text-xs text-gray-500">% Change (Raw)</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceChanges.map((change) => (
                  <TableRow key={change.days}>
                    <TableCell className="sticky left-0 bg-white z-10 border-r font-medium">
                      +{change.days} days
                    </TableCell>
                    <TableCell className="sticky left-16 bg-white z-10 border-r text-sm">
                      {change.date || "N/A"}
                    </TableCell>
                    {Object.entries(assetData).map(([assetName, _]) => {
                      const assetChange = change.changes[assetName]
                      if (!assetChange) {
                        return (
                          <TableCell key={assetName} className="text-center text-gray-400">
                            N/A
                          </TableCell>
                        )
                      }

                      const isPositive = assetChange.percentage > 0
                      const isNegative = assetChange.percentage < 0

                      return (
                        <TableCell key={assetName} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`font-medium ${
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

      {/* Comprehensive Calendar Data Table */}
      {comprehensiveData && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Calendar Data Table</CardTitle>
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
              <Table className="frozen-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-20">Date</TableHead>
                    <TableHead className="min-w-16 text-center">Days</TableHead>
                    {Object.keys(comprehensiveData.assetData).map((assetName) => (
                      <TableHead key={`${assetName}-raw`} className="text-center min-w-24">
                        {assetName}
                        <br />
                        <span className="text-xs text-gray-500">Raw</span>
                      </TableHead>
                    ))}
                    {Object.keys(comprehensiveData.assetData).map((assetName) => (
                      <TableHead key={`${assetName}-reindexed`} className="text-center min-w-24">
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
                      <TableRow key={date} className={isEventDate ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">
                          {date}
                          {isEventDate && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Event
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          <span className={isEventDate ? "font-bold text-red-600" : ""}>
                            {daysFromStart === 0 ? "0d" : `${daysFromStart > 0 ? "+" : ""}${daysFromStart}d`}
                          </span>
                        </TableCell>

                        {/* Raw Prices */}
                        {Object.entries(comprehensiveData.assetData).map(([assetName, data]) => (
                          <TableCell key={`${assetName}-raw-${index}`} className="text-center">
                            {data.prices[index]?.toFixed(assetName === "10Y Treasury Yield" ? 3 : 2) || "N/A"}
                            {assetName === "10Y Treasury Yield" && "%"}
                          </TableCell>
                        ))}

                        {/* Reindexed Values */}
                        {Object.entries(comprehensiveData.assetData).map(([assetName, data]) => {
                          const reindexedValue = data.reindexed[index]
                          const change = reindexedValue - 100

                          return (
                            <TableCell key={`${assetName}-reindexed-${index}`} className="text-center">
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
