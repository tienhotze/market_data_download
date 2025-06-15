import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers, period } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: "No tickers provided" }, { status: 400 })
    }

    const ticker = tickers[0]
    console.log(`Download request: ticker=${ticker}, period=${period}`)

    // Convert period to timestamps
    const { startTimestamp, endTimestamp } = getPeriodTimestamps(period)

    try {
      // Try multiple approaches to fetch data
      let yahooData = null
      let dataSource = "Unknown"

      // Approach 1: Try Yahoo Finance with better headers
      try {
        console.log("Trying Yahoo Finance approach 1...")
        yahooData = await fetchYahooFinanceV1(ticker, startTimestamp, endTimestamp)
        dataSource = "Yahoo Finance V1"
      } catch (error) {
        console.log("Yahoo Finance V1 failed:", error)
      }

      // Approach 2: Try alternative Yahoo Finance endpoint
      if (!yahooData || yahooData.length === 0) {
        try {
          console.log("Trying Yahoo Finance approach 2...")
          yahooData = await fetchYahooFinanceV2(ticker, startTimestamp, endTimestamp)
          dataSource = "Yahoo Finance V2"
        } catch (error) {
          console.log("Yahoo Finance V2 failed:", error)
        }
      }

      // Approach 3: Try Alpha Vantage (free tier)
      if (!yahooData || yahooData.length === 0) {
        try {
          console.log("Trying Alpha Vantage...")
          yahooData = await fetchAlphaVantageData(ticker, period)
          dataSource = "Alpha Vantage"
        } catch (error) {
          console.log("Alpha Vantage failed:", error)
        }
      }

      // Approach 4: Generate realistic mock data as fallback
      if (!yahooData || yahooData.length === 0) {
        console.log("All external APIs failed, generating realistic mock data...")
        yahooData = generateRealisticMockData(ticker, period)
        dataSource = "Mock Data (External APIs unavailable)"
      }

      console.log(`Successfully fetched ${yahooData.length} data points for ${ticker} from ${dataSource}`)

      return NextResponse.json({
        data: yahooData,
        ticker,
        period,
        rows: yahooData.length,
        source: dataSource,
        warning: dataSource.includes("Mock") ? "Using mock data due to API limitations" : undefined,
      })
    } catch (fetchError) {
      console.error("All fetch methods failed:", fetchError)

      // Final fallback to mock data
      const fallbackData = generateRealisticMockData(ticker, period)
      return NextResponse.json({
        data: fallbackData,
        ticker,
        period,
        rows: fallbackData.length,
        source: "Mock Data (Fallback)",
        warning: "External APIs unavailable, using mock data",
        error: fetchError instanceof Error ? fetchError.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json(
      { error: `Download failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 400 },
    )
  }
}

function getPeriodTimestamps(period: string) {
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

  const secondsBack = periodMap[period] || periodMap["1mo"]
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

async function fetchAlphaVantageData(symbol: string, period: string) {
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
  return parseAlphaVantageData(data, period)
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

function parseAlphaVantageData(data: any, period: string) {
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

  const maxDays = periodDays[period] || 30
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

function generateRealisticMockData(ticker: string, period: string) {
  const periodDays: Record<string, number> = {
    "1mo": 30,
    "2mo": 60,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "10y": 3650,
    max: 3650,
  }

  const days = periodDays[period] || 30
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  // Base prices for different asset types
  const basePrices: Record<string, number> = {
    AAPL: 180,
    MSFT: 380,
    GOOGL: 140,
    AMZN: 150,
    TSLA: 250,
    META: 320,
    NVDA: 480,
    SPY: 450,
    QQQ: 380,
    "BTC-USD": 43000,
    "ETH-USD": 2500,
  }

  let basePrice = basePrices[ticker] || 100
  const data = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    // Skip weekends for most assets (except crypto)
    if (ticker.includes("-USD") || (currentDate.getDay() !== 0 && currentDate.getDay() !== 6)) {
      // Generate realistic price movement
      const volatility = ticker.includes("-USD") ? 0.05 : 0.02 // Crypto more volatile
      const change = (Math.random() - 0.5) * volatility * 2
      basePrice *= 1 + change

      const dailyRange = basePrice * (ticker.includes("-USD") ? 0.04 : 0.015)
      const open = basePrice + (Math.random() - 0.5) * dailyRange
      const close = basePrice + (Math.random() - 0.5) * dailyRange
      const high = Math.max(open, close) + Math.random() * (dailyRange / 2)
      const low = Math.min(open, close) - Math.random() * (dailyRange / 2)
      const volume = Math.floor(Math.random() * 50000000) + 1000000

      data.push({
        Date: currentDate.toISOString().split("T")[0],
        Open: Math.round(open * 100) / 100,
        High: Math.round(high * 100) / 100,
        Low: Math.round(low * 100) / 100,
        Close: Math.round(close * 100) / 100,
        "Adj Close": Math.round(close * 100) / 100,
        Volume: volume,
      })
    }

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return data.reverse() // Most recent first
}
