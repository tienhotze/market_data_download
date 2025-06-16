"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { eventDataDB, ASSET_NAMES, ASSET_TICKERS, refreshAllAssetData } from "@/lib/indexeddb"

interface AssetStatus {
  name: string
  ticker: string
  lastPrice: number | null
  lastDate: string | null
  dataPoints: number
  cacheAge: string
  status: "fresh" | "stale" | "missing"
}

export function AssetStatusTable() {
  const [assetStatuses, setAssetStatuses] = useState<AssetStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string>("")
  const { toast } = useToast()

  const formatPrice = (price: number | null, assetName: string): string => {
    if (price === null) return "N/A"

    if (assetName === "10Y Treasury Yield" || assetName === "VIX") {
      return `${price.toFixed(2)}%`
    } else if (assetName === "Dollar Index") {
      return price.toFixed(3)
    } else {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
  }

  const getStatusBadge = (status: "fresh" | "stale" | "missing") => {
    switch (status) {
      case "fresh":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Fresh
          </Badge>
        )
      case "stale":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Stale
          </Badge>
        )
      case "missing":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Missing
          </Badge>
        )
    }
  }

  const calculateCacheAge = (timestamp: number): string => {
    const now = Date.now()
    const ageMs = now - timestamp
    const ageHours = ageMs / (1000 * 60 * 60)

    if (ageHours < 1) {
      const ageMinutes = Math.floor(ageMs / (1000 * 60))
      return `${ageMinutes}m ago`
    } else if (ageHours < 24) {
      return `${Math.floor(ageHours)}h ago`
    } else {
      const ageDays = Math.floor(ageHours / 24)
      return `${ageDays}d ago`
    }
  }

  const getStatus = (timestamp: number): "fresh" | "stale" | "missing" => {
    const now = Date.now()
    const ageHours = (now - timestamp) / (1000 * 60 * 60)

    if (ageHours < 6) return "fresh"
    if (ageHours < 24) return "stale"
    return "missing"
  }

  const loadAssetStatuses = async () => {
    try {
      const statuses: AssetStatus[] = []

      for (const assetName of ASSET_NAMES) {
        const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
        const assetData = await eventDataDB.getAssetPriceData(assetName)

        if (assetData && assetData.data.length > 0) {
          const lastDataPoint = assetData.data[assetData.data.length - 1]
          const status = getStatus(assetData.timestamp)

          statuses.push({
            name: assetName,
            ticker,
            lastPrice: lastDataPoint.close,
            lastDate: lastDataPoint.date,
            dataPoints: assetData.data.length,
            cacheAge: calculateCacheAge(assetData.timestamp),
            status,
          })
        } else {
          statuses.push({
            name: assetName,
            ticker,
            lastPrice: null,
            lastDate: null,
            dataPoints: 0,
            cacheAge: "Never",
            status: "missing",
          })
        }
      }

      setAssetStatuses(statuses)
    } catch (error) {
      console.error("Failed to load asset statuses:", error)
      toast({
        title: "Error",
        description: "Failed to load asset status information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshCache = async () => {
    setRefreshing(true)
    const startTime = Date.now()

    try {
      toast({
        title: "Refreshing Cache",
        description: "Updating asset data from GitHub and Yahoo Finance...",
      })

      await refreshAllAssetData()
      await loadAssetStatuses()

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      setLastRefresh(new Date().toLocaleTimeString())

      toast({
        title: "Cache Refreshed",
        description: `Successfully updated all asset data in ${duration}s`,
      })
    } catch (error) {
      console.error("Failed to refresh cache:", error)
      toast({
        title: "Refresh Failed",
        description: "Some assets may not have been updated. Check console for details.",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAssetStatuses()
  }, [])

  const totalDataPoints = assetStatuses.reduce((sum, asset) => sum + asset.dataPoints, 0)
  const freshCount = assetStatuses.filter((asset) => asset.status === "fresh").length
  const staleCount = assetStatuses.filter((asset) => asset.status === "stale").length
  const missingCount = assetStatuses.filter((asset) => asset.status === "missing").length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Asset Data Status
              {lastRefresh && <span className="text-sm font-normal text-gray-500">Last refreshed: {lastRefresh}</span>}
            </CardTitle>
            <CardDescription>Current cache status and latest prices for all tracked assets</CardDescription>
          </div>
          <Button onClick={handleRefreshCache} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh Cache"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading asset status...</span>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{totalDataPoints.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Data Points</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{freshCount}</div>
                <div className="text-sm text-gray-600">Fresh Assets</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{staleCount}</div>
                <div className="text-sm text-gray-600">Stale Assets</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{missingCount}</div>
                <div className="text-sm text-gray-600">Missing Assets</div>
              </div>
            </div>

            {/* Asset Status Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Asset</TableHead>
                    <TableHead className="text-center min-w-24">Status</TableHead>
                    <TableHead className="text-right min-w-28">Last Price</TableHead>
                    <TableHead className="text-center min-w-24">Last Date</TableHead>
                    <TableHead className="text-center min-w-20">Data Points</TableHead>
                    <TableHead className="text-center min-w-20">Cache Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetStatuses.map((asset) => (
                    <TableRow key={asset.name}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{asset.name}</div>
                          <div className="text-xs text-gray-500">{asset.ticker}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(asset.status)}</TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(asset.lastPrice, asset.name)}</TableCell>
                      <TableCell className="text-center">
                        {asset.lastDate ? new Date(asset.lastDate).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell className="text-center">{asset.dataPoints.toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`text-sm ${
                            asset.status === "fresh"
                              ? "text-green-600"
                              : asset.status === "stale"
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {asset.cacheAge}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Warning for stale data */}
            {(staleCount > 0 || missingCount > 0) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    {missingCount > 0 ? `${missingCount} asset(s) missing data. ` : ""}
                    {staleCount > 0 ? `${staleCount} asset(s) have stale data. ` : ""}
                    Consider refreshing the cache for the latest market data.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
