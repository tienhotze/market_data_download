import { type NextRequest, NextResponse } from "next/server"

// GitHub API retry tracking
const githubRetryTracker: Record<string, { attempts: number; lastAttempt: number }> = {}
const MAX_GITHUB_RETRIES = 3
const GITHUB_COOLDOWN_PERIOD = 5 * 60 * 1000 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { ticker, startDate, endDate } = await request.json()

    if (!ticker) {
      return NextResponse.json({ error: "Ticker is required" }, { status: 400 })
    }

    console.log(`GitHub repo check request for ticker ${ticker}`)

    // Check if ticker has exceeded GitHub retry limit
    const retryInfo = githubRetryTracker[ticker]
    if (retryInfo && retryInfo.attempts >= MAX_GITHUB_RETRIES) {
      const timeSinceLastAttempt = Date.now() - retryInfo.lastAttempt
      if (timeSinceLastAttempt < GITHUB_COOLDOWN_PERIOD) {
        const nextRetryTime = new Date(retryInfo.lastAttempt + GITHUB_COOLDOWN_PERIOD)
        console.log(`GitHub API limit reached for ${ticker}. Next retry available at: ${nextRetryTime}`)

        return NextResponse.json(
          {
            error: `GitHub API limit reached for ${ticker}. Maximum ${MAX_GITHUB_RETRIES} attempts exceeded.`,
            retryInfo: {
              attempts: retryInfo.attempts,
              maxRetries: MAX_GITHUB_RETRIES,
              nextRetryAvailable: nextRetryTime.toISOString(),
              cooldownRemaining: Math.ceil((GITHUB_COOLDOWN_PERIOD - timeSinceLastAttempt) / 1000),
            },
            source: "github-throttled",
          },
          { status: 429 },
        )
      } else {
        // Reset retry counter after cooldown
        delete githubRetryTracker[ticker]
        console.log(`GitHub retry cooldown expired for ${ticker}, resetting counter`)
      }
    }

    // Initialize or increment retry counter
    if (!githubRetryTracker[ticker]) {
      githubRetryTracker[ticker] = { attempts: 0, lastAttempt: 0 }
    }

    try {
      const data = await checkGitHubRepo(ticker, startDate, endDate)

      // Success - reset retry counter
      if (githubRetryTracker[ticker]) {
        delete githubRetryTracker[ticker]
      }

      console.log(`GitHub repo check successful for ${ticker}: ${data.length} data points`)

      return NextResponse.json({
        data,
        source: "github",
        ticker,
        dataPoints: data.length,
      })
    } catch (error) {
      // Increment retry counter
      githubRetryTracker[ticker].attempts += 1
      githubRetryTracker[ticker].lastAttempt = Date.now()

      const errorMessage = error instanceof Error ? error.message : "Unknown GitHub API error"
      console.error(
        `GitHub API attempt ${githubRetryTracker[ticker].attempts}/${MAX_GITHUB_RETRIES} failed for ${ticker}:`,
        errorMessage,
      )

      // Check if we've reached the limit
      if (githubRetryTracker[ticker].attempts >= MAX_GITHUB_RETRIES) {
        const nextRetryTime = new Date(Date.now() + GITHUB_COOLDOWN_PERIOD)
        console.log(`GitHub API limit reached for ${ticker} after ${MAX_GITHUB_RETRIES} attempts`)

        return NextResponse.json(
          {
            error: `GitHub API limit reached for ${ticker}. Maximum ${MAX_GITHUB_RETRIES} attempts exceeded.`,
            retryInfo: {
              attempts: githubRetryTracker[ticker].attempts,
              maxRetries: MAX_GITHUB_RETRIES,
              nextRetryAvailable: nextRetryTime.toISOString(),
              cooldownRemaining: GITHUB_COOLDOWN_PERIOD / 1000,
            },
            source: "github-failed",
            lastError: errorMessage,
          },
          { status: 429 },
        )
      }

      // Still have retries left
      return NextResponse.json(
        {
          error: errorMessage,
          retryInfo: {
            attempts: githubRetryTracker[ticker].attempts,
            maxRetries: MAX_GITHUB_RETRIES,
            remainingAttempts: MAX_GITHUB_RETRIES - githubRetryTracker[ticker].attempts,
          },
          source: "github-retry",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("GitHub repo check API error:", error)
    return NextResponse.json(
      {
        error: `Failed to check GitHub repo: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}

async function checkGitHubRepo(ticker: string, startDate?: string, endDate?: string) {
  const githubToken = process.env.GITHUB_TOKEN
  if (!githubToken) {
    throw new Error("No GitHub token available")
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
        throw new Error(`No data file found for ticker ${ticker}`)
      }
      if (response.status === 403) {
        throw new Error(`GitHub API rate limited or forbidden for ticker ${ticker}`)
      }
      if (response.status === 401) {
        throw new Error(`GitHub API authentication failed for ticker ${ticker}`)
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const fileData = await response.json()

    // Download the CSV file content
    const csvResponse = await fetch(fileData.download_url, {
      headers: {
        "User-Agent": "Market-Data-Downloader",
      },
    })

    if (!csvResponse.ok) {
      throw new Error(`Failed to download CSV file: ${csvResponse.status}`)
    }

    const csvText = await csvResponse.text()
    const parsedData = parseCSVData(csvText)

    console.log(`Successfully parsed ${parsedData.length} rows from ${fileName}`)
    return parsedData
  } catch (error) {
    console.error("GitHub repo check error:", error)
    throw error
  }
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
