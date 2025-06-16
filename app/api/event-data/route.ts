import { type NextRequest, NextResponse } from "next/server"

const ASSET_TICKERS = {
  "S&P 500": "^GSPC",
  "WTI Crude Oil": "CL=F",
  Gold: "GC=F",
  "Dollar Index": "DX-Y.NYB",
  "10Y Treasury Yield": "^TNX",
  VIX: "^VIX",
}

export async function POST(request: NextRequest) {
  try {
    const { eventDate, ticker } = await request.json()

    if (!eventDate) {
      return NextResponse.json({ error: "Event date is required" }, { status: 400 })
    }

    console.log(`Event analysis request for event date ${eventDate}`)

    // Calculate date range: 45 days before to 75 days after (more flexible range)
    const eventDateObj = new Date(eventDate)
    const startDate = new Date(eventDateObj)
    startDate.setDate(startDate.getDate() - 45)

    const endDate = new Date(eventDateObj)
    endDate.setDate(endDate.getDate() + 75)

    console.log(`Date range: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`)

    // Fetch data for all assets
    const allAssetData: Record<string, any> = {}
    let githubAvailable = true
    const newDataToSave: Array<{ assetName: string; ticker: string; data: any[] }> = []

    for (const [assetName, assetTicker] of Object.entries(ASSET_TICKERS)) {
      try {
        console.log(`Fetching data for ${assetName} (${assetTicker})`)

        // Try to get data from GitHub repo first (only if GitHub is available)
        let priceData: any[] = []
        let hasNewData = false

        if (githubAvailable) {
          try {
            console.log(`Checking GitHub repo for ${assetName}...`)
            const repoData = await checkGitHubRepo(assetTicker, startDate, endDate)
            if (repoData.length > 0) {
              console.log(`Found ${repoData.length} data points in GitHub repo for ${assetName}`)
              priceData = repoData
            } else {
              console.log(`No repo data found for ${assetName}`)
            }
          } catch (repoError) {
            console.log(`GitHub repo check failed for ${assetName}:`, repoError)
            // If GitHub is consistently failing, disable it for remaining assets
            if (repoError instanceof Error && repoError.message.includes("Parse error")) {
              console.log("Disabling GitHub checks for remaining assets due to API issues")
              githubAvailable = false
            }
          }
        }

        // If we don't have enough data, fetch from Yahoo Finance
        if (priceData.length === 0 || !hasCompleteDateRange(priceData, startDate, endDate)) {
          console.log(`Fetching data from Yahoo Finance for ${assetName}...`)
          try {
            const yahooData = await fetchYahooData(assetTicker, startDate, endDate)
            if (yahooData.length > 0) {
              // Check if we have new data compared to existing repo data
              const existingDates = new Set(priceData.map((d) => d.date))
              const newDataPoints = yahooData.filter((d) => !existingDates.has(d.date))

              if (newDataPoints.length > 0) {
                console.log(`Found ${newDataPoints.length} new data points for ${assetName}`)
                hasNewData = true

                // Combine existing and new data
                const combinedData = [...priceData, ...newDataPoints].sort(
                  (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
                )

                // Remove duplicates
                const uniqueData = Array.from(new Map(combinedData.map((item) => [item.date, item])).values())
                priceData = uniqueData

                // Queue this data for saving to GitHub
                newDataToSave.push({
                  assetName,
                  ticker: assetTicker,
                  data: uniqueData,
                })
              } else {
                priceData = yahooData.length > priceData.length ? yahooData : priceData
              }

              console.log(`Total ${priceData.length} data points for ${assetName} (${newDataPoints.length} new)`)
            } else {
              console.log(`No data returned from Yahoo Finance for ${assetName}`)
            }
          } catch (yahooError) {
            console.log(`Yahoo Finance failed for ${assetName}:`, yahooError)
          }
        }

        // If we still don't have data, try with a wider date range
        if (priceData.length === 0) {
          console.log(`Trying wider date range for ${assetName}...`)
          const widerStartDate = new Date(eventDateObj)
          widerStartDate.setDate(widerStartDate.getDate() - 90)
          const widerEndDate = new Date(eventDateObj)
          widerEndDate.setDate(widerEndDate.getDate() + 90)

          try {
            const widerData = await fetchYahooData(assetTicker, widerStartDate, widerEndDate)
            if (widerData.length > 0) {
              priceData = widerData
              hasNewData = true
              console.log(`Fetched ${widerData.length} data points with wider range for ${assetName}`)

              // Queue this data for saving to GitHub
              newDataToSave.push({
                assetName,
                ticker: assetTicker,
                data: widerData,
              })
            }
          } catch (widerError) {
            console.log(`Wider range fetch also failed for ${assetName}:`, widerError)
          }
        }

        // If we still have no data, generate mock data as last resort
        if (priceData.length === 0) {
          console.log(`Generating mock data for ${assetName} as last resort`)
          priceData = generateMockData(startDate, endDate, assetName)
        }

        // Filter data to exact date range and reindex
        const filteredData = filterAndReindexData(priceData, startDate, endDate, eventDate, assetName)
        allAssetData[assetName] = filteredData

        console.log(`Processed ${filteredData.dates.length} data points for ${assetName}`)
      } catch (assetError) {
        console.error(`Error processing ${assetName}:`, assetError)

        // Generate mock data as fallback to prevent complete failure
        try {
          console.log(`Generating fallback mock data for ${assetName}`)
          const mockData = generateMockData(startDate, endDate, assetName)
          const filteredData = filterAndReindexData(mockData, startDate, endDate, eventDate, assetName)
          allAssetData[assetName] = filteredData
          console.log(`Using mock data for ${assetName}: ${filteredData.dates.length} points`)
        } catch (mockError) {
          console.error(`Failed to generate mock data for ${assetName}:`, mockError)
          // Skip this asset entirely only if mock data also fails
          continue
        }
      }
    }

    // Save new data to GitHub in parallel (don't wait for completion to avoid blocking response)
    if (newDataToSave.length > 0 && githubAvailable && process.env.GITHUB_TOKEN) {
      console.log(`Saving ${newDataToSave.length} assets with new data to GitHub...`)

      // Save data in background without blocking the response
      Promise.all(newDataToSave.map(({ assetName, ticker, data }) => saveAssetDataToGitHub(assetName, ticker, data)))
        .then((results) => {
          const successCount = results.filter(Boolean).length
          console.log(`GitHub save completed: ${successCount}/${newDataToSave.length} assets saved successfully`)
        })
        .catch((error) => {
          console.error("Error in background GitHub save:", error)
        })
    }

    console.log(`Returning data for ${Object.keys(allAssetData).length} assets`)

    return NextResponse.json({
      assets: allAssetData,
      eventDate,
      dateRange: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
      },
    })
  } catch (error) {
    console.error("Event data API error:", error)
    return NextResponse.json(
      {
        error: `Failed to fetch event data: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

function generateMockData(startDate: Date, endDate: Date, assetName: string): any[] {
  const mockData: any[] = []
  const currentDate = new Date(startDate)

  // Base prices for different assets
  const basePrices: Record<string, number> = {
    "S&P 500": 4000,
    "WTI Crude Oil": 70,
    Gold: 1800,
    "Dollar Index": 100,
    "10Y Treasury Yield": 4.5,
    VIX: 20,
  }

  let basePrice = basePrices[assetName] || 100

  while (currentDate <= endDate) {
    // Add some random variation (±2%)
    const variation = (Math.random() - 0.5) * 0.04
    const price = basePrice * (1 + variation)

    mockData.push({
      date: currentDate.toISOString().split("T")[0],
      open: price * 0.999,
      high: price * 1.002,
      low: price * 0.998,
      close: price,
      volume: Math.floor(Math.random() * 1000000) + 500000,
    })

    basePrice = price // Use current price as base for next day
    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`Generated ${mockData.length} mock data points for ${assetName}`)
  return mockData
}

function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Monday = 1, Friday = 5
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday = 0, Saturday = 6
}

async function checkGitHubRepo(ticker: string, startDate: Date, endDate: Date) {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    console.log("No GitHub token available")
    return []
  }

  try {
    const repoOwner = "tienhotze"
    const repoName = "market_data_download"

    // URL encode the ticker to handle special characters like ^, =, etc.
    const encodedTicker = encodeURIComponent(ticker)
    const dataPath = `data/${encodedTicker}`

    console.log(`Checking GitHub repo: ${repoOwner}/${repoName}/${dataPath}`)

    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dataPath}`
    console.log(`GitHub API URL: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Market-Data-Downloader",
      },
    })

    console.log(`GitHub API response status: ${response.status}`)

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No data directory found for ticker ${ticker}`)
        return []
      }
      if (response.status === 403) {
        console.log(`GitHub API rate limited or forbidden for ticker ${ticker}`)
        return []
      }
      if (response.status === 401) {
        console.log(`GitHub API authentication failed for ticker ${ticker}`)
        return []
      }
      console.log(`GitHub API error: ${response.status} ${response.statusText}`)
      return []
    }

    const responseText = await response.text()
    console.log(`GitHub API response length: ${responseText.length}`)

    // Check if response looks like JSON before parsing
    if (!responseText.trim().startsWith("[") && !responseText.trim().startsWith("{")) {
      console.log(`GitHub API returned non-JSON response: ${responseText.substring(0, 100)}...`)
      return []
    }

    let files
    try {
      files = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse GitHub API response:", parseError)
      console.log(`Response preview: ${responseText.substring(0, 200)}...`)
      return []
    }

    if (!Array.isArray(files)) {
      console.log("GitHub API response is not an array:", typeof files)
      // If it's an object with a message, it might be an error
      if (files && typeof files === "object" && files.message) {
        console.log(`GitHub API error message: ${files.message}`)
      }
      return []
    }

    console.log(`Found ${files.length} files in repo`)

    // Get CSV files and combine data
    let allData: any[] = []

    for (const file of files) {
      if (file.name && file.name.endsWith(".csv") && file.download_url) {
        try {
          console.log(`Fetching file: ${file.name}`)
          const fileResponse = await fetch(file.download_url, {
            headers: {
              "User-Agent": "Market-Data-Downloader",
            },
          })

          if (fileResponse.ok) {
            const csvText = await fileResponse.text()
            const fileData = parseCSVData(csvText)
            allData = [...allData, ...fileData]
            console.log(`Added ${fileData.length} rows from ${file.name}`)
          } else {
            console.log(`Failed to fetch file ${file.name}: ${fileResponse.status}`)
          }
        } catch (error) {
          console.error(`Error fetching file ${file.name}:`, error)
        }
      }
    }

    // Remove duplicates and sort by date
    const uniqueData = Array.from(new Map(allData.map((item) => [item.date, item])).values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    console.log(`Total unique data points: ${uniqueData.length}`)
    return uniqueData
  } catch (error) {
    console.error("GitHub repo check error:", error)
    return []
  }
}

function hasCompleteDateRange(data: any[], startDate: Date, endDate: Date): boolean {
  if (data.length === 0) return false

  const dataStart = new Date(data[0].date)
  const dataEnd = new Date(data[data.length - 1].date)

  // Allow for more buffer days for weekends/holidays
  const bufferStart = new Date(startDate)
  bufferStart.setDate(bufferStart.getDate() - 10)

  const bufferEnd = new Date(endDate)
  bufferEnd.setDate(bufferEnd.getDate() + 10)

  return dataStart <= bufferStart && dataEnd >= bufferEnd
}

async function fetchYahooData(ticker: string, startDate: Date, endDate: Date) {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=history&includeAdjustedClose=true`

  console.log(`Yahoo Finance URL: ${url}`)

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/csv,application/csv,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status}: ${response.statusText}`)
  }

  const csvText = await response.text()
  console.log(`Yahoo Finance CSV length: ${csvText.length}`)

  if (csvText.length < 100) {
    console.log(`Yahoo Finance returned minimal data: ${csvText}`)
    throw new Error("Yahoo Finance returned insufficient data")
  }

  return parseCSVData(csvText)
}

