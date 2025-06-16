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

class EventDataDB {
  private dbName = "MarketWizardEventData"
  private version = 2 // Increment version for schema changes
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

  async getStorageStats(): Promise<{ assetDataCount: number; eventDataCount: number; bulkDataCount: number }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["assetPriceData", "eventData", "bulkEventData"], "readonly")

      let assetDataCount = 0
      let eventDataCount = 0
      let bulkDataCount = 0
      let completed = 0

      const checkComplete = () => {
        completed++
        if (completed === 3) {
          resolve({ assetDataCount, eventDataCount, bulkDataCount })
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

// Refresh all asset data using GitHub first, then Yahoo Finance
export const refreshAllAssetData = async () => {
  console.log("Refreshing all asset data with latest available data")

  const refreshPromises: Promise<void>[] = []

  for (const assetName of ASSET_NAMES) {
    refreshPromises.push(
      (async () => {
        try {
          console.log(`Refreshing data for ${assetName}`)
          const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]

          // Try to get data from GitHub first, then Yahoo Finance
          const response = await fetch("/api/asset-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticker,
              assetName,
              maxData: true,
              forceRefresh: true,
            }),
          })

          if (response.ok) {
            const data = await response.json()

            if (data.priceData && data.priceData.length > 0) {
              const dateRange = {
                start: data.priceData[0].date,
                end: data.priceData[data.priceData.length - 1].date,
              }

              await eventDataDB.storeAssetPriceData(assetName, ticker, data.priceData, dateRange)
              console.log(
                `Updated cache for ${assetName}: ${data.priceData.length} data points (${dateRange.start} to ${dateRange.end})`,
              )
            } else {
              console.log(`No price data received for ${assetName}`)
            }
          } else {
            const errorText = await response.text()
            console.error(`Failed to refresh data for ${assetName}:`, response.status, errorText)
          }
        } catch (error) {
          console.error(`Failed to refresh ${assetName}:`, error)
        }
      })(),
    )
  }

  // Execute in batches to avoid overwhelming the API
  const batchSize = 2 // Conservative batch size
  for (let i = 0; i < refreshPromises.length; i += batchSize) {
    const batch = refreshPromises.slice(i, i + batchSize)

    try {
      await Promise.allSettled(batch)
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error)
    }

    // Delay between batches
    if (i + batchSize < refreshPromises.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  console.log("All asset data refresh completed")
}
