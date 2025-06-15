import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { eventDate, ticker } = await request.json()

    if (!eventDate || !ticker) {
      return NextResponse.json({ error: "Event date and ticker are required" }, { status: 400 })
    }

    console.log(`Event analysis request: ${ticker} for event date ${eventDate}`)

    // Calculate date range: 30 days before to 60 days after
    const eventDateObj = new Date(eventDate)
    const startDate = new Date(eventDateObj)
    startDate.setDate(startDate.getDate() - 30)

    const endDate = new Date(eventDateObj)
    endDate.setDate(endDate.getDate() + 60)

    console.log(`Date range: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`)

    // Try to get data from GitHub repo first
    let priceData: any[] = []

    try {
      const repoData = await checkGitHubRepo(ticker, startDate, endDate)
      if (repoData.length > 0) {
        console.log(`Found ${repoData.length} data points in GitHub repo`)
        priceData = repoData
      }
    } catch (error) {
      console.log("No existing repo data found, will fetch fresh data")
    }

    // If we don't have enough data, fetch from Yahoo Finance
    if (priceData.length === 0 || !hasCompleteDateRange(priceData, startDate, endDate)) {
      console.log("Fetching data from Yahoo Finance...")
      try {
        const yahooData = await fetchYahooData(ticker, startDate, endDate)
        priceData = yahooData
        console.log(`Fetched ${priceData.length} data points from Yahoo Finance`)

        // Save to GitHub for future use
        await saveDataToGitHub(ticker, priceData)
      } catch (error) {
        console.log("Yahoo Finance failed, using mock data")
        priceData = generateMockData(startDate, endDate)
      }
    }

    // Filter data to exact date range and reindex
    const filteredData = filterAndReindexData(priceData, startDate, endDate, eventDate)

    console.log(`Returning ${filteredData.dates.length} data points for analysis`)

    return NextResponse.json(filteredData)
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

function generateMockData(startDate: Date, endDate: Date) {
  console.log("Generating mock S&P 500 data")
  const data = []
  const currentDate = new Date(startDate)
  let basePrice = 4200 // S&P 500 approximate level

  while (currentDate <= endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      const randomChange = (Math.random() - 0.5) * 0.03 // ±1.5% daily change
      basePrice *= 1 + randomChange

      data.push({
        date: currentDate.toISOString().split("T")[0],
        open: basePrice * 0.999,
        high: basePrice * 1.008,
        low: basePrice * 0.992,
        close: basePrice,
        volume: Math.floor(Math.random() * 2000000000),
      })
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  console.log(`Generated ${data.length} mock data points`)
  return data
}

async function saveDataToGitHub(ticker: string, data: any[]) {
  try {
    console.log(`Saving ${data.length} data points to GitHub for ${ticker}`)

    const csvContent = convertToCSV(data)
    const fileName = `${new Date().toISOString().split("T")[0]}_event_analysis.csv`

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

function convertToCSV(data: any[]) {
  const headers = "Date,Open,High,Low,Close,Adj Close,Volume"
  const rows = data.map(
    (row) => `${row.date},${row.open},${row.high},${row.low},${row.close},${row.close},${row.volume}`,
  )
  return [headers, ...rows].join("\n")
}

function filterAndReindexData(data: any[], startDate: Date, endDate: Date, eventDate: string) {
  console.log(`Filtering data from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`)

  // Filter to exact date range
  const filtered = data.filter((row) => {
    const rowDate = new Date(row.date)
    return rowDate >= startDate && rowDate <= endDate
  })

  console.log(`Filtered to ${filtered.length} data points`)

  if (filtered.length === 0) {
    throw new Error("No data available for the specified date range")
  }

  // Find event date price for reindexing
  let eventRow = filtered.find((row) => row.date === eventDate)

  if (!eventRow) {
    // Find closest date to event date
    const eventDateTime = new Date(eventDate).getTime()
    eventRow = filtered.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.date).getTime() - eventDateTime)
      const currDiff = Math.abs(new Date(curr.date).getTime() - eventDateTime)
      return currDiff < prevDiff ? curr : prev
    })
    console.log(`Event date ${eventDate} not found, using closest date ${eventRow.date}`)
  }

  const eventPrice = eventRow.close

  // Create reindexed data
  const dates = filtered.map((row) => row.date)
  const prices = filtered.map((row) => row.close)
  const reindexed = prices.map((price) => (price / eventPrice) * 100)

  console.log(`Reindexed data: ${reindexed.length} points, event price: ${eventPrice}`)

  return { dates, prices, reindexed }
}
