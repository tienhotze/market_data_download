"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import type { EventData } from "@/types"

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

interface EventChartProps {
  event: EventData
}

interface ChartData {
  dates: string[]
  prices: number[]
  reindexed: number[]
}

export function EventChart({ event }: EventChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          ticker: "^GSPC", // S&P 500
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`)
      }

      const data = await response.json()
      setChartData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
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
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!chartData) {
    return null
  }

  const eventDateIndex = chartData.dates.findIndex((date) => date === event.date)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>S&P 500 Impact Analysis: {event.name}</CardTitle>
          <CardDescription>
            Reindexed to 100 on event date ({event.date}). Showing 30 days before to 60 days after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <Plot
              data={[
                {
                  x: chartData.dates,
                  y: chartData.reindexed,
                  type: "scatter",
                  mode: "lines",
                  name: "S&P 500 (Reindexed)",
                  line: { color: "#2563eb", width: 2 },
                  hovertemplate: "<b>%{x}</b><br>Index: %{y:.2f}<extra></extra>",
                },
                {
                  x: [event.date, event.date],
                  y: [Math.min(...chartData.reindexed) * 0.95, Math.max(...chartData.reindexed) * 1.05],
                  type: "scatter",
                  mode: "lines",
                  name: "Event Date",
                  line: { color: "#dc2626", width: 2, dash: "dash" },
                  showlegend: false,
                  hoverinfo: "skip",
                },
              ]}
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

      <Card>
        <CardHeader>
          <CardTitle>Data Table</CardTitle>
          <CardDescription>Raw and reindexed S&P 500 data for the analysis period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Raw Price</TableHead>
                  <TableHead>Reindexed</TableHead>
                  <TableHead>Daily Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.dates.map((date, index) => {
                  const dailyChange =
                    index > 0
                      ? ((chartData.reindexed[index] - chartData.reindexed[index - 1]) /
                          chartData.reindexed[index - 1]) *
                        100
                      : 0
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
                      <TableCell>{chartData.prices[index].toFixed(2)}</TableCell>
                      <TableCell>{chartData.reindexed[index].toFixed(2)}</TableCell>
                      <TableCell>
                        {index > 0 && (
                          <span className={dailyChange >= 0 ? "text-green-600" : "text-red-600"}>
                            {dailyChange >= 0 ? "+" : ""}
                            {dailyChange.toFixed(2)}%
                          </span>
                        )}
                      </TableCell>
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