function parseCSVData(csvText: string) {
  try {
    const lines = csvText.trim().split("\n")
    if (lines.length < 2) {
      console.log("CSV has insufficient data")
      return []
    }

    const data = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(",")
      if (values.length < 6) {
        console.log(`Skipping line ${i}: insufficient columns`)
        continue
      }

      // Check for null or empty values
      if (values[1] === "null" || values[1] === "" || values[4] === "null" || values[4] === "") {
        console.log(`Skipping line ${i}: null values`)
        continue
      }

      try {
        const open = Number.parseFloat(values[1])
        const high = Number.parseFloat(values[2])
        const low = Number.parseFloat(values[3])
        const close = Number.parseFloat(values[4])
        const volume = values[6] ? Number.parseInt(values[6]) : 0

        // Validate that all prices are valid numbers
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
          console.log(`Skipping line ${i}: invalid price data`)
          continue
        }

        // Basic sanity check: high should be >= low
        if (high < low) {
          console.log(`Skipping line ${i}: high < low`)
          continue
        }

        const row = {
          date: values[0],
          open,
          high,
          low,
          close,
          volume: isNaN(volume) ? 0 : volume,
        }

        data.push(row)
      } catch (parseError) {
        console.log(`Error parsing line ${i}:`, parseError)
        continue
      }
    }

    console.log(`Successfully parsed ${data.length} rows from CSV`)
    return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } catch (error) {
    console.error("Error parsing CSV data:", error)
    return []
  }
}

