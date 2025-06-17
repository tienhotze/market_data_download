"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Download, CheckCircle, AlertTriangle, Loader2, RefreshCw, Database } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { eventDataDB, ASSET_NAMES, ASSET_TICKERS } from "@/lib/indexeddb"

interface AssetLoadStatus {
  name: string
  ticker: string
  status: "not-loaded" | "loading" | "loaded" | "failed" | "stale"
  dataPoints: number
  lastUpdated: string | null
  error?: string
}

interface LoadedAssetDetails {
  name: string
  ticker: string
  firstPrice: number
  firstDate: string
  lastPrice: number
  lastDate: string
  dataPoints: number
  loadTime: string
}

export function AssetLoader() {
  const [assetStatuses, setAssetStatuses] = useState<AssetLoadStatus[]>([])
  const [loadedAssets, setLoadedAssets] = useState<LoadedAssetDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAsset, setLoadingAsset] = useState<string | null>(null)
  const [loadAllProgress, setLoadAllProgress] = useState(0)
  const [isLoadingAll, setIsLoadingAll] = useState(false)
  const { toast } = useToast()

  const getStatusBadge = (status: AssetLoadStatus["status"]) => {
    switch (status) {
      case "loaded":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Loaded
          </Badge>
        )
      case "loading":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Loading
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      case "stale":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <RefreshCw className="h-3 w-3 mr-1" />
            Stale
          </Badge>
        )
      case "not-loaded":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
            <Download className="h-3 w-3 mr-1" />
            Not Loaded
          </Badge>
        )
    }
  }

  const formatPrice = (price: number, assetName: string): string => {
    if (assetName === "10Y Treasury Yield" || assetName === "VIX") {
      return `${price.toFixed(2)}%`
    } else if (assetName === "Dollar Index") {
      return price.toFixed(3)
    } else {
      return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const getAssetStatus = (timestamp: number): "loaded" | "stale" => {
    const now = Date.now()
    const ageHours = (now - timestamp) / (1000 * 60 * 60)
    return ageHours < 6 ? "loaded" : "stale"
  }

  const loadAssetStatuses = async () => {
    try {
      const statuses: AssetLoadStatus[] = []
      const loadedDetails: LoadedAssetDetails[] = []
      const failures = await eventDataDB.getAllAssetFailures()

      for (const assetName of ASSET_NAMES) {
        const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
        const assetData = await eventDataDB.getAssetClosingPrices(assetName)
        const failureInfo = failures[assetName]

        if (assetData && assetData.closingPrices.length > 0) {
          const status = getAssetStatus(assetData.timestamp)
          const firstPrice = assetData.closingPrices[0]
          const lastPrice = assetData.closingPrices[assetData.closingPrices.length - 1]

          statuses.push({
            name: assetName,
            ticker,
            status,
            dataPoints: assetData.closingPrices.length,
            lastUpdated: calculateCacheAge(assetData.timestamp),
          })

          // Add to loaded assets details
          loadedDetails.push({
            name: assetName,
            ticker,
            firstPrice: firstPrice.close,
            firstDate: firstPrice.date,
            lastPrice: lastPrice.close,
            lastDate: lastPrice.date,
            dataPoints: assetData.closingPrices.length,
            loadTime: new Date(assetData.timestamp).toLocaleString(),
          })
        } else if (failureInfo && (failureInfo.yahooFailed || failureInfo.githubFailed)) {
          statuses.push({
            name: assetName,
            ticker,
            status: "failed",
            dataPoints: 0,
            lastUpdated: null,
            error: failureInfo.lastYahooError || failureInfo.lastGithubError || "API limit reached",
          })
        } else {
          statuses.push({
            name: assetName,
            ticker,
            status: "not-loaded",
            dataPoints: 0,
            lastUpdated: null,
          })
        }
      }

      setAssetStatuses(statuses)
      setLoadedAssets(loadedDetails)
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

  const loadSingleAsset = async (assetName: string) => {
    setLoadingAsset(assetName)

    // Update status to loading
    setAssetStatuses((prev) =>
      prev.map((asset) => (asset.name === assetName ? { ...asset, status: "loading" as const } : asset)),
    )

    try {
      const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]

      // Try GitHub first
      let success = false
      try {
        const githubResponse = await fetch("/api/check-repo-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        })

        if (githubResponse.ok) {
          const githubData = await githubResponse.json()
          if (githubData.data && githubData.data.length > 0) {
            const dateRange = {
              start: githubData.data[0].date,
              end: githubData.data[githubData.data.length - 1].date,
            }

            await eventDataDB.storeAssetClosingPrices(assetName, ticker, githubData.data, dateRange)
            success = true

            toast({
              title: "Asset Loaded",
              description: `${assetName} loaded from GitHub: ${githubData.data.length} closing prices`,
            })
          }
        }
      } catch (githubError) {
        console.error(`GitHub failed for ${assetName}:`, githubError)
      }

      // Try Yahoo Finance if GitHub failed
      if (!success) {
        try {
          const yahooResponse = await fetch("/api/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tickers: [ticker],
              period: "max",
              extraData: false,
            }),
          })

          if (yahooResponse.ok) {
            const yahooData = await yahooResponse.json()
            if (yahooData.data && yahooData.data.length > 0) {
              const dateRange = {
                start: yahooData.data[0].Date,
                end: yahooData.data[yahooData.data.length - 1].Date,
              }

              await eventDataDB.storeAssetClosingPrices(assetName, ticker, yahooData.data, dateRange)
              success = true

              toast({
                title: "Asset Loaded",
                description: `${assetName} loaded from Yahoo Finance: ${yahooData.data.length} closing prices`,
              })
            }
          }
        } catch (yahooError) {
          console.error(`Yahoo Finance failed for ${assetName}:`, yahooError)
        }
      }

      if (!success) {
        toast({
          title: "Load Failed",
          description: `Failed to load ${assetName} from both GitHub and Yahoo Finance`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Failed to load ${assetName}:`, error)
      toast({
        title: "Load Error",
        description: `Error loading ${assetName}: ${error}`,
        variant: "destructive",
      })
    } finally {
      setLoadingAsset(null)
      await loadAssetStatuses() // Refresh statuses
    }
  }

  // MODIFIED: Synchronous bulk loading without delays
  const loadAllAssets = () => {
    setIsLoadingAll(true)
    setLoadAllProgress(0)

    const notLoadedAssets = assetStatuses.filter((asset) => asset.status === "not-loaded" || asset.status === "failed")

    // Create array of promises for parallel execution
    const loadPromises = notLoadedAssets.map((asset, index) => {
      return loadSingleAsset(asset.name).then(() => {
        // Update progress synchronously
        const progress = ((index + 1) / notLoadedAssets.length) * 100
        setLoadAllProgress(progress)
      })
    })

    // Execute all loads in parallel (synchronously initiated)
    Promise.all(loadPromises)
      .then(() => {
        setIsLoadingAll(false)
        setLoadAllProgress(0)

        // Success notification with cache update confirmation
        toast({
          title: "Cache Updated Successfully! 🎉",
          description: `Successfully loaded ${notLoadedAssets.length} assets. All closing prices are now cached and ready for analysis.`,
          duration: 5000,
        })
      })
      .catch((error) => {
        console.error("Bulk load error:", error)
        setIsLoadingAll(false)
        setLoadAllProgress(0)

        toast({
          title: "Bulk Load Completed with Errors",
          description: `Some assets may have failed to load. Check individual asset status for details.`,
          variant: "destructive",
        })
      })
  }

  useEffect(() => {
    loadAssetStatuses()
  }, [])

  const notLoadedCount = assetStatuses.filter((asset) => asset.status === "not-loaded").length
  const loadedCount = assetStatuses.filter((asset) => asset.status === "loaded").length
  const staleCount = assetStatuses.filter((asset) => asset.status === "stale").length
  const failedCount = assetStatuses.filter((asset) => asset.status === "failed").length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Asset Data Loader</CardTitle>
              <CardDescription>Load closing price data for individual assets or all at once</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadAssetStatuses} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                onClick={loadAllAssets}
                disabled={isLoadingAll || notLoadedCount === 0}
                variant="default"
                size="sm"
              >
                {isLoadingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading All ({Math.round(loadAllProgress)}%)
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Load All ({notLoadedCount})
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading asset status...</span>
            </div>
          ) : (
            <>
              {/* Progress bar for bulk loading */}
              {isLoadingAll && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Loading all assets in parallel...</span>
                    <span className="text-sm text-gray-500">{Math.round(loadAllProgress)}%</span>
                  </div>
                  <Progress value={loadAllProgress} className="w-full" />
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{loadedCount}</div>
                  <div className="text-sm text-gray-600">Loaded</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{staleCount}</div>
                  <div className="text-sm text-gray-600">Stale</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{failedCount}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{notLoadedCount}</div>
                  <div className="text-sm text-gray-600">Not Loaded</div>
                </div>
              </div>

              {/* Asset Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assetStatuses.map((asset) => (
                  <div key={asset.name} className="border rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{asset.name}</h3>
                        <p className="text-xs text-gray-500">{asset.ticker}</p>
                      </div>
                      {getStatusBadge(asset.status)}
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Closing Prices:</span>
                        <span className="font-medium">{asset.dataPoints.toLocaleString()}</span>
                      </div>
                      {asset.lastUpdated && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Last Updated:</span>
                          <span className="font-medium">{asset.lastUpdated}</span>
                        </div>
                      )}
                      {asset.error && (
                        <div className="text-xs text-red-600 mt-1" title={asset.error}>
                          {asset.error.length > 40 ? `${asset.error.substring(0, 40)}...` : asset.error}
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => loadSingleAsset(asset.name)}
                      disabled={loadingAsset === asset.name || isLoadingAll}
                      variant={asset.status === "loaded" ? "outline" : "default"}
                      size="sm"
                      className="w-full"
                    >
                      {loadingAsset === asset.name ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : asset.status === "loaded" || asset.status === "stale" ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-2" />
                          Refresh
                        </>
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-2" />
                          Load Data
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Loaded Assets Status Table */}
      {loadedAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cached Asset Price Data
            </CardTitle>
            <CardDescription>Detailed view of loaded closing prices with first/last price information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-32">Asset</TableHead>
                    <TableHead className="text-right min-w-24">First Price</TableHead>
                    <TableHead className="text-center min-w-24">First Date</TableHead>
                    <TableHead className="text-right min-w-24">Last Price</TableHead>
                    <TableHead className="text-center min-w-24">Last Date</TableHead>
                    <TableHead className="text-center min-w-20">Data Points</TableHead>
                    <TableHead className="text-center min-w-32">Cache Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadedAssets.map((asset) => (
                    <TableRow key={asset.name}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{asset.name}</div>
                          <div className="text-xs text-gray-500">{asset.ticker}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatPrice(asset.firstPrice, asset.name)}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {new Date(asset.firstDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPrice(asset.lastPrice, asset.name)}</TableCell>
                      <TableCell className="text-center text-sm">
                        {new Date(asset.lastDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {asset.dataPoints.toLocaleString()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-600">{asset.loadTime}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Summary at bottom */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Cache Status: {loadedAssets.length} assets loaded with{" "}
                    {loadedAssets.reduce((sum, asset) => sum + asset.dataPoints, 0).toLocaleString()} total closing
                    prices
                  </span>
                </div>
                <div className="text-xs text-green-600">Last updated: {new Date().toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
