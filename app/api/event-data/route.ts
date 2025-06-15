import { type NextRequest, NextResponse } from "next/server"

const ASSET_TICKERS = {
  "S&P 500": "^GSPC",
  "WTI Crude Oil": "CL=F",
  Gold: "GC=F",
  "Dollar Index": "DX-Y.NYB",
  "10Y Treasury Yield": "^TNX",
}

export async function POST(request: NextRequest) {
  try {
    const { eventDate, ticker } = await request.json()

    if (!eventDate) {
      return NextResponse.json({ error: "Event date is required" }, { status: 400 })
    }

    console.log(`Event analysis request for event date ${eventDate}`)

    // Calculate date range: 30 days before to 60 days after
    const eventDateObj = new Date(eventDate)
    const startDate = new Date(eventDateObj)
    startDate.setDate(startDate.getDate() - 30)

    const endDate = new Date(eventDateObj)
    endDate.setDate(endDate.getDate() + 60)

    console.log(`Date range: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`)

    // Fetch data for all assets
    const allAssetData: Record<string, any> = {}

    for (const [assetName, assetTicker] of Object.entries(ASSET_TICKERS)) {
      try {
        console.log(`Fetching data for ${assetName} (${assetTicker})`)

        // Try to get data from GitHub repo first
        let priceData: any[] = []

        try {
          const repoData = await checkGitHubRepo(assetTicker, startDate, endDate)
          if (repoData.length > 0) {
            console.log(`Found ${repoData.length} data points in GitHub repo for ${assetName}`)
            priceData = repoData
          }
        } catch (error) {
          console.log(`No existing repo data found for ${assetName}, will fetch fresh data`)
        }

        // If we don't have enough data, fetch from Yahoo Finance
        if (priceData.length === 0 || !hasCompleteDateRange(priceData, startDate, endDate)) {
          console.log(`Fetching data from Yahoo Finance for ${assetName}...`)
          try {
            const yahooData = await fetchYahooData(assetTicker, startDate, endDate)
            priceData = yahooData
            console.log(`Fetched ${priceData.length} data points from Yahoo Finance for ${assetName}`)

            // Save to GitHub for future use
            await saveDataToGitHub(assetTicker, priceData)
          } catch (error) {
            console.log(`Yahoo Finance failed for ${assetName}, using mock data`)
            priceData = generateMockData(startDate, endDate, assetName)
          }
        }

        // Filter data to exact date range and reindex
        const filteredData = filterAndReindexData(priceData, startDate, endDate, eventDate, assetName)
        allAssetData[assetName] = filteredData

        console.log(`Processed ${filteredData.dates.length} data points for ${assetName}`)
      } catch (error) {
        console.error(`Error processing ${assetName}:`, error)
        // Generate fallback data for this asset
        const mockData = generateMockData(startDate, endDate, assetName)
        const filteredData = filterAndReindexData(mockData, startDate, endDate, eventDate, assetName)
        allAssetData[assetName] = filteredData
      }
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
    const dataPath = `data/${ticker}`

    console.log(`Checking GitHub repo: ${repoOwner}/${repoName}/${dataPath}`)

    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dataPath}`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Market-Data-Downloader",
      },
    })

    if (!response.ok) {
      console.log(`GitHub API response: ${response.status} ${response.statusText}`)
      return []
    }

    const files = await response.json()
    if (!Array.isArray(files)) {
      console.log("No files found in repo")
      return []
    }

    console.log(`Found ${files.length} files in repo`)

    // Get CSV files and combine data
    let allData: any[] = []

    for (const file of files) {
      if (file.name.endsWith(".csv")) {
        try {
          console.log(`Fetching file: ${file.name}`)
          const fileResponse = await fetch(file.download_url)
          if (fileResponse.ok) {
            const csvText = await fileResponse.text()
            const fileData = parseCSVData(csvText)
            allData = [...allData, ...fileData]
            console.log(`Added ${fileData.length} rows from ${file.name}`)
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

  // Allow for some buffer days for weekends/holidays
  const bufferStart = new Date(startDate)
  bufferStart.setDate(bufferStart.getDate() - 5)

  const bufferEnd = new Date(endDate)
  bufferEnd.setDate(bufferEnd.getDate() + 5)

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
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance returned ${response.status}: ${response.statusText}`)
  }

  const csvText = await response.text()
  console.log(`Yahoo Finance CSV length: ${csvText.length}`)

  return parseCSVData(csvText)
}