async function saveDataToGitHub(ticker: string, data: any[]) {
  try {
    console.log(`Saving ${data.length} data points to GitHub for ${ticker}`)

    // Convert the data to the format expected by save_prices API
    const formattedData = data.map((row) => ({
      Date: row.date,
      Open: row.open,
      High: row.high,
      Low: row.low,
      Close: row.close,
      "Adj Close": row.close, // Use close as adj close for simplicity
      Volume: row.volume,
    }))

    // Use the existing save_prices API
    const response = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/save_prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker,
        data: formattedData,
        period: "event-analysis",
      }),
    })

    if (response.ok) {
      console.log("Successfully saved data to GitHub")
    } else {
      const errorText = await response.text()
      console.log("Failed to save data to GitHub:", response.status, errorText)
    }
  } catch (error) {
    console.error("Error saving to GitHub:", error)
  }
}

async function saveAssetDataToGitHub(assetName: string, ticker: string, data: any[]) {
  try {
    console.log(`Saving ${data.length} data points to GitHub for ${assetName} (${ticker})`)

    // Convert the data to the format expected by save_prices API
    const formattedData = data.map((row) => ({
      Date: row.date,
      Open: row.open,
      High: row.high,
      Low: row.low,
      Close: row.close,
      "Adj Close": row.close, // Use close as adj close for simplicity
      Volume: row.volume,
    }))

    // Use the existing save_prices API
    const response = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/save_prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: ticker,
        data: formattedData,
        period: "event-analysis",
      }),
    })

    if (response.ok) {
      console.log(`Successfully saved ${assetName} data to GitHub`)
      return true
    } else {
      const errorText = await response.text()
      console.log(`Failed to save ${assetName} data to GitHub:`, response.status, errorText)
      return false
    }
  } catch (error) {
    console.error(`Error saving ${assetName} to GitHub:`, error)
    return false
  }
}

