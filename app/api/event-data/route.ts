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
    const { eventDate, ticker, assetsToFetch } = await request.json()

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

    // Determine which assets to fetch
    const assetsToProcess = assetsToFetch || Object.keys(ASSET_TICKERS)
    console.log(`Processing ${assetsToProcess.length} assets: ${assetsToProcess.join(", ")}`)

    // Fetch data for requested assets only
    const allAssetData: Record<string, any> = {}
    let githubAvailable = true
    const newDataToSave: Array<{ assetName: string; ticker: string; data: any[] }> = []

    for (const assetName of assetsToProcess) {
      const assetTicker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS]
      if (!assetTicker) {
        console.log(`Unknown asset: ${assetName}`)
        continue
      }

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

        // If we still have no data, skip this asset (no mock data)
        if (priceData.length === 0) {
          console.log(`No data available for ${assetName} - skipping`)
          continue
        }

        // Filter data to exact date range and reindex
        const filteredData = filterAndReindexData(priceData, startDate, endDate, eventDate, assetName)
        allAssetData[assetName] = filteredData

        console.log(`Processed ${filteredData.dates.length} data points for ${assetName}`)
      } catch (assetError) {
        console.error(`Error processing ${assetName}:`, assetError)
        // Skip this asset entirely if there's an error
        continue
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

    // Use new naming convention: /data/{ticker}/{ticker}_OHLCV_D.csv
    const fileName = `${ticker}_OHLCV_D.csv`
    const filePath = `data/${ticker}/${fileName}`

    console.log(`Checking GitHub repo: ${repoOwner}/${repoName}/${filePath}`)

    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`
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
        console.log(`No data file found for ticker ${ticker}`)
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

    const fileData = await response.json()

    // Download the CSV file content
    const csvResponse = await fetch(fileData.download_url, {
      headers: {
        "User-Agent": "Market-Data-Downloader",
      },
    })

    if (!csvResponse.ok) {
      console.log(`Failed to download CSV file: ${csvResponse.status}`)
      return []
    }

    const csvText = await csvResponse.text()
    const parsedData = parseCSVData(csvText)

    console.log(`Successfully parsed ${parsedData.length} rows from ${fileName}`)
    return parsedData
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

async function fetchYahooData(ticker: string, startDate: Date, endDate: Date, period = "1mo") {
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.floor(endDate.getTime() / 1000)

  const url = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=history&includeAdjustedClose=true`

  console.log(`Yahoo Finance URL: ${url} (using ${period} period for latest data)`)

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

function filterAndReindexData(data: any[], startDate: Date, endDate: Date, eventDate: string, assetName: string) {
  const filteredData = data.filter((item) => {
    const itemDate = new Date(item.date)
    return itemDate >= startDate && itemDate <= endDate
  })

  const eventDateObj = new Date(eventDate)

  const dates = filteredData.map((item) => {
    const itemDate = new Date(item.date)
    const diffInDays = Math.floor((itemDate.getTime() - eventDateObj.getTime()) / (1000 * 3600 * 24))
    return diffInDays
  })

  const open = filteredData.map((item) => item.open)
  const high = filteredData.map((item) => item.high)
  const low = filteredData.map((item) => item.low)
  const close = filteredData.map((item) => item.close)
  const volume = filteredData.map((item) => item.volume)

  return {
    assetName,
    dates,
    open,
    high,
    low,
    close,
    volume,
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
      console.log(`Successfully saved data to GitHub for ${assetName} (${ticker})`)
    } else {
      const errorText = await response.text()
      console.log(`Failed to save data to GitHub for ${assetName} (${ticker}):`, response.status, errorText)
    }
  } catch (error) {
    console.error(`Error saving to GitHub for ${assetName} (${ticker}):`, error)
  }
}
