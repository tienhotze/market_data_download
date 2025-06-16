"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Download, CheckCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react"
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

export function AssetLoader() {
  const [assetStatuses, setAssetStatuses] = useState<AssetLoadStatus[]>([])
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
      const failures = await eventDataDB.getAllAssetFailures()

      for (const assetName of ASSET_NAMES) {
        const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
        const assetData = await eventDataDB.getAssetClosingPrices(assetName)
        const failureInfo = failures[assetName]

        if (assetData && assetData.closingPrices.length > 0) {
          const status = getAssetStatus(assetData.timestamp)
          statuses.push({
            name: assetName,
            ticker,
            status,
            dataPoints: assetData.closingPrices.length,
            lastUpdated: calculateCacheAge(assetData.timestamp),
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

  const loadAllAssets = async () => {
    setIsLoadingAll(true)
    setLoadAllProgress(0)

    const notLoadedAssets = assetStatuses.filter((asset) => asset.status === "not-loaded" || asset.status === "failed")

    for (let i = 0; i < notLoadedAssets.length; i++) {
      const asset = notLoadedAssets[i]
      await loadSingleAsset(asset.name)
      setLoadAllProgress(((i + 1) / notLoadedAssets.length) * 100)

      // Small delay between loads
      if (i < notLoadedAssets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    setIsLoadingAll(false)
    setLoadAllProgress(0)

    toast({
      title: "Bulk Load Complete",
      description: `Attempted to load ${notLoadedAssets.length} assets`,
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
            <Button onClick={loadAllAssets} disabled={isLoadingAll || notLoadedCount === 0} variant="default" size="sm">
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
                  <span className="text-sm font-medium">Loading all assets...</span>
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
  )
}