function forwardFillMissingPrices(data: any[]): any[] {
  if (data.length === 0) return data

  const filledData = [...data]

  // Forward fill missing prices
  for (let i = 1; i < filledData.length; i++) {
    const current = filledData[i]
    const previous = filledData[i - 1]

    // If current prices are missing or invalid, use previous day's prices
    if (isNaN(current.open) || isNaN(current.high) || isNaN(current.low) || isNaN(current.close)) {
      console.log(`Forward filling missing prices for ${current.date} using ${previous.date}`)
      current.open = previous.open
      current.high = previous.high
      current.low = previous.low
      current.close = previous.close
      current.volume = previous.volume || 0
    }
  }

  return filledData
}

function filterAndReindexData(data: any[], startDate: Date, endDate: Date, eventDate: string, assetName: string) {
  console.log(
    `Filtering data for ${assetName} from ${startDate.toISOString().split("T")[0]} to ${
      endDate.toISOString().split("T")[0]
    }`,
  )

  // First, filter to a more flexible date range
  const flexibleStartDate = new Date(startDate)
  flexibleStartDate.setDate(flexibleStartDate.getDate() - 15) // Extra buffer

  const flexibleEndDate = new Date(endDate)
  flexibleEndDate.setDate(flexibleEndDate.getDate() + 15) // Extra buffer

  const dateFiltered = data.filter((row) => {
    const rowDate = new Date(row.date)
    return rowDate >= flexibleStartDate && rowDate <= flexibleEndDate
  })

  console.log(`Date filtered to ${dateFiltered.length} data points for ${assetName}`)

  if (dateFiltered.length === 0) {
    console.log(`No data in flexible range, using all available data for ${assetName}`)
    // Use all available data if nothing in range
    if (data.length === 0) {
      throw new Error(`No data available for ${assetName}`)
    }
    // Use the available data we have
    const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return processAvailableData(sortedData, eventDate, assetName)
  }

  // Forward fill any missing prices
  const filledData = forwardFillMissingPrices(dateFiltered)

  // Check if event date is a weekend
  const eventDateObj = new Date(eventDate)
  const eventIsWeekend = isWeekend(eventDateObj)

  // Filter to weekdays only, but include event date if it's a weekend
  const weekdayFiltered = filledData.filter((row) => {
    const rowDate = new Date(row.date)
    const isEventDate = row.date === eventDate

    // Include if it's a weekday OR if it's the event date (even if weekend)
    return isWeekday(rowDate) || (isEventDate && eventIsWeekend)
  })

  console.log(`Weekday filtered to ${weekdayFiltered.length} data points for ${assetName}`)
  if (eventIsWeekend) {
    console.log(`Event date ${eventDate} is a weekend - included in dataset`)
  }

  if (weekdayFiltered.length === 0) {
    console.log(`No weekday data, using all filtered data for ${assetName}`)
    return processAvailableData(filledData, eventDate, assetName)
  }

  return processFilteredData(weekdayFiltered, eventDate, assetName)
}

