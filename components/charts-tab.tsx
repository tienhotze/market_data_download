"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts"
import { Loader2 } from "lucide-react"
import { prepareTechnicalData, getPriceDistribution } from "@/lib/technical-indicators"
import type { TickerData } from "@/types"

interface ChartsTabProps {
  ticker: TickerData
  pricesData: any[]
  loading: boolean
  period?: string
}

export function ChartsTab({ ticker, pricesData, loading, period = "1mo" }: ChartsTabProps) {
  const chartData = useMemo(() => {
    if (!pricesData || pricesData.length === 0) return { technicalData: [], distribution: [], rsiData: [] }

    // Determine period for moving averages
    const periodDays = {
      "1mo": 20,
      "2mo": 20,
      "3mo": 20,
      "6mo": 50,
      "1y": 50,
      "2y": 100,
      "5y": 200,
      "10y": 200,
      max: 200,
    }

    const movingAveragePeriod = periodDays[period as keyof typeof periodDays] || 20
    const technicalData = prepareTechnicalData(pricesData, movingAveragePeriod)

    // Get price distribution
    const prices = pricesData.map((d) => d.Close)
    const distribution = getPriceDistribution(prices, 15)

    // Prepare RSI data
    const rsiData = technicalData
      .map((d) => ({
        date: d.date,
        rsi: d.rsi,
      }))
      .filter((d) => d.rsi !== null)

    return { technicalData, distribution, rsiData }
  }, [pricesData, period])

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading charts...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!pricesData || pricesData.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <span className="text-gray-500">No data available for charts</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Price Chart with Technical Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Price Chart with Technical Analysis - {ticker.symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Main Price Chart */}
            <div className="lg:col-span-3">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData.technicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: any, name: string) => [
                      typeof value === "number" ? value.toFixed(2) : value,
                      name,
                    ]}
                  />
                  <Legend />

                  {/* Price Line */}
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} name="Price" dot={false} />

                  {/* Moving Average */}
                  <Line
                    type="monotone"
                    dataKey="sma"
                    stroke="#dc2626"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Moving Average"
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Upper Bollinger Band */}
                  <Line
                    type="monotone"
                    dataKey="upperBand"
                    stroke="#16a34a"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Upper Band (+2σ)"
                    dot={false}
                    connectNulls={false}
                  />

                  {/* Lower Bollinger Band */}
                  <Line
                    type="monotone"
                    dataKey="lowerBand"
                    stroke="#16a34a"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Lower Band (-2σ)"
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Price Distribution Histogram */}
            <div className="lg:col-span-1">
              <h4 className="text-sm font-medium mb-2">Price Distribution</h4>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData.distribution} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="range" tick={{ fontSize: 8 }} width={60} />
                  <Tooltip
                    formatter={(value: any) => [value, "Frequency"]}
                    labelFormatter={(label) => `Price Range: $${label}`}
                  />
                  <Bar dataKey="count" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSI Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>RSI (Relative Strength Index) - {ticker.symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData.rsiData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any) => [value?.toFixed(2), "RSI"]}
              />

              {/* RSI Reference Lines */}
              <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="5 5" label="Overbought (70)" />
              <ReferenceLine y={30} stroke="#16a34a" strokeDasharray="5 5" label="Oversold (30)" />
              <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="2 2" label="Neutral (50)" />

              {/* RSI Line */}
              <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={2} name="RSI" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
