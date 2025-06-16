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
  status: "fresh" | "stale" | "missing" | "yahoo-failed" | "github-failed" | "both-failed"
  failureInfo?: {
    yahooAttempts: number
    githubAttempts: number
    lastYahooError: string
    lastGithubError: string
    nextYahooRetryAvailable: string | null
    nextGithubRetryAvailable: string | null
  }
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

  const getStatusBadge = (status: "fresh" | "stale" | "missing" | "yahoo-failed" | "github-failed" | "both-failed") => {
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
      case "yahoo-failed":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Yahoo Failed
          </Badge>
        )
      case "github-failed":
        return (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            GitHub Failed
          </Badge>
        )
      case "both-failed":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Both Failed
          </Badge>
        )
      case "missing":
        return (
          <Badge variant="destructive" className="bg-gray-100 text-gray-800 border-gray-200">
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
      const failures = await eventDataDB.getAllAssetFailures()

      for (const assetName of ASSET_NAMES) {
        const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
        // Get closing prices data instead of full price data
        const assetData = await eventDataDB.getAssetClosingPrices(assetName)
        const failureInfo = failures[assetName]

        let status: AssetStatus["status"] = "missing"
        let failureDetails = undefined

        if (failureInfo) {
          const yahooFailed = failureInfo.yahooFailed || false
          const githubFailed = failureInfo.githubFailed || false

          if (yahooFailed && githubFailed) {
            status = "both-failed"
          } else if (yahooFailed) {
            status = "yahoo-failed"
          } else if (githubFailed) {
            status = "github-failed"
          }

          if (yahooFailed || githubFailed) {
            failureDetails = {
              yahooAttempts: failureInfo.yahooAttempts || 0,
              githubAttempts: failureInfo.githubAttempts || 0,
              lastYahooError: failureInfo.lastYahooError || "",
              lastGithubError: failureInfo.lastGithubError || "",
              nextYahooRetryAvailable: failureInfo.nextYahooRetryAvailable,
              nextGithubRetryAvailable: failureInfo.nextGithubRetryAvailable,
            }
          }
        }

        if (assetData && assetData.closingPrices.length > 0 && status === "missing") {
          const lastPrice = assetData.closingPrices[assetData.closingPrices.length - 1]
          const lastDate = assetData.dates[assetData.dates.length - 1]
          status = getStatus(assetData.timestamp)

          statuses.push({
            name: assetName,
            ticker,
            lastPrice,
            lastDate,
            dataPoints: assetData.closingPrices.length,
            cacheAge: calculateCacheAge(assetData.timestamp),
            status,
            failureInfo: failureDetails,
          })
        } else {
          statuses.push({
            name: assetName,
            ticker,
            lastPrice: null,
            lastDate: null,
            dataPoints: assetData?.closingPrices.length || 0,
            cacheAge: failureInfo
              ? `Failed ${calculateCacheAge(Math.max(failureInfo.lastYahooAttempt || 0, failureInfo.lastGithubAttempt || 0))}`
              : "Never",
            status,
            failureInfo: failureDetails,
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
        description: "Updating asset closing prices from GitHub and Yahoo Finance...",
      })

      await refreshAllAssetData()
      await loadAssetStatuses()

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      setLastRefresh(new Date().toLocaleTimeString())

      toast({
        title: "Cache Refreshed",
        description: `Successfully updated closing prices in ${duration}s`,
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
  const yahooFailedCount = assetStatuses.filter((asset) => asset.status === "yahoo-failed").length
  const githubFailedCount = assetStatuses.filter((asset) => asset.status === "github-failed").length
  const bothFailedCount = assetStatuses.filter((asset) => asset.status === "both-failed").length
  const totalFailedCount = yahooFailedCount + githubFailedCount + bothFailedCount

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Asset Closing Prices Status
              {lastRefresh && <span className="text-sm font-normal text-gray-500">Last refreshed: {lastRefresh}</span>}
            </CardTitle>
            <CardDescription>Current cache status and latest closing prices for all tracked assets</CardDescription>
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{totalDataPoints.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Closing Prices</div>
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
                <div className="text-2xl font-bold text-red-600">{yahooFailedCount}</div>
                <div className="text-sm text-gray-600">Yahoo Failed</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{githubFailedCount}</div>
                <div className="text-sm text-gray-600">GitHub Failed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{missingCount}</div>
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
                    <TableHead className="text-center min-w-20">Closing Prices</TableHead>
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
                          {asset.failureInfo && (
                            <div className="text-xs mt-1 space-y-1">
                              {asset.failureInfo.yahooAttempts > 0 && (
                                <div className="text-red-600">Yahoo: {asset.failureInfo.yahooAttempts}/3 attempts</div>
                              )}
                              {asset.failureInfo.githubAttempts > 0 && (
                                <div className="text-orange-600">
                                  GitHub: {asset.failureInfo.githubAttempts}/3 attempts
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(asset.status)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {asset.status === "yahoo-failed" ||
                        asset.status === "github-failed" ||
                        asset.status === "both-failed" ? (
                          <span className="text-red-600 text-sm">API Limit</span>
                        ) : (
                          formatPrice(asset.lastPrice, asset.name)
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {asset.lastDate ? new Date(asset.lastDate).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col">
                          <span className="font-medium">{asset.dataPoints.toLocaleString()}</span>
                          <span className="text-xs text-gray-500">prices cached</span>
                        </div>
                      </TableCell>
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
                        {asset.failureInfo && asset.failureInfo.lastYahooError && (
                          <div className="text-xs text-red-600 mt-1" title={asset.failureInfo.lastYahooError}>
                            {asset.failureInfo.lastYahooError.length > 30
                              ? `${asset.failureInfo.lastYahooError.substring(0, 30)}...`
                              : asset.failureInfo.lastYahooError}
                          </div>
                        )}
                        {asset.failureInfo && asset.failureInfo.lastGithubError && (
                          <div className="text-xs text-orange-600 mt-1" title={asset.failureInfo.lastGithubError}>
                            {asset.failureInfo.lastGithubError.length > 30
                              ? `${asset.failureInfo.lastGithubError.substring(0, 30)}...`
                              : asset.failureInfo.lastGithubError}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Warning for stale/failed data */}
            {(staleCount > 0 || missingCount > 0 || totalFailedCount > 0) && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    {bothFailedCount > 0 ? `${bothFailedCount} asset(s) failed on both APIs. ` : ""}
                    {yahooFailedCount > 0 ? `${yahooFailedCount} asset(s) failed on Yahoo Finance. ` : ""}
                    {githubFailedCount > 0 ? `${githubFailedCount} asset(s) failed on GitHub API. ` : ""}
                    {missingCount > 0 ? `${missingCount} asset(s) missing data. ` : ""}
                    {staleCount > 0 ? `${staleCount} asset(s) have stale data. ` : ""}
                    {totalFailedCount > 0
                      ? "Failed assets are in cooldown period. Try refreshing later."
                      : "Consider refreshing the cache for the latest closing prices."}
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