function processAvailableData(data: any[], eventDate: string, assetName: string) {
  // Find event date price for reindexing
  let eventRow = data.find((row) => row.date === eventDate)

  if (!eventRow) {
    // Find closest date to event date
    const eventDateTime = new Date(eventDate).getTime()
    eventRow = data.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.date).getTime() - eventDateTime)
      const currDiff = Math.abs(new Date(curr.date).getTime() - eventDateTime)
      return currDiff < prevDiff ? curr : prev
    })
    console.log(`Event date ${eventDate} not found for ${assetName}, using closest date ${eventRow.date}`)
  }

  const eventPrice = eventRow.close

  // Create reindexed data
  const dates = data.map((row) => row.date)
  const prices = data.map((row) => row.close)

  let reindexed: number[]

  if (assetName === "10Y Treasury Yield" || assetName === "VIX") {
    // Special formula for bond yields and VIX: current - start + 100
    reindexed = prices.map((price) => price - eventPrice + 100)
    console.log(
      `Reindexed ${assetName} data: ${reindexed.length} points, event ${assetName === "VIX" ? "VIX" : "yield"}: ${eventPrice}${assetName === "10Y Treasury Yield" ? "%" : ""}`,
    )
  } else {
    // Standard formula for other assets: (current / start) * 100
    reindexed = prices.map((price) => (price / eventPrice) * 100)
    console.log(`Reindexed ${assetName} data: ${reindexed.length} points, event price: ${eventPrice}`)
  }

  return { dates, prices, reindexed, assetName, eventPrice }
}

function processFilteredData(weekdayFiltered: any[], eventDate: string, assetName: string) {
  // Find event date price for reindexing
  let eventRow = weekdayFiltered.find((row) => row.date === eventDate)

  if (!eventRow) {
    // Find closest weekday to event date
    const eventDateTime = new Date(eventDate).getTime()
    eventRow = weekdayFiltered.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.date).getTime() - eventDateTime)
      const currDiff = Math.abs(new Date(curr.date).getTime() - eventDateTime)
      return currDiff < prevDiff ? curr : prev
    })
    console.log(`Event date ${eventDate} not found for ${assetName}, using closest weekday ${eventRow.date}`)
  }

  const eventPrice = eventRow.close

  // Create reindexed data with different formulas
  const dates = weekdayFiltered.map((row) => row.date)
  const prices = weekdayFiltered.map((row) => row.close)

  let reindexed: number[]

  if (assetName === "10Y Treasury Yield" || assetName === "VIX") {
    // Special formula for bond yields and VIX: current - start + 100
    reindexed = prices.map((price) => price - eventPrice + 100)
    console.log(
      `Reindexed ${assetName} data: ${reindexed.length} points, event ${assetName === "VIX" ? "VIX" : "yield"}: ${eventPrice}${assetName === "10Y Treasury Yield" ? "%" : ""}`,
    )
  } else {
    // Standard formula for other assets: (current / start) * 100
    reindexed = prices.map((price) => (price / eventPrice) * 100)
    console.log(`Reindexed ${assetName} data: ${reindexed.length} points, event price: ${eventPrice}`)
  }

  return { dates, prices, reindexed, assetName, eventPrice }
}
