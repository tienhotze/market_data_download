"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, TrendingDown } from "lucide-react"
import dynamic from "next/dynamic"
import type { EventData } from "@/types"

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

const ASSET_COLORS = {
  "S&P 500": "#2563eb",
  "WTI Crude Oil": "#dc2626",
  Gold: "#f59e0b",
  "Dollar Index": "#059669",
  "10Y Treasury Yield": "#7c3aed",
}

export function EventChart({ event }: EventChartProps) {
  const [assetData, setAssetData] = useState<Record<string, AssetData> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(
    new Set(["S&P 500", "WTI Crude Oil", "Gold", "Dollar Index", "10Y Treasury Yield"]),
  )

  useEffect(() => {
    if (event) {
      fetchEventData()
    }
  }, [event])

  const fetchEventData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/event-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: event.date,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const data = await response.json()
      setAssetData(data.assets)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
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
      hovertemplate: `<b>${assetName}</b><br>%{x}<br>Index: %{y:.2f}<extra></extra>`,
    }))

  // Add event date vertical line
  const eventTrace = {
    x: [event.date, event.date],
    y: [95, 105], // Fixed range for visibility
    type: "scatter" as const,
    mode: "lines" as const,
    name: "Event Date",
    line: { color: "#dc2626", width: 2, dash: "dash" },
    showlegend: false,
    hoverinfo: "skip" as const,
  }

  const allTraces = [...chartTraces, eventTrace]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-Asset Impact Analysis: {event.name}</CardTitle>
          <CardDescription>
            Reindexed to 100 on event date ({event.date}). Showing 30 days before to 60 days after. Note: 10Y yield uses
            additive reindexing (current - start + 100).
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
                title: {
                  text: `Market Impact: ${event.name}`,
                  font: { size: 16 },
                },
                xaxis: {
                  title: "Date",
                  type: "date",
                },
                yaxis: {
                  title: "Reindexed Value (Event Date = 100)",
                },
                hovermode: "x unified",
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

      {/* Multi-Asset Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Asset Data Table</CardTitle>
          <CardDescription>Raw prices and reindexed values for all assets during the analysis period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {Object.keys(assetData).map((assetName) => (
                    <TableHead key={`${assetName}-raw`} className="text-center">
                      {assetName}
                      <br />
                      <span className="text-xs text-gray-500">Raw</span>
                    </TableHead>
                  ))}
                  {Object.keys(assetData).map((assetName) => (
                    <TableHead key={`${assetName}-reindexed`} className="text-center">
                      {assetName}
                      <br />
                      <span className="text-xs text-gray-500">Reindexed</span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetData["S&P 500"]?.dates.map((date, index) => {
                  const isEventDate = date === event.date

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

                      {/* Raw Prices */}
                      {Object.entries(assetData).map(([assetName, data]) => (
                        <TableCell key={`${assetName}-raw-${index}`} className="text-center">
                          {data.prices[index]?.toFixed(assetName === "10Y Treasury Yield" ? 3 : 2) || "N/A"}
                          {assetName === "10Y Treasury Yield" && "%"}
                        </TableCell>
                      ))}

                      {/* Reindexed Values */}
                      {Object.entries(assetData).map(([assetName, data]) => {
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
    </div>
  )
}
