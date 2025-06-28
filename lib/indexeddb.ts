interface AssetPriceData {
  assetName: string
  ticker: string
  closingPrices: {
    date: string
    close: number
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
  private version = 4 // Increment version for schema changes
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

        // Create raw asset price data store (closing prices only)
        if (!db.objectStoreNames.contains("assetPriceData")) {
          const assetStore = db.createObjectStore("assetPriceData", { keyPath: "assetName" })
          assetStore.createIndex("timestamp", "timestamp", { unique: false })
          assetStore.createIndex("ticker", "ticker", { unique: false })
        }

        // Create computed event data store (calculated on demand)
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

  // Store only closing prices to save space
  async storeAssetClosingPrices(
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
        closingPrices: data.map((row) => ({
          date: row.date || row.Date,
          close: row.close || row.Close || row["Adj Close"],
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

  // Legacy method for backward compatibility
  async storeAssetPriceData(
    assetName: string,
    ticker: string,
    data: any[],
    dateRange: { start: string; end: string },
  ): Promise<void> {
    return this.storeAssetClosingPrices(assetName, ticker, data, dateRange)
  }

  async getAssetClosingPrices(assetName: string): Promise<AssetPriceData | null> {
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

  // Legacy method for backward compatibility
  async getAssetPriceData(assetName: string): Promise<AssetPriceData | null> {
    return this.getAssetClosingPrices(assetName)
  }

  async getAllAssetClosingPrices(): Promise<Record<string, AssetPriceData>> {
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

  // Legacy method for backward compatibility
  async getAllAssetPriceData(): Promise<Record<string, AssetPriceData>> {
    return this.getAllAssetClosingPrices()
  }

  async isAssetDataFresh(assetName: string, maxAgeHours = 24): Promise<boolean> {
    const data = await this.getAssetClosingPrices(assetName)
    if (!data) return false

    const now = Date.now()
    const maxAge = maxAgeHours * 60 * 60 * 1000
    return now - data.timestamp < maxAge
  }

  // Calculate reindexed data on-demand from closing prices with detailed debugging
  async calculateEventData(
    eventId: string,
    assetName: string,
    eventDate: string,
    daysBeforeEvent = 30,
    daysAfterEvent = 60,
  ): Promise<{
    dates: string[]
    prices: number[]
    reindexed: number[]
    eventPrice: number
  } | null> {
    console.log(`🔍 [calculateEventData] Starting calculation for ${assetName}`)
    console.log(`   Event: ${eventId}, Date: ${eventDate}`)
    console.log(`   Range: -${daysBeforeEvent} to +${daysAfterEvent} days`)

    try {
      // Step 1: Get cached closing prices
      console.log(`📊 [calculateEventData] Fetching cached closing prices for ${assetName}`)
      const assetData = await this.getAssetClosingPrices(assetName)

      if (!assetData) {
        console.log(`❌ [calculateEventData] No cached closing prices found for ${assetName}`)
        return null
      }

      console.log(`✅ [calculateEventData] Found cached data for ${assetName}:`)
      console.log(`   Total closing prices: ${assetData.closingPrices.length}`)
      console.log(`   Date range: ${assetData.dateRange.start} to ${assetData.dateRange.end}`)
      console.log(`   Data age: ${Math.round((Date.now() - assetData.timestamp) / (1000 * 60 * 60))} hours`)

      // Step 2: Calculate date range for event analysis
      const eventDateObj = new Date(eventDate)
      const startDate = new Date(eventDateObj)
      startDate.setDate(startDate.getDate() - daysBeforeEvent)
      const endDate = new Date(eventDateObj)
      endDate.setDate(endDate.getDate() + daysAfterEvent)

      console.log(`📅 [calculateEventData] Analysis date range:`)
      console.log(`   Start: ${startDate.toISOString().split("T")[0]}`)
      console.log(`   Event: ${eventDate}`)
      console.log(`   End: ${endDate.toISOString().split("T")[0]}`)

      // Step 3: Filter prices within the date range
      console.log(`🔍 [calculateEventData] Filtering prices within date range...`)
      const relevantPrices = assetData.closingPrices.filter((price) => {
        const priceDate = new Date(price.date)
        return priceDate >= startDate && priceDate <= endDate
      })

      console.log(`📈 [calculateEventData] Filtered results:`)
      console.log(`   Relevant prices found: ${relevantPrices.length}`)

      if (relevantPrices.length === 0) {
        console.log(`❌ [calculateEventData] No prices found in date range for ${assetName}`)
        return null
      }

      // Step 4: Sort by date
      relevantPrices.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      console.log(`   First price: ${relevantPrices[0].date} = ${relevantPrices[0].close}`)
      console.log(
        `   Last price: ${relevantPrices[relevantPrices.length - 1].date} = ${relevantPrices[relevantPrices.length - 1].close}`,
      )

      // Step 5: Find the event date price (or closest available before/on event date)
      console.log(`🎯 [calculateEventData] Finding event date price...`)
      let eventPrice = relevantPrices[0].close
      let eventDateIndex = -1
      let eventPriceDate = relevantPrices[0].date

      for (let i = 0; i < relevantPrices.length; i++) {
        const priceDate = new Date(relevantPrices[i].date)
        if (priceDate <= eventDateObj) {
          eventPrice = relevantPrices[i].close
          eventDateIndex = i
          eventPriceDate = relevantPrices[i].date
        } else {
          break
        }
      }

      console.log(`🎯 [calculateEventData] Event price determination:`)
      console.log(`   Event price: ${eventPrice} (from ${eventPriceDate})`)
      console.log(`   Event date index: ${eventDateIndex}`)

      if (eventPrice === 0) {
        console.log(`❌ [calculateEventData] Event price is zero for ${assetName}, cannot calculate reindexed values`)
        return null
      }

      // Step 6: Calculate reindexed values with proper handling for different asset types
      console.log(`🧮 [calculateEventData] Calculating reindexed values...`)
      const dates = relevantPrices.map((p) => p.date)
      const prices = relevantPrices.map((p) => p.close)

      const isAdditiveAsset = assetName === "10Y Treasury Yield" || assetName === "VIX"
      console.log(`   Asset type: ${isAdditiveAsset ? "Additive (10Y/VIX)" : "Multiplicative"}`)

      const reindexed = prices.map((price, index) => {
        let reindexedValue: number

        if (isAdditiveAsset) {
          // Additive reindexing: current - baseline + 100
          reindexedValue = price - eventPrice + 100
        } else {
          // Multiplicative reindexing for other assets: (current / baseline) * 100
          reindexedValue = eventPrice !== 0 ? (price / eventPrice) * 100 : 100
        }

        // Log first few and last few calculations for debugging
        if (index < 3 || index >= prices.length - 3) {
          console.log(`   [${index}] ${dates[index]}: ${price} → ${reindexedValue.toFixed(2)}`)
        }

        return reindexedValue
      })

      const result = {
        dates,
        prices,
        reindexed,
        eventPrice,
      }

      console.log(`✅ [calculateEventData] Calculation completed for ${assetName}:`)
      console.log(`   Data points: ${result.dates.length}`)
      console.log(`   Event price: ${result.eventPrice}`)
      console.log(
        `   Reindexed range: ${Math.min(...result.reindexed).toFixed(2)} to ${Math.max(...result.reindexed).toFixed(2)}`,
      )

      return result
    } catch (error) {
      console.error(`❌ [calculateEventData] Error calculating data for ${assetName}:`, error)
      return null
    }
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

  async getStorageStats(): Promise<{
    assetDataCount: number
    eventDataCount: number
    bulkDataCount: number
  }> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      let assetDataCount = 0
      let eventDataCount = 0
      let bulkDataCount = 0
      let storesChecked = 0
      const totalStores = 3

      const transaction = this.db!.transaction(["assetPriceData", "eventData", "bulkEventData"], "readonly")

      const checkComplete = () => {
        storesChecked++
        if (storesChecked === totalStores) {
          resolve({ assetDataCount, eventDataCount, bulkDataCount })
        }
      }

      const assetStore = transaction.objectStore("assetPriceData")
      const assetRequest = assetStore.count()
      assetRequest.onerror = () => {
        checkComplete()
      }
      assetRequest.onsuccess = () => {
        assetDataCount = assetRequest.result
        checkComplete()
      }

      const eventStore = transaction.objectStore("eventData")
      const eventRequest = eventStore.count()
      eventRequest.onerror = () => {
        checkComplete()
      }
      eventRequest.onsuccess = () => {
        eventDataCount = eventRequest.result
        checkComplete()
      }

      const bulkStore = transaction.objectStore("bulkEventData")
      const bulkRequest = bulkStore.count()
      bulkRequest.onerror = () => {
        checkComplete()
      }
      bulkRequest.onsuccess = () => {
        bulkDataCount = bulkRequest.result
        checkComplete()
      }
    })
  }
}

export const eventDataDB = new EventDataDB()

// New function to fetch data from our backend
export async function refreshAssetDataFromDB(assetSymbol: string, assetName: string) {
  try {
    console.log(`[Cache] Refreshing ${assetName} (${assetSymbol}) from database...`);
    const response = await fetch(`/api/asset-analysis?asset=${assetSymbol}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch data for ${assetSymbol}: ${response.status} ${errorText}`);
    }
    const data = await response.json();

    if (data && data.length > 0) {
      const dateRange = {
        start: data[0].date,
        end: data[data.length - 1].date,
      };
      await eventDataDB.storeAssetClosingPrices(assetName, assetSymbol, data, dateRange);
      console.log(`[Cache] Successfully refreshed and cached ${assetName}.`);
      return { success: true, assetName };
    } else {
      console.warn(`[Cache] No data returned from API for ${assetName}.`);
      return { success: false, assetName, error: 'No data returned from API' };
    }
  } catch (error) {
    console.error(`[Cache] Error refreshing ${assetName}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return { success: false, assetName, error: errorMessage };
  }
}

// Define the assets that the Event Analysis page will need.
// The key is the 'assetName' used in the cache, and the value is the 'symbol' used in the API.
export const ASSET_MAP: Record<string, string> = {
  "S&P 500": "SPX",
  "WTI Crude Oil": "WTI",
  "Gold": "Gold",
  "Dollar Index": "DXY Index",
  "10Y Treasury Yield": "UST 10Y Yield",
  "VIX": "VIX",
};

export const ASSET_NAMES = Object.keys(ASSET_MAP);
