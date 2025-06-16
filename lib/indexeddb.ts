interface AssetPriceData {
  assetName: string
  ticker: string
  data: {
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[]
  dateRange: {
    start: string
    end: string
  }
  timestamp: number
  version: number
}

interface EventDataCache {
  eventId: string
  assetName: string
  eventDate: string
  data: {
    dates: string[]
    prices: number[]
    reindexed: number[]
    eventPrice: number
  }
  timestamp: number
  version: number
}

interface EventDataStore {
  eventId: string
  assetName: string
  eventDate: string
  data: any
  timestamp: number
  version: number
}

interface AssetFailureInfo {
  assetName: string
  ticker: string
  yahooAttempts: number
  githubAttempts: number
  lastYahooAttempt: number
  lastGithubAttempt: number
  yahooFailed: boolean
  githubFailed: boolean
  lastYahooError: string
  lastGithubError: string
  nextYahooRetryAvailable: string | null
  nextGithubRetryAvailable: string | null
}

class EventDataDB {
  private dbName = "MarketWizardEventData"
  private version = 3 // Increment version for schema changes
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create raw asset price data store
        if (!db.objectStoreNames.contains("assetPriceData")) {
          const assetStore = db.createObjectStore("assetPriceData", { keyPath: "assetName" })
          assetStore.createIndex("timestamp", "timestamp", { unique: false })
          assetStore.createIndex("ticker", "ticker", { unique: false })
        }

        // Create event data store
        if (!db.objectStoreNames.contains("eventData")) {
          const eventStore = db.createObjectStore("eventData", { keyPath: "id" })
          eventStore.createIndex("eventId", "eventId", { unique: false })
          eventStore.createIndex("assetName", "assetName", { unique: false })
          eventStore.createIndex("timestamp", "timestamp", { unique: false })
        }

        // Create bulk data store for initial loads
        if (!db.objectStoreNames.contains("bulkEventData")) {
          const bulkStore = db.createObjectStore("bulkEventData", { keyPath: "key" })
          bulkStore.createIndex("timestamp", "timestamp", { unique: false })
        }

        // Create failure tracking store
        if (!db.objectStoreNames.contains("assetFailures")) {
          const failureStore = db.createObjectStore("assetFailures", { keyPath: "assetName" })
          failureStore.createIndex("failed", "failed", { unique: false })
          failureStore.createIndex("lastAttempt", "lastAttempt", { unique: false })
        }
      }
    })
  }

  // Raw asset price data methods
  async storeAssetPriceData(
    assetName: string,
    ticker: string,
    data: any[],
    dateRange: { start: string; end: string },
  ): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetPriceData"], "readwrite")
      const store = transaction.objectStore("assetPriceData")

      const assetData: AssetPriceData = {
        assetName,
        ticker,
        data: data.map((row) => ({
          date: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume || 0,
        })),
        dateRange,
        timestamp: Date.now(),
        version: this.version,
      }

      const request = store.put(assetData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getAssetPriceData(assetName: string): Promise<AssetPriceData | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetPriceData"], "readonly")
      const store = transaction.objectStore("assetPriceData")
      const request = store.get(assetName)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        resolve(request.result || null)
      }
    })
  }

  async getAllAssetPriceData(): Promise<Record<string, AssetPriceData>> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetPriceData"], "readonly")
      const store = transaction.objectStore("assetPriceData")
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result
        const assetData: Record<string, AssetPriceData> = {}

        results.forEach((result) => {
          assetData[result.assetName] = result
        })

        resolve(assetData)
      }
    })
  }

  async isAssetDataFresh(assetName: string, maxAgeHours = 24): Promise<boolean> {
    const data = await this.getAssetPriceData(assetName)
    if (!data) return false

    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000
    return now - data.timestamp < maxAge
  }

  private generateKey(eventId: string, assetName: string): string {
    return `${eventId}_${assetName}`
  }

  async storeEventData(eventId: string, assetName: string, eventDate: string, data: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["eventData"], "readwrite")
      const store = transaction.objectStore("eventData")

      const eventData: EventDataStore = {
        eventId,
        assetName,
        eventDate,
        data,
        timestamp: Date.now(),
        version: this.version,
      }

      const request = store.put({
        id: this.generateKey(eventId, assetName),
        ...eventData,
      })

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getEventData(eventId: string, assetName: string): Promise<EventDataStore | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["eventData"], "readonly")
      const store = transaction.objectStore("eventData")
      const request = store.get(this.generateKey(eventId, assetName))

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          resolve({
            eventId: result.eventId,
            assetName: result.assetName,
            eventDate: result.eventDate,
            data: result.data,
            timestamp: result.timestamp,
            version: result.version,
          })
        } else {
          resolve(null)
        }
      }
    })
  }

  async getAllEventData(eventId: string): Promise<Record<string, EventDataStore>> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["eventData"], "readonly")
      const store = transaction.objectStore("eventData")
      const index = store.index("eventId")
      const request = index.getAll(eventId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result
        const eventData: Record<string, EventDataStore> = {}

        results.forEach((result) => {
          eventData[result.assetName] = {
            eventId: result.eventId,
            assetName: result.assetName,
            eventDate: result.eventDate,
            data: result.data,
            timestamp: result.timestamp,
            version: result.version,
          }
        })

        resolve(eventData)
      }
    })
  }

  async storeBulkEventData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["bulkEventData"], "readwrite")
      const store = transaction.objectStore("bulkEventData")

      const bulkData = {
        key,
        data,
        timestamp: Date.now(),
        version: this.version,
      }

      const request = store.put(bulkData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getBulkEventData(key: string): Promise<any | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["bulkEventData"], "readonly")
      const store = transaction.objectStore("bulkEventData")
      const request = store.get(key)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          resolve(result.data)
        } else {
          resolve(null)
        }
      }
    })
  }

  async isDataFresh(eventId: string, assetName: string, maxAgeHours = 1): Promise<boolean> {
    const data = await this.getEventData(eventId, assetName)
    if (!data) return false

    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000
    return now - data.timestamp < maxAge
  }

  async clearOldData(maxAgeHours = 24): Promise<void> {
    if (!this.db) await this.init()

    const cutoffTime = Date.now() - maxAgeHours * 60 * 60 * 1000

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["eventData", "bulkEventData"], "readwrite")

      // Clear old event data
      const eventStore = transaction.objectStore("eventData")
      const eventIndex = eventStore.index("timestamp")
      const eventRequest = eventIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))

      eventRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      // Clear old bulk data
      const bulkStore = transaction.objectStore("bulkEventData")
      const bulkIndex = bulkStore.index("timestamp")
      const bulkRequest = bulkIndex.openCursor(IDBKeyRange.upperBound(cutoffTime))

      bulkRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  // Asset failure tracking methods
  async storeGithubFailure(
    assetName: string,
    ticker: string,
    attempts: number,
    lastError: string,
    nextRetryAvailable: string | null = null,
  ): Promise<void> {
    if (!this.db) await this.init()

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(["assetFailures"], "readwrite")
      const store = transaction.objectStore("assetFailures")

      // Get existing failure info or create new
      const existingRequest = store.get(assetName)
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result || {
          assetName,
          ticker,
          yahooAttempts: 0,
          githubAttempts: 0,
          lastYahooAttempt: 0,
          lastGithubAttempt: 0,
          yahooFailed: false,
          githubFailed: false,
          lastYahooError: "",
          lastGithubError: "",
          nextYahooRetryAvailable: null,
          nextGithubRetryAvailable: null,
        }

        const failureInfo: AssetFailureInfo = {
          ...existing,
          githubAttempts: attempts,
          lastGithubAttempt: Date.now(),
          githubFailed: attempts >= 3,
          lastGithubError: lastError,
          nextGithubRetryAvailable: nextRetryAvailable,
        }

        const putRequest = store.put(failureInfo)
        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }
      existingRequest.onerror = () => reject(existingRequest.error)
    })
  }

  async storeYahooFailure(
    assetName: string,
    ticker: string,
    attempts: number,
    lastError: string,
    nextRetryAvailable: string | null = null,
  ): Promise<void> {
    if (!this.db) await this.init()

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(["assetFailures"], "readwrite")
      const store = transaction.objectStore("assetFailures")

      // Get existing failure info or create new
      const existingRequest = store.get(assetName)
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result || {
          assetName,
          ticker,
          yahooAttempts: 0,
          githubAttempts: 0,
          lastYahooAttempt: 0,
          lastGithubAttempt: 0,
          yahooFailed: false,
          githubFailed: false,
          lastYahooError: "",
          lastGithubError: "",
          nextYahooRetryAvailable: null,
          nextGithubRetryAvailable: null,
        }

        const failureInfo: AssetFailureInfo = {
          ...existing,
          yahooAttempts: attempts,
          lastYahooAttempt: Date.now(),
          yahooFailed: attempts >= 3,
          lastYahooError: lastError,
          nextYahooRetryAvailable: nextRetryAvailable,
        }

        const putRequest = store.put(failureInfo)
        putRequest.onerror = () => reject(putRequest.error)
        putRequest.onsuccess = () => resolve()
      }
      existingRequest.onerror = () => reject(existingRequest.error)
    })
  }

  async storeAssetFailure(
    assetName: string,
    ticker: string,
    attempts: number,
    lastError: string,
    nextRetryAvailable: string | null = null,
  ): Promise<void> {
    // This method is deprecated, use storeYahooFailure or storeGithubFailure instead
    return this.storeYahooFailure(assetName, ticker, attempts, lastError, nextRetryAvailable)
  }

  async getAssetFailure(assetName: string): Promise<AssetFailureInfo | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetFailures"], "readonly")
      const store = transaction.objectStore("assetFailures")
      const request = store.get(assetName)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        resolve(request.result || null)
      }
    })
  }

  async clearAssetFailure(assetName: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetFailures"], "readwrite")
      const store = transaction.objectStore("assetFailures")
      const request = store.delete(assetName)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getAllAssetFailures(): Promise<Record<string, AssetFailureInfo>> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetFailures"], "readonly")
      const store = transaction.objectStore("assetFailures")
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result
        const failures: Record<string, AssetFailureInfo> = {}

        results.forEach((result) => {
          failures[result.assetName] = result
        })

        resolve(failures)
      }
    })
  }

  async getStorageStats(): Promise<{
    assetDataCount: number
    eventDataCount: number
    bulkDataCount: number
    failureCount: number
  }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        ["assetPriceData", "eventData", "bulkEventData", "assetFailures"],
        "readonly",
      )

      let assetDataCount = 0
      let eventDataCount = 0
      let bulkDataCount = 0
      let failureCount = 0
      let completed = 0

      const checkComplete = () => {
        completed++
        if (completed === 4) {
          resolve({ assetDataCount, eventDataCount, bulkDataCount, failureCount })
        }
      }

      // Count asset price data
      const assetStore = transaction.objectStore("assetPriceData")
      const assetCountRequest = assetStore.count()
      assetCountRequest.onsuccess = () => {
        assetDataCount = assetCountRequest.result
        checkComplete()
      }
      assetCountRequest.onerror = () => reject(assetCountRequest.error)

      // Count event data
      const eventStore = transaction.objectStore("eventData")
      const eventCountRequest = eventStore.count()
      eventCountRequest.onsuccess = () => {
        eventDataCount = eventCountRequest.result
        checkComplete()
      }
      eventCountRequest.onerror = () => reject(eventCountRequest.error)

      // Count bulk data
      const bulkStore = transaction.objectStore("bulkEventData")
      const bulkCountRequest = bulkStore.count()
      bulkCountRequest.onsuccess = () => {
        bulkDataCount = bulkCountRequest.result
        checkComplete()
      }
      bulkCountRequest.onerror = () => reject(bulkCountRequest.error)

      // Count failures
      const failureStore = transaction.objectStore("assetFailures")
      const failureCountRequest = failureStore.count()
      failureCountRequest.onsuccess = () => {
        failureCount = failureCountRequest.result
        checkComplete()
      }
      failureCountRequest.onerror = () => reject(failureCountRequest.error)
    })
  }
}

