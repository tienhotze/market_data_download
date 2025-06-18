"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { TrendingUp, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface EconomicDataPoint {
  date: string
  value: number
  series: string
  seriesName: string
}

interface EconomicSeries {
  series: string
  seriesName: string
  data: EconomicDataPoint[]
  source: string
  unit: string
  frequency: string
}

interface EconomicChartProps {
  data: EconomicSeries
  showMovingAverages: {
    ma3: boolean
    ma6: boolean
    ma12: boolean
  }
  showProjections: boolean
  projectionMonths: number
  loading: boolean
}

export function EconomicChart({
  data,
  showMovingAverages,
  showProjections,
  projectionMonths,
  loading,
}: EconomicChartProps) {
  const { toast } = useToast()

  const processedData = useMemo(() => {
    if (!data?.data) return []

    const sortedData = [...data.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return sortedData.map((point, index) => {
      const result: any = {
        date: point.date,
        value: point.value,
        formattedDate: new Date(point.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
      }

      // Calculate moving averages
      if (showMovingAverages.ma3 && index >= 2) {
        const values = sortedData.slice(index - 2, index + 1).map((d) => d.value)
        result.ma3 = values.reduce((sum, val) => sum + val, 0) / values.length
      }

      if (showMovingAverages.ma6 && index >= 5) {
        const values = sortedData.slice(index - 5, index + 1).map((d) => d.value)
        result.ma6 = values.reduce((sum, val) => sum + val, 0) / values.length
      }

      if (showMovingAverages.ma12 && index >= 11) {
        const values = sortedData.slice(index - 11, index + 1).map((d) => d.value)
        result.ma12 = values.reduce((sum, val) => sum + val, 0) / values.length
      }

      // Calculate year-over-year change
      if (index >= 12) {
        const previousYearValue = sortedData[index - 12].value
        result.yoyChange = ((point.value - previousYearValue) / previousYearValue) * 100
      }

      return result
    })
  }, [data, showMovingAverages])

  const projectedData = useMemo(() => {
    if (!showProjections || !data?.data || data.data.length < 24) return []

    const sortedData = [...data.data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const projections = []

    // Calculate seasonal patterns (10-year average of month-over-month % changes)
    const seasonalPatterns: { [month: number]: number } = {}

    for (let month = 1; month <= 12; month++) {
      const monthChanges: number[] = []

      for (let i = 1; i < sortedData.length; i++) {
        const currentDate = new Date(sortedData[i].date)
        const previousDate = new Date(sortedData[i - 1].date)

        if (currentDate.getMonth() + 1 === month) {
          const change = ((sortedData[i].value - sortedData[i - 1].value) / sortedData[i - 1].value) * 100
          monthChanges.push(change)
        }
      }

      if (monthChanges.length > 0) {
        // Use last 10 years of data for seasonal pattern
        const recentChanges = monthChanges.slice(-10)
        seasonalPatterns[month] = recentChanges.reduce((sum, change) => sum + change, 0) / recentChanges.length
      } else {
        seasonalPatterns[month] = 0
      }
    }

    // Generate projections
    const lastDataPoint = sortedData[sortedData.length - 1]
    let currentValue = lastDataPoint.value
    let currentDate = new Date(lastDataPoint.date)

    for (let i = 1; i <= projectionMonths; i++) {
      currentDate = new Date(currentDate)
      currentDate.setMonth(currentDate.getMonth() + 1)

      const month = currentDate.getMonth() + 1
      const seasonalChange = seasonalPatterns[month] || 0
      currentValue = currentValue * (1 + seasonalChange / 100)

      // Calculate projected YoY change
      let projectedYoyChange = null
      if (sortedData.length >= 12) {
        const yearAgoIndex = sortedData.length - 12 + i - 1
        if (yearAgoIndex >= 0 && yearAgoIndex < sortedData.length) {
          const yearAgoValue = sortedData[yearAgoIndex].value
          projectedYoyChange = ((currentValue - yearAgoValue) / yearAgoValue) * 100
        }
      }

      projections.push({
        date: currentDate.toISOString().split("T")[0],
        value: currentValue,
        isProjected: true,
        formattedDate: currentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
        yoyChange: projectedYoyChange,
      })
    }

    return projections
  }, [data, showProjections, projectionMonths])

  const chartData = useMemo(() => {
    return [...processedData, ...projectedData]
  }, [processedData, projectedData])

  const copyTableToClipboard = async () => {
    const headers = ["Date", "Value", "YoY Change %"]
    if (showMovingAverages.ma3) headers.push("3M MA")
    if (showMovingAverages.ma6) headers.push("6M MA")
    if (showMovingAverages.ma12) headers.push("12M MA")

    const csvContent = [
      headers.join(","),
      ...chartData.map((row) => {
        const values = [row.formattedDate, row.value?.toFixed(2) || "", row.yoyChange?.toFixed(2) || ""]
        if (showMovingAverages.ma3) values.push(row.ma3?.toFixed(2) || "")
        if (showMovingAverages.ma6) values.push(row.ma6?.toFixed(2) || "")
        if (showMovingAverages.ma12) values.push(row.ma12?.toFixed(2) || "")
        return values.join(",")
      }),
    ].join("\n")

    try {
      await navigator.clipboard.writeText(csvContent)
      toast({
        title: "Table copied",
        description: "Economic data table copied to clipboard as CSV",
      })
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy table to clipboard",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {data.seriesName}
              </CardTitle>
              <CardDescription>
                Historical data and projections • Source: {data.source} • Unit: {data.unit}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{data.frequency}</Badge>
              {showProjections && <Badge variant="secondary">{projectionMonths}M projection</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="formattedDate" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: string) => [typeof value === "number" ? value.toFixed(2) : value, name]}
                />
                <Legend />

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name={`${data.seriesName} (${data.unit})`}
                  connectNulls={false}
                  dot={(props) => (props.payload?.isProjected ? { fill: "#dc2626", r: 3 } : false)}
                  strokeDasharray={(dataPoint) => (dataPoint?.isProjected ? "5 5" : "0")}
                />

                {showMovingAverages.ma3 && (
                  <Line type="monotone" dataKey="ma3" stroke="#16a34a" strokeWidth={1} name="3M MA" dot={false} />
                )}

                {showMovingAverages.ma6 && (
                  <Line type="monotone" dataKey="ma6" stroke="#ca8a04" strokeWidth={1} name="6M MA" dot={false} />
                )}

                {showMovingAverages.ma12 && (
                  <Line type="monotone" dataKey="ma12" stroke="#dc2626" strokeWidth={1} name="12M MA" dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Historical Data & Projections</CardTitle>
            <Button variant="outline" size="sm" onClick={copyTableToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Table
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-8">
                  <TableHead className="py-1 px-2 text-sm">Date</TableHead>
                  <TableHead className="py-1 px-2 text-sm">Value ({data.unit})</TableHead>
                  <TableHead className="py-1 px-2 text-sm">YoY Change %</TableHead>
                  {showMovingAverages.ma3 && <TableHead className="py-1 px-2 text-sm">3M MA</TableHead>}
                  {showMovingAverages.ma6 && <TableHead className="py-1 px-2 text-sm">6M MA</TableHead>}
                  {showMovingAverages.ma12 && <TableHead className="py-1 px-2 text-sm">12M MA</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData
                  .slice(-24)
                  .reverse()
                  .map((row, index) => (
                    <TableRow key={index} className={`h-8 ${row.isProjected ? "bg-red-50" : ""}`}>
                      <TableCell className="py-1 px-2 text-sm">
                        {row.formattedDate}
                        {row.isProjected && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Projected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-1 px-2 text-sm">{row.value?.toFixed(2)}</TableCell>
                      <TableCell className="py-1 px-2 text-sm">
                        {row.yoyChange ? (
                          <span className={row.yoyChange > 0 ? "text-green-600" : "text-red-600"}>
                            {row.yoyChange > 0 ? "+" : ""}
                            {row.yoyChange.toFixed(2)}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {showMovingAverages.ma3 && (
                        <TableCell className="py-1 px-2 text-sm">{row.ma3?.toFixed(2) || "-"}</TableCell>
                      )}
                      {showMovingAverages.ma6 && (
                        <TableCell className="py-1 px-2 text-sm">{row.ma6?.toFixed(2) || "-"}</TableCell>
                      )}
                      {showMovingAverages.ma12 && (
                        <TableCell className="py-1 px-2 text-sm">{row.ma12?.toFixed(2) || "-"}</TableCell>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
