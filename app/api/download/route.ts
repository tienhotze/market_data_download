import { type NextRequest, NextResponse } from "next/server"

interface RetryTracker {
  [ticker: string]: {
    attempts: number
    lastAttempt: number
    failed: boolean
  }
}

// Global retry tracker (in production, this should be in Redis or similar)
const retryTracker: RetryTracker = {}
const MAX_RETRIES = 3
const RETRY_COOLDOWN = 5 * 60 * 1000 // 5 minutes between retry cycles

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers, period, extraData = false } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: "No tickers provided" }, { status: 400 })
    }

    const ticker = tickers[0]
    console.log(`Download request: ticker=${ticker}, period=${period}, extraData=${extraData}`)

    // Convert period to timestamps (add extra month if requested for technical indicators)
    const { startTimestamp, endTimestamp } = getPeriodTimestamps(period, extraData)

    try {
      // Check retry limits
      const now = Date.now()
      const tickerRetry = retryTracker[ticker] || { attempts: 0, lastAttempt: 0, failed: false }

      // Reset attempts if cooldown period has passed
      if (now - tickerRetry.lastAttempt > RETRY_COOLDOWN) {
        tickerRetry.attempts = 0
        tickerRetry.failed = false
      }

      // Check if we've exceeded max retries
      if (tickerRetry.failed && tickerRetry.attempts >= MAX_RETRIES) {
        console.log(`Ticker ${ticker} has exceeded maximum retry attempts (${MAX_RETRIES})`)
        return NextResponse.json(
          {
            error: `Data unavailable: ${ticker} has exceeded maximum retry attempts (${MAX_RETRIES}). Please try again later.`,
            ticker,
            period,
            rows: 0,
            source: "Retry limit exceeded",
            retryInfo: {
              attempts: tickerRetry.attempts,
              maxRetries: MAX_RETRIES,
              nextRetryAvailable: new Date(tickerRetry.lastAttempt + RETRY_COOLDOWN).toISOString(),
            },
          },
          { status: 429 },
        )
      }

      // Update retry tracker
      retryTracker[ticker] = {
        attempts: tickerRetry.attempts + 1,
        lastAttempt: now,
        failed: false,
      }

      // Try multiple approaches to fetch data
      let yahooData = null
      let dataSource = "Unknown"
      let lastError = null

      // Approach 1: Try Yahoo Finance with better headers
      try {
        console.log(
          `Trying Yahoo Finance approach 1 for ${ticker} (attempt ${retryTracker[ticker].attempts}/${MAX_RETRIES})...`,
        )
        yahooData = await fetchYahooFinanceV1(ticker, startTimestamp, endTimestamp)
        dataSource = "Yahoo Finance V1"
      } catch (error) {
        console.log("Yahoo Finance V1 failed:", error)
        lastError = error
      }

      // Approach 2: Try alternative Yahoo Finance endpoint
      if (!yahooData || yahooData.length === 0) {
        try {
          console.log(
            `Trying Yahoo Finance approach 2 for ${ticker} (attempt ${retryTracker[ticker].attempts}/${MAX_RETRIES})...`,
          )
          yahooData = await fetchYahooFinanceV2(ticker, startTimestamp, endTimestamp)
          dataSource = "Yahoo Finance V2"
        } catch (error) {
          console.log("Yahoo Finance V2 failed:", error)
          lastError = error
        }
      }

      // Approach 3: Try Alpha Vantage (free tier)
      if (!yahooData || yahooData.length === 0) {
        try {
          console.log(`Trying Alpha Vantage for ${ticker} (attempt ${retryTracker[ticker].attempts}/${MAX_RETRIES})...`)
          yahooData = await fetchAlphaVantageData(ticker, period, extraData)
          dataSource = "Alpha Vantage"
        } catch (error) {
          console.log("Alpha Vantage failed:", error)
          lastError = error
        }
      }

      // If successful, reset retry tracker
      if (yahooData && yahooData.length > 0) {
        retryTracker[ticker] = { attempts: 0, lastAttempt: 0, failed: false }
        console.log(`Successfully fetched ${yahooData.length} data points for ${ticker} from ${dataSource}`)

        return NextResponse.json({
          data: yahooData,
          ticker,
          period,
          rows: yahooData.length,
          source: dataSource,
          extraData,
          warning: dataSource.includes("Mock") ? "Using mock data due to API limitations" : undefined,
        })
      }

      // Mark as failed if we've reached max retries
      if (retryTracker[ticker].attempts >= MAX_RETRIES) {
        retryTracker[ticker].failed = true
      }

      // Return error with retry information
      const remainingAttempts = MAX_RETRIES - retryTracker[ticker].attempts
      throw new Error(
        `All data sources failed for ${ticker}. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining.` : "Maximum attempts reached."} Last error: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
      )
    } catch (fetchError) {
      console.error(
        `Fetch failed for ${ticker} (attempt ${retryTracker[ticker]?.attempts || 0}/${MAX_RETRIES}):`,
        fetchError,
      )

      // Return error with retry information
      const tickerRetry = retryTracker[ticker] || { attempts: 0, lastAttempt: 0, failed: false }
      const remainingAttempts = MAX_RETRIES - tickerRetry.attempts

      return NextResponse.json(
        {
          error: `Download failed: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
          ticker,
          period,
          rows: 0,
          source: "No data available",
          retryInfo: {
            attempts: tickerRetry.attempts,
            maxRetries: MAX_RETRIES,
            remainingAttempts,
            nextRetryAvailable:
              remainingAttempts <= 0 ? new Date(tickerRetry.lastAttempt + RETRY_COOLDOWN).toISOString() : null,
          },
        },
        { status: remainingAttempts <= 0 ? 429 : 400 },
      )
    }
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json(
      { error: `Download failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 400 },
    )
  }
}