// Export singleton instance
export const eventDataDB = new EventDataDB()

// Utility functions
export const ASSET_TICKERS = {
  "S&P 500": "^GSPC",
  "WTI Crude Oil": "CL=F",
  Gold: "GC=F",
  "Dollar Index": "DX-Y.NYB",
  "10Y Treasury Yield": "^TNX",
  VIX: "^VIX",
}

export const ASSET_NAMES = Object.keys(ASSET_TICKERS)

export async function preloadEventData(events: Array<{ id: string; date: string; name: string }>) {
  console.log(`Preloading data for ${events.length} events across ${ASSET_NAMES.length} assets`)

  const loadPromises: Promise<void>[] = []

  for (const event of events) {
    for (const assetName of ASSET_NAMES) {
      loadPromises.push(
        (async () => {
          try {
            // Check if we have fresh data
            const isFresh = await eventDataDB.isDataFresh(event.id, assetName, 1)
            if (isFresh) {
              console.log(`Using cached data for ${event.name} - ${assetName}`)
              return
            }

            // Fetch fresh data
            console.log(`Fetching fresh data for ${event.name} - ${assetName}`)
            const response = await fetch("/api/event-data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventDate: event.date,
                ticker: ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS],
              }),
            })

            if (response.ok) {
              const data = await response.json()
              const assetData = data.assets[assetName]

              if (assetData) {
                await eventDataDB.storeEventData(event.id, assetName, event.date, assetData)
                console.log(`Cached data for ${event.name} - ${assetName}`)
              }
            }
          } catch (error) {
            console.error(`Failed to preload ${event.name} - ${assetName}:`, error)
          }
        })(),
      )
    }
  }

  // Execute in batches to avoid overwhelming the API
  const batchSize = 6 // 6 assets at a time
  for (let i = 0; i < loadPromises.length; i += batchSize) {
    const batch = loadPromises.slice(i, i + batchSize)
    await Promise.all(batch)

    // Small delay between batches
    if (i + batchSize < loadPromises.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  console.log("Preloading completed")
}

// Refresh all asset data using GitHub first, then Yahoo Finance with retry limits
export const refreshAllAssetData = async () => {
  console.log("Refreshing all asset data with throttled GitHub and Yahoo Finance calls")

  const refreshPromises: Promise<void>[] = []
  const MAX_RETRIES = 3

  for (const assetName of ASSET_NAMES) {
    refreshPromises.push(
      (async () => {
        try {
          console.log(`Refreshing data for ${assetName}`)
          const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]

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

                  await eventDataDB.storeAssetPriceData(assetName, ticker, githubData.data, dateRange)
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
                console.log(`GitHub API limit reached for ${assetName}`)
              }
            } catch (githubError) {
              console.error(`GitHub failed for ${assetName}:`, githubError)
            }
          }

          // Try Yahoo Finance if GitHub failed or no data
          if (
            !githubSuccess &&
            (!failureInfo?.yahooFailed || Date.now() - failureInfo.lastYahooAttempt > 5 * 60 * 1000)
          ) {
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

                  const priceData = yahooData.data.map((row: any) => ({
                    date: row.Date,
                    open: row.Open,
                    high: row.High,
                    low: row.Low,
                    close: row.Close,
                    volume: row.Volume || 0,
                  }))

                  await eventDataDB.storeAssetPriceData(assetName, ticker, priceData, dateRange)
                  console.log(`Updated ${assetName} from Yahoo Finance: ${priceData.length} data points`)
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
                console.log(`Yahoo Finance API limit reached for ${assetName}`)
              }
            } catch (yahooError) {
              console.error(`Yahoo Finance failed for ${assetName}:`, yahooError)
            }
          }
        } catch (error) {
          console.error(`Failed to refresh ${assetName}:`, error)
        }
      })(),
    )
  }

  // Execute in batches to avoid overwhelming the APIs
  const batchSize = 2
  for (let i = 0; i < refreshPromises.length; i += batchSize) {
    const batch = refreshPromises.slice(i, i + batchSize)

    try {
      await Promise.allSettled(batch)
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error)
    }

    // Delay between batches
    if (i + batchSize < refreshPromises.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log("All asset data refresh completed with GitHub and Yahoo Finance throttling")
}