function parseCSVData(csvText: string) {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) {
    throw new Error("Invalid CSV data received")
  }

  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",")
    if (values.length >= 6 && values[1] !== "null" && values[1] !== "") {
      try {
        const row = {
          date: values[0],
          open: Number.parseFloat(values[1]),
          high: Number.parseFloat(values[2]),
          low: Number.parseFloat(values[3]),
          close: Number.parseFloat(values[4]),
          volume: Number.parseInt(values[6]) || 0,
        }

        if (!isNaN(row.open) && !isNaN(row.high) && !isNaN(row.low) && !isNaN(row.close)) {
          data.push(row)
        }
      } catch (parseError) {
        continue
      }
    }
  }

  return data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

function generateMockData(startDate: Date, endDate: Date, assetName: string) {
  console.log(`Generating mock data for ${assetName}`)
  const data = []
  const currentDate = new Date(startDate)

  // Set realistic base prices for different assets
  let basePrice = 4200 // S&P 500 default
  let volatility = 0.015 // 1.5% daily volatility

  switch (assetName) {
    case "WTI Crude Oil":
      basePrice = 75
      volatility = 0.025
      break
    case "Gold":
      basePrice = 2000
      volatility = 0.012
      break
    case "Dollar Index":
      basePrice = 103
      volatility = 0.008
      break
    case "10Y Treasury Yield":
      basePrice = 4.2
      volatility = 0.05 // 5 basis points
      break
  }

  while (currentDate <= endDate) {
    // Generate data for all days (including weekends) for mock data
    const randomChange = (Math.random() - 0.5) * volatility * 2
    basePrice *= 1 + randomChange

    data.push({
      date: currentDate.toISOString().split("T")[0],
      open: basePrice * 0.999,
      high: basePrice * 1.005,
      low: basePrice * 0.995,
      close: basePrice,
      volume: Math.floor(Math.random() * 1000000000),
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`Generated ${data.length} mock data points for ${assetName}`)
  return data
}

async function saveDataToGitHub(ticker: string, data: any[]) {
  try {
    console.log(`Saving ${data.length} data points to GitHub for ${ticker}`)

    // Use the existing save_prices API
    const response = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/save_prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: { symbol: ticker, name: ticker, type: "index" },
        data: data,
        period: "event-analysis",
      }),
    })

    if (response.ok) {
      console.log("Successfully saved data to GitHub")
    } else {
      console.log("Failed to save data to GitHub:", response.statusText)
    }
  } catch (error) {
    console.error("Error saving to GitHub:", error)
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

  // First, filter to exact date range
  const dateFiltered = data.filter((row) => {
    const rowDate = new Date(row.date)
    return rowDate >= startDate && rowDate <= endDate
  })

  console.log(`Date filtered to ${dateFiltered.length} data points for ${assetName}`)

  if (dateFiltered.length === 0) {
    throw new Error(`No data available for ${assetName} in the specified date range`)
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
    throw new Error(`No weekday data available for ${assetName} in the specified date range`)
  }

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

  if (assetName === "10Y Treasury Yield") {
    // Special formula for bond yields: current - start + 100
    reindexed = prices.map((price) => price - eventPrice + 100)
    console.log(`Reindexed bond yield data: ${reindexed.length} points, event yield: ${eventPrice}%`)
  } else {
    // Standard formula for other assets: (current / start) * 100
    reindexed = prices.map((price) => (price / eventPrice) * 100)
    console.log(`Reindexed ${assetName} data: ${reindexed.length} points, event price: ${eventPrice}`)
  }

  return { dates, prices, reindexed, assetName, eventPrice }
}
