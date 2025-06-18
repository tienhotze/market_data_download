"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Calendar, BarChart3 } from "lucide-react"
import Link from "next/link"
import { EconomicChart } from "@/components/economic-chart"
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

const AVAILABLE_SERIES = {
  unemployment: { name: "Unemployment Rate", unit: "%" },
  cpi: { name: "Consumer Price Index", unit: "Index" },
  jobsAdded: { name: "Total Nonfarm Payrolls", unit: "Thousands" },
  gdp: { name: "Real GDP", unit: "Billions" },
  retailSales: { name: "Retail Sales", unit: "Millions" },
}

export default function EconomicAnalysisPage() {
  const [selectedSeries, setSelectedSeries] = useState<string>("unemployment")
  const [economicData, setEconomicData] = useState<EconomicSeries | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMovingAverages, setShowMovingAverages] = useState({
    ma3: true,
    ma6: true,
    ma12: true,
  })
  const [showProjections, setShowProjections] = useState(true)
  const [projectionMonths, setProjectionMonths] = useState(6)
  const { toast } = useToast()

  useEffect(() => {
    if (selectedSeries) {
      fetchEconomicData(selectedSeries)
    }
  }, [selectedSeries])

  const fetchEconomicData = async (series: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/economic-data?series=${series}&startYear=2014`)
      if (!response.ok) {
        throw new Error("Failed to fetch economic data")
      }

      const data = await response.json()
      setEconomicData(data)

      toast({
        title: "Data loaded successfully",
        description: `${data.seriesName} data loaded from ${data.source}`,
      })
    } catch (error) {
      console.error("Error fetching economic data:", error)
      toast({
        title: "Error loading data",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = () => {
    if (!economicData) return

    const csvContent = [
      "Date,Value,3M MA,6M MA,12M MA",
      ...economicData.data.map((point) => {
        const ma3 = calculateMovingAverage(economicData.data, point.date, 3)
        const ma6 = calculateMovingAverage(economicData.data, point.date, 6)
        const ma12 = calculateMovingAverage(economicData.data, point.date, 12)
        return `${point.date},${point.value},${ma3 || ""},${ma6 || ""},${ma12 || ""}`
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedSeries}_economic_data.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Data exported",
      description: "Economic data exported to CSV file",
    })
  }

  const calculateMovingAverage = (data: EconomicDataPoint[], targetDate: string, months: number): number | null => {
    const targetIndex = data.findIndex((d) => d.date === targetDate)
    if (targetIndex < months - 1) return null

    const values = data.slice(targetIndex - months + 1, targetIndex + 1).map((d) => d.value)
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Economic Data Analysis</h1>
              <p className="text-gray-600">Analyze US economic indicators with historical trends and projections</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            <Calendar className="h-4 w-4 mr-1" />
            United States
          </Badge>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Data Selection & Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Economic Indicator</label>
                <Select value={selectedSeries} onValueChange={setSelectedSeries}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AVAILABLE_SERIES).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Projection Period</label>
                <Select
                  value={projectionMonths.toString()}
                  onValueChange={(value) => setProjectionMonths(Number.parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 months</SelectItem>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Moving Averages</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ma3"
                      checked={showMovingAverages.ma3}
                      onCheckedChange={(checked) => setShowMovingAverages((prev) => ({ ...prev, ma3: !!checked }))}
                    />
                    <label htmlFor="ma3" className="text-sm">
                      3 months
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ma6"
                      checked={showMovingAverages.ma6}
                      onCheckedChange={(checked) => setShowMovingAverages((prev) => ({ ...prev, ma6: !!checked }))}
                    />
                    <label htmlFor="ma6" className="text-sm">
                      6 months
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="ma12"
                      checked={showMovingAverages.ma12}
                      onCheckedChange={(checked) => setShowMovingAverages((prev) => ({ ...prev, ma12: !!checked }))}
                    />
                    <label htmlFor="ma12" className="text-sm">
                      12 months
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Options</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="projections"
                      checked={showProjections}
                      onCheckedChange={(checked) => setShowProjections(!!checked)}
                    />
                    <label htmlFor="projections" className="text-sm">
                      Show Projections
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportData}
                    disabled={!economicData}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart and Data */}
        {economicData && (
          <EconomicChart
            data={economicData}
            showMovingAverages={showMovingAverages}
            showProjections={showProjections}
            projectionMonths={projectionMonths}
            loading={loading}
          />
        )}

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading economic data...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
