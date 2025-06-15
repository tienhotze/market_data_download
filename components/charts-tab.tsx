"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Settings } from "lucide-react"
import dynamic from "next/dynamic"
import { prepareTechnicalData } from "@/lib/technical-indicators"
import type { TickerData } from "@/types"

// Dynamically import Plot to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

interface ChartsTabProps {
  ticker: TickerData
  pricesData: any[]
  loading: boolean
  period?: string
}

interface ChartSettings {
  chartType: "ohlc" | "line"
  movingAveragePeriod: number
  rsiPeriod: number
  showMovingAverage: boolean
  showBollingerBands: boolean
}

interface AxisSettings {
  priceMin: string
  priceMax: string
  dateMin: string
  dateMax: string
  rsiMin: string
  rsiMax: string
}

export function ChartsTab({ ticker, pricesData, loading, period = "1mo" }: ChartsTabProps) {
  const [chartSettings, setChartSettings] = useState<ChartSettings>({
    chartType: "ohlc",
    movingAveragePeriod: 21,
    rsiPeriod: 14,
    showMovingAverage: true,
    showBollingerBands: true,
  })

  const [axisSettings, setAxisSettings] = useState<AxisSettings>({
    priceMin: "",
    priceMax: "",
    dateMin: "",
    dateMax: "",
    rsiMin: "0",
    rsiMax: "100",
  })

  const chartData = useMemo(() => {
    if (!pricesData || pricesData.length === 0) return { technicalData: [], ohlcData: [] }

    const technicalData = prepareTechnicalData(pricesData, chartSettings.movingAveragePeriod, chartSettings.rsiPeriod)

    // Prepare OHLC data
    const sortedPrices = [...pricesData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())
    const ohlcData = sortedPrices.map((item) => ({
      date: item.Date,
      open: item.Open,
      high: item.High,
      low: item.Low,
      close: item.Close,
    }))

    // Set default axis values if not set
    if (!axisSettings.dateMin && technicalData.length > 0) {
      const prices = technicalData.map((d) => d.price)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)

      setAxisSettings((prev) => ({
        ...prev,
        dateMin: technicalData[0].date,
        dateMax: technicalData[technicalData.length - 1].date,
        priceMin: minPrice.toFixed(2),
        priceMax: maxPrice.toFixed(2),
      }))
    }

    return { technicalData, ohlcData }
  }, [pricesData, chartSettings.movingAveragePeriod, chartSettings.rsiPeriod, axisSettings.dateMin])

  const handleChartSettingsUpdate = (newSettings: ChartSettings) => {
    setChartSettings(newSettings)
  }

  const handleAxisUpdate = (newSettings: AxisSettings) => {
    setAxisSettings(newSettings)
  }

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

  // Filter technical data based on axis settings
  const filteredTechnicalData = chartData.technicalData.filter((d) => {
    const date = new Date(d.date)
    const minDate = axisSettings.dateMin ? new Date(axisSettings.dateMin) : new Date(0)
    const maxDate = axisSettings.dateMax ? new Date(axisSettings.dateMax) : new Date()
    return date >= minDate && date <= maxDate
  })

  const filteredOhlcData = chartData.ohlcData.filter((d) => {
    const date = new Date(d.date)
    const minDate = axisSettings.dateMin ? new Date(axisSettings.dateMin) : new Date(0)
    const maxDate = axisSettings.dateMax ? new Date(axisSettings.dateMax) : new Date()
    return date >= minDate && date <= maxDate
  })

  // Prepare data for Plotly
  const dates = filteredTechnicalData.map((d) => d.date)
  const prices = filteredTechnicalData.map((d) => d.price)
  const sma = filteredTechnicalData.map((d) => d.sma)
  const upperBand = filteredTechnicalData.map((d) => d.upperBand)
  const lowerBand = filteredTechnicalData.map((d) => d.lowerBand)
  const rsi = filteredTechnicalData.map((d) => d.rsi).filter((r) => r !== null)
  const rsiDates = filteredTechnicalData.filter((d) => d.rsi !== null).map((d) => d.date)

  // Prepare chart traces based on chart type
  const priceTraces = []

  if (chartSettings.chartType === "ohlc") {
    // OHLC Candlestick Chart
    priceTraces.push({
      x: filteredOhlcData.map((d) => d.date),
      open: filteredOhlcData.map((d) => d.open),
      high: filteredOhlcData.map((d) => d.high),
      low: filteredOhlcData.map((d) => d.low),
      close: filteredOhlcData.map((d) => d.close),
      type: "candlestick" as const,
      name: "OHLC",
      increasing: { line: { color: "#16a34a" } },
      decreasing: { line: { color: "#dc2626" } },
      hovertemplate:
        "<b>OHLC</b><br>Date: %{x}<br>Open: %{open:.2f}<br>High: %{high:.2f}<br>Low: %{low:.2f}<br>Close: %{close:.2f}<extra></extra>",
    })
  } else {
    // Line Chart
    priceTraces.push({
      x: dates,
      y: prices,
      type: "scatter" as const,
      mode: "lines" as const,
      name: "Price",
      line: { color: "#2563eb", width: 2 },
      hovertemplate: "<b>Price</b><br>Date: %{x}<br>Price: %{y:.2f}<extra></extra>",
    })
  }

  // Add technical indicators if enabled
  if (chartSettings.showMovingAverage) {
    priceTraces.push({
      x: dates,
      y: sma,
      type: "scatter" as const,
      mode: "lines" as const,
      name: `MA (${chartSettings.movingAveragePeriod})`,
      line: { color: "#dc2626", width: 1, dash: "dash" },
      hovertemplate: `<b>MA (${chartSettings.movingAveragePeriod})</b><br>Date: %{x}<br>MA: %{y:.2f}<extra></extra>`,
    })
  }

  if (chartSettings.showBollingerBands) {
    priceTraces.push(
      {
        x: dates,
        y: upperBand,
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Upper Band (+2σ)",
        line: { color: "#16a34a", width: 1, dash: "dot" },
        hovertemplate: "<b>Upper Band</b><br>Date: %{x}<br>Upper Band: %{y:.2f}<extra></extra>",
      },
      {
        x: dates,
        y: lowerBand,
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Lower Band (-2σ)",
        line: { color: "#16a34a", width: 1, dash: "dot" },
        hovertemplate: "<b>Lower Band</b><br>Date: %{x}<br>Lower Band: %{y:.2f}<extra></extra>",
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Price Chart with Technical Indicators */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {chartSettings.chartType === "ohlc" ? "OHLC" : "Price"} Chart with Technical Analysis - {ticker.symbol}
          </CardTitle>
          <div className="flex gap-2">
            <ChartSettingsDialog chartSettings={chartSettings} onUpdate={handleChartSettingsUpdate} />
            <AxisControlDialog axisSettings={axisSettings} onUpdate={handleAxisUpdate} />
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: "600px" }}>
            <Plot
              data={priceTraces}
              layout={{
                title: `${ticker.symbol} - ${chartSettings.chartType === "ohlc" ? "OHLC" : "Price"} Analysis`,
                xaxis: {
                  title: "Date",
                  range:
                    axisSettings.dateMin && axisSettings.dateMax
                      ? [axisSettings.dateMin, axisSettings.dateMax]
                      : undefined,
                },
                yaxis: {
                  title: "Price",
                  range:
                    axisSettings.priceMin && axisSettings.priceMax
                      ? [Number.parseFloat(axisSettings.priceMin), Number.parseFloat(axisSettings.priceMax)]
                      : undefined,
                },
                legend: {
                  orientation: "h",
                  x: 0,
                  y: -0.1,
                  xanchor: "left",
                  yanchor: "top",
                },
                hovermode: "x unified",
                showlegend: true,
                margin: {
                  l: 50,
                  r: 50,
                  t: 50,
                  b: 100, // Extra bottom margin for legend
                },
              }}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ["pan2d", "lasso2d"],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </CardContent>
      </Card>

      {/* RSI Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>
            RSI ({chartSettings.rsiPeriod}-day) - {ticker.symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: "300px" }}>
            <Plot
              data={[
                // RSI Line
                {
                  x: rsiDates,
                  y: rsi,
                  type: "scatter",
                  mode: "lines",
                  name: `RSI (${chartSettings.rsiPeriod})`,
                  line: { color: "#f59e0b", width: 2 },
                  hovertemplate: `<b>RSI (${chartSettings.rsiPeriod})</b><br>Date: %{x}<br>RSI: %{y:.2f}<extra></extra>`,
                },
                // Overbought line
                {
                  x: rsiDates,
                  y: Array(rsiDates.length).fill(70),
                  type: "scatter",
                  mode: "lines",
                  name: "Overbought (70)",
                  line: { color: "#dc2626", width: 1, dash: "dash" },
                  hovertemplate: "<b>Overbought Level</b><br>Date: %{x}<br>Level: 70<extra></extra>",
                },
                // Oversold line
                {
                  x: rsiDates,
                  y: Array(rsiDates.length).fill(30),
                  type: "scatter",
                  mode: "lines",
                  name: "Oversold (30)",
                  line: { color: "#16a34a", width: 1, dash: "dash" },
                  hovertemplate: "<b>Oversold Level</b><br>Date: %{x}<br>Level: 30<extra></extra>",
                },
                // Neutral line
                {
                  x: rsiDates,
                  y: Array(rsiDates.length).fill(50),
                  type: "scatter",
                  mode: "lines",
                  name: "Neutral (50)",
                  line: { color: "#6b7280", width: 1, dash: "dot" },
                  hovertemplate: "<b>Neutral Level</b><br>Date: %{x}<br>Level: 50<extra></extra>",
                },
              ]}
              layout={{
                title: `${ticker.symbol} - RSI (${chartSettings.rsiPeriod}-day) Indicator`,
                xaxis: {
                  title: "Date",
                  range:
                    axisSettings.dateMin && axisSettings.dateMax
                      ? [axisSettings.dateMin, axisSettings.dateMax]
                      : undefined,
                },
                yaxis: {
                  title: "RSI",
                  range: [Number.parseFloat(axisSettings.rsiMin), Number.parseFloat(axisSettings.rsiMax)],
                },
                legend: {
                  orientation: "h",
                  x: 0,
                  y: -0.15,
                  xanchor: "left",
                  yanchor: "top",
                },
                hovermode: "x unified",
                showlegend: true,
                margin: {
                  l: 50,
                  r: 50,
                  t: 50,
                  b: 80, // Extra bottom margin for legend
                },
              }}
              config={{
                responsive: true,
                displayModeBar: true,
                modeBarButtonsToRemove: ["pan2d", "lasso2d"],
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ChartSettingsDialog({
  chartSettings,
  onUpdate,
}: {
  chartSettings: ChartSettings
  onUpdate: (settings: ChartSettings) => void
}) {
  const [localSettings, setLocalSettings] = useState(chartSettings)

  const handleSave = () => {
    onUpdate(localSettings)
  }

  const handleReset = () => {
    const resetSettings: ChartSettings = {
      chartType: "ohlc",
      movingAveragePeriod: 21,
      rsiPeriod: 14,
      showMovingAverage: true,
      showBollingerBands: true,
    }
    setLocalSettings(resetSettings)
    onUpdate(resetSettings)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Chart Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chart & Technical Indicator Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Chart Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Chart Type</Label>
            <Select
              value={localSettings.chartType}
              onValueChange={(value: "ohlc" | "line") => setLocalSettings({ ...localSettings, chartType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ohlc">OHLC Candlestick</SelectItem>
                <SelectItem value="line">Line Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Moving Average Period */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Moving Average & Bollinger Bands Period</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="5"
                max="200"
                value={localSettings.movingAveragePeriod}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, movingAveragePeriod: Number.parseInt(e.target.value) || 21 })
                }
                className="w-20"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
          </div>

          {/* RSI Period */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">RSI Period</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min="2"
                max="50"
                value={localSettings.rsiPeriod}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, rsiPeriod: Number.parseInt(e.target.value) || 14 })
                }
                className="w-20"
              />
              <span className="text-sm text-gray-600">days</span>
            </div>
          </div>

          {/* Technical Indicators Toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Technical Indicators</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={localSettings.showMovingAverage}
                  onChange={(e) => setLocalSettings({ ...localSettings, showMovingAverage: e.target.checked })}
                />
                <span className="text-sm">Show Moving Average</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={localSettings.showBollingerBands}
                  onChange={(e) => setLocalSettings({ ...localSettings, showBollingerBands: e.target.checked })}
                />
                <span className="text-sm">Show Bollinger Bands</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button onClick={handleSave}>Apply Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function AxisControlDialog({
  axisSettings,
  onUpdate,
}: {
  axisSettings: AxisSettings
  onUpdate: (settings: AxisSettings) => void
}) {
  const [localSettings, setLocalSettings] = useState(axisSettings)

  const handleSave = () => {
    onUpdate(localSettings)
  }

  const handleReset = () => {
    const resetSettings = {
      priceMin: "",
      priceMax: "",
      dateMin: "",
      dateMax: "",
      rsiMin: "0",
      rsiMax: "100",
    }
    setLocalSettings(resetSettings)
    onUpdate(resetSettings)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Axis Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chart Axis Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Price Axis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Price Axis (Y)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="priceMin" className="text-xs">
                  Min Price
                </Label>
                <Input
                  id="priceMin"
                  type="number"
                  step="0.01"
                  placeholder="Auto"
                  value={localSettings.priceMin}
                  onChange={(e) => setLocalSettings({ ...localSettings, priceMin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="priceMax" className="text-xs">
                  Max Price
                </Label>
                <Input
                  id="priceMax"
                  type="number"
                  step="0.01"
                  placeholder="Auto"
                  value={localSettings.priceMax}
                  onChange={(e) => setLocalSettings({ ...localSettings, priceMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Date Axis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Axis (X)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dateMin" className="text-xs">
                  Start Date
                </Label>
                <Input
                  id="dateMin"
                  type="date"
                  value={localSettings.dateMin}
                  onChange={(e) => setLocalSettings({ ...localSettings, dateMin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dateMax" className="text-xs">
                  End Date
                </Label>
                <Input
                  id="dateMax"
                  type="date"
                  value={localSettings.dateMax}
                  onChange={(e) => setLocalSettings({ ...localSettings, dateMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* RSI Axis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">RSI Axis (Y)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="rsiMin" className="text-xs">
                  Min RSI
                </Label>
                <Input
                  id="rsiMin"
                  type="number"
                  min="0"
                  max="100"
                  value={localSettings.rsiMin}
                  onChange={(e) => setLocalSettings({ ...localSettings, rsiMin: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rsiMax" className="text-xs">
                  Max RSI
                </Label>
                <Input
                  id="rsiMax"
                  type="number"
                  min="0"
                  max="100"
                  value={localSettings.rsiMax}
                  onChange={(e) => setLocalSettings({ ...localSettings, rsiMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleReset}>
              Reset to Auto
            </Button>
            <Button onClick={handleSave}>Apply Settings</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