function getPeriodTimestamps(period: string, extraData = false) {
  const now = Math.floor(Date.now() / 1000)
  const periodMap: Record<string, number> = {
    "1mo": 30 * 24 * 60 * 60,
    "2mo": 60 * 24 * 60 * 60,
    "3mo": 90 * 24 * 60 * 60,
    "6mo": 180 * 24 * 60 * 60,
    "1y": 365 * 24 * 60 * 60,
    "2y": 2 * 365 * 24 * 60 * 60,
    "5y": 5 * 365 * 24 * 60 * 60,
    "10y": 10 * 365 * 24 * 60 * 60,
    max: 20 * 365 * 24 * 60 * 60,
  }

  let secondsBack = periodMap[period] || periodMap["1mo"]

  // Add extra month for technical indicators
  if (extraData) {
    secondsBack += 30 * 24 * 60 * 60 // Add 30 days
  }

  const startTimestamp = now - secondsBack

  return { startTimestamp, endTimestamp: now }
}

async function fetchYahooFinanceV1(symbol: string, startTimestamp: number, endTimestamp: number) {
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&events=history&includeAdjustedClose=true`

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/csv,application/csv,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Cache-Control": "max-age=0",
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance V1 returned ${response.status}: ${response.statusText}`)
  }

  return parseYahooCSV(await response.text())
}

async function fetchYahooFinanceV2(symbol: string, startTimestamp: number, endTimestamp: number) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d&includePrePost=true&events=div%7Csplit%7Cearn`

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://finance.yahoo.com/",
      Origin: "https://finance.yahoo.com",
    },
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance V2 returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  return parseYahooJSON(data, symbol)
}

async function fetchAlphaVantageData(symbol: string, period: string, extraData = false) {
  // Alpha Vantage free API (no key required for demo, but limited)
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=demo`

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Market Data Downloader",
    },
  })

  if (!response.ok) {
    throw new Error(`Alpha Vantage returned ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  return parseAlphaVantageData(data, period, extraData)
}

function parseYahooCSV(csvText: string) {
  const lines = csvText.trim().split("\n")
  if (lines.length < 2) {
    throw new Error("Invalid CSV data received")
  }

  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",")
    if (values.length < 6 || values[1] === "null" || values[1] === "") {
      continue
    }

    try {
      const row = {
        Date: values[0],
        Open: Number.parseFloat(values[1]),
        High: Number.parseFloat(values[2]),
        Low: Number.parseFloat(values[3]),
        Close: Number.parseFloat(values[4]),
        "Adj Close": Number.parseFloat(values[5]),
        Volume: Number.parseInt(values[6]) || 0,
      }

      if (!isNaN(row.Open) && !isNaN(row.High) && !isNaN(row.Low) && !isNaN(row.Close)) {
        data.push(row)
      }
    } catch (parseError) {
      continue
    }
  }

  return data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
}

function parseYahooJSON(data: any, symbol: string) {
  try {
    const result = data.chart?.result?.[0]
    if (!result) {
      throw new Error("No chart data found")
    }

    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0] || {}
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || []

    const parsedData = []
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
      const open = quotes.open?.[i]
      const high = quotes.high?.[i]
      const low = quotes.low?.[i]
      const close = quotes.close?.[i]
      const volume = quotes.volume?.[i]
      const adjCloseValue = adjClose[i]

      if (open && high && low && close) {
        parsedData.push({
          Date: date,
          Open: Number.parseFloat(open.toFixed(2)),
          High: Number.parseFloat(high.toFixed(2)),
          Low: Number.parseFloat(low.toFixed(2)),
          Close: Number.parseFloat(close.toFixed(2)),
          "Adj Close": Number.parseFloat((adjCloseValue || close).toFixed(2)),
          Volume: volume || 0,
        })
      }
    }

    return parsedData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  } catch (error) {
    throw new Error(`Failed to parse Yahoo JSON data: ${error}`)
  }
}

function parseAlphaVantageData(data: any, period: string, extraData = false) {
  const timeSeries = data["Time Series (Daily)"]
  if (!timeSeries) {
    throw new Error("No time series data found in Alpha Vantage response")
  }

  const periodDays: Record<string, number> = {
    "1mo": 30,
    "2mo": 60,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "10y": 3650,
    max: 10000,
  }

  let maxDays = periodDays[period] || 30
  if (extraData) {
    maxDays += 30 // Add extra month
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - maxDays)

  const parsedData = []
  for (const [date, values] of Object.entries(timeSeries)) {
    const dateObj = new Date(date)
    if (dateObj >= cutoffDate) {
      const dayData = values as any
      parsedData.push({
        Date: date,
        Open: Number.parseFloat(dayData["1. open"]),
        High: Number.parseFloat(dayData["2. high"]),
        Low: Number.parseFloat(dayData["3. low"]),
        Close: Number.parseFloat(dayData["4. close"]),
        "Adj Close": Number.parseFloat(dayData["4. close"]), // Alpha Vantage doesn't provide adj close in free tier
        Volume: Number.parseInt(dayData["5. volume"]) || 0,
      })
    }
  }

  return parsedData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
}
