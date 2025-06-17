"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, Database } from "lucide-react"
import { eventDataDB, refreshAllAssetData, ASSET_NAMES } from "@/lib/indexeddb"
import { AssetLoader } from "@/components/asset-loader"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"

export default function AssetDataPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [assetLoadStatus, setAssetLoadStatus] = useState<string>("")
  const [assetLoaderKey, setAssetLoaderKey] = useState(0)

  // Initialize database on page load
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Clear old data (older than 24 hours)
        await eventDataDB.clearOldData(24)

        // Get storage stats
        const stats = await eventDataDB.getStorageStats()
        console.log(`IndexedDB stats: ${stats.eventDataCount} event records, ${stats.bulkDataCount} bulk records`)
        setAssetLoadStatus(`Database initialized: ${stats.assetDataCount}/${ASSET_NAMES.length} assets cached`)

        toast({
          title: "Database Initialized",
          description: `Ready to manage asset data. ${stats.assetDataCount} assets already cached.`,
        })
      } catch (error) {
        console.error("Failed to initialize asset data:", error)
        setAssetLoadStatus("Failed to initialize database")
        toast({
          title: "Initialization Error",
          description: "Failed to initialize database. Some features may not work.",
          variant: "destructive",
        })
      }
    }

    initializeData()
  }, [toast])

  // Function to refresh a single asset
  const refreshSingleAsset = async (assetName: string) => {
    const ASSET_TICKERS = {
      "S&P 500": "^GSPC",
      "WTI Crude Oil": "CL=F",
      Gold: "GC=F",
      "Dollar Index": "DX-Y.NYB",
      "10Y Treasury Yield": "^TNX",
      VIX: "^VIX",
    }

    const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
    if (!ticker) return

    // Check if asset has failed recently
    const failureInfo = await eventDataDB.getAssetFailure(assetName)
    if (failureInfo) {
      const now = Date.now()
      const cooldownPeriod = 5 * 60 * 1000 // 5 minutes

      const yahooInCooldown = failureInfo.yahooFailed && now - failureInfo.lastYahooAttempt < cooldownPeriod
      const githubInCooldown = failureInfo.githubFailed && now - failureInfo.lastGithubAttempt < cooldownPeriod

      if (yahooInCooldown && githubInCooldown) {
        console.log(`Skipping ${assetName} - both APIs in cooldown period`)
        return
      }

      // Clear old failure info after cooldown
      if (!yahooInCooldown && !githubInCooldown) {
        await eventDataDB.clearAssetFailure(assetName)
      }
    }

    // Try GitHub first
    let githubSuccess = false
    if (!failureInfo?.githubFailed || Date.now() - failureInfo.lastGithubAttempt > 5 * 60 * 1000) {
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
            githubSuccess = true
            console.log(`Updated ${assetName} from GitHub: ${githubData.data.length} data points`)
          }
        } else if (githubResponse.status === 429) {
          const errorData = await githubResponse.json()
          await eventDataDB.storeGithubFailure(
            assetName,
            ticker,
            errorData.retryInfo.attempts,
            errorData.error,
            errorData.retryInfo.nextRetryAvailable,
          )
        }
      } catch (githubError) {
        console.error(`GitHub failed for ${assetName}:`, githubError)
      }
    }

    // Try Yahoo Finance if GitHub failed
    if (!githubSuccess && (!failureInfo?.yahooFailed || Date.now() - failureInfo.lastYahooAttempt > 5 * 60 * 1000)) {
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
            console.log(`Updated ${assetName} from Yahoo Finance: ${yahooData.data.length} data points`)
          }
        } else if (yahooResponse.status === 429) {
          const errorData = await yahooResponse.json()
          await eventDataDB.storeYahooFailure(
            assetName,
            ticker,
            errorData.retryInfo.attempts,
            errorData.error,
            errorData.retryInfo.nextRetryAvailable,
          )
        }
      } catch (yahooError) {
        console.error(`Yahoo Finance failed for ${assetName}:`, yahooError)
      }
    }
  }

  const handleLoadAllAssets = async () => {
    setLoadingAssets(true)
    setAssetLoadStatus("Loading all asset data...")

    try {
      // Check if we have recent asset data (less than 24 hours old)
      const assetDataPromises = ASSET_NAMES.map(async (assetName) => {
        const isFresh = await eventDataDB.isAssetDataFresh(assetName, 24)
        return { assetName, isFresh }
      })

      const assetFreshness = await Promise.all(assetDataPromises)
      const staleAssets = assetFreshness.filter((asset) => !asset.isFresh)

      if (staleAssets.length === 0) {
        setAssetLoadStatus(`All ${ASSET_NAMES.length} assets have fresh data (< 24 hours old)`)
        toast({
          title: "Asset Data Ready",
          description: `All ${ASSET_NAMES.length} assets have fresh cached data.`,
        })
      } else {
        setAssetLoadStatus(`Loading ${staleAssets.length} assets with stale data...`)

        // Load stale assets
        let loadedCount = 0
        const loadPromises = staleAssets.map(async ({ assetName }) => {
          try {
            setAssetLoadStatus(`Loading ${assetName}... (${loadedCount + 1}/${staleAssets.length})`)

            // Try to refresh this specific asset
            await refreshSingleAsset(assetName)
            loadedCount++

            setAssetLoadStatus(`Loaded ${assetName} (${loadedCount}/${staleAssets.length})`)
          } catch (error) {
            console.error(`Failed to load ${assetName}:`, error)
            setAssetLoadStatus(`Failed to load ${assetName}, continuing...`)
          }
        })

        await Promise.allSettled(loadPromises)

        // Final status check
        const finalStats = await eventDataDB.getStorageStats()
        setAssetLoadStatus(`Completed: ${finalStats.assetDataCount}/${ASSET_NAMES.length} assets cached`)

        toast({
          title: "Asset Data Loaded",
          description: `Loaded ${loadedCount}/${staleAssets.length} stale assets. ${finalStats.assetDataCount} total assets cached.`,
        })
      }
    } catch (error) {
      console.error("Failed to load asset data:", error)
      setAssetLoadStatus("Failed to load asset data")
      toast({
        title: "Load Error",
        description: "Failed to load asset data. Some features may not work properly.",
        variant: "destructive",
      })
    } finally {
      setLoadingAssets(false)
      // Trigger AssetLoader refresh
      setAssetLoaderKey((prev) => prev + 1)
    }
  }

  const handleRefreshAllAssets = async () => {
    setLoadingAssets(true)
    setAssetLoadStatus("Refreshing all asset data...")

    try {
      await refreshAllAssetData()
      const stats = await eventDataDB.getStorageStats()
      setAssetLoadStatus(`Refreshed all assets: ${stats.assetDataCount}/${ASSET_NAMES.length} cached`)

      toast({
        title: "Assets Refreshed",
        description: `All asset data has been refreshed. ${stats.assetDataCount} assets now cached.`,
      })
    } catch (error) {
      console.error("Failed to refresh all assets:", error)
      setAssetLoadStatus("Failed to refresh asset data")
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh asset data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAssets(false)
      // Trigger AssetLoader refresh
      setAssetLoaderKey((prev) => prev + 1)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button onClick={() => router.push("/event-analysis")} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Event Analysis
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="h-8 w-8" />
                Asset Data Management
              </h1>
              <p className="text-lg text-gray-600">Load and manage historical price data for market analysis</p>
            </div>
          </div>
        </header>

        {/* Asset Loading Status */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Asset Data Status
                </span>
                <div className="flex gap-2">
                  <Button onClick={handleLoadAllAssets} variant="default" size="sm" disabled={loadingAssets}>
                    {loadingAssets ? "Loading..." : "Load All Stale Assets"}
                  </Button>
                  <Button onClick={handleRefreshAllAssets} variant="outline" size="sm" disabled={loadingAssets}>
                    {loadingAssets ? "Loading..." : "Force Refresh All"}
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Manage historical price data for all assets. Load stale data or force refresh all assets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {loadingAssets && (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-600">Loading...</span>
                  </div>
                )}
                <span className="text-sm text-gray-600">{assetLoadStatus}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Asset Loader Component */}
        <div className="mb-8">
          <AssetLoader key={assetLoaderKey} />
        </div>

        <Toaster />
      </div>
    </div>
  )
}
