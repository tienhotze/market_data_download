import { type NextRequest, NextResponse } from "next/server"
import { economicDataPool, assetPricesPool } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"
import { PoolClient } from "pg"

// GitHub API retry tracking
const githubRetryTracker: Record<string, { attempts: number; lastAttempt: number }> = {}
const MAX_GITHUB_RETRIES = 3
const GITHUB_COOLDOWN_PERIOD = 5 * 60 * 1000 // 5 minutes

const DATA_DIR = path.join(process.cwd(), "data")

const ASSETS_TO_CHECK = [
  { ticker: "^GSPC", name: "S&P 500", tableName: "price_spx" },
  { ticker: "CL=F", name: "WTI Crude Oil", tableName: "price_wti" },
  { ticker: "GC=F", name: "Gold", tableName: "price_gold" },
  { ticker: "DX-Y.NYB", name: "Dollar Index", tableName: "price_dxy" },
  { ticker: "^TNX", name: "10Y Treasury Yield", tableName: "price_tnx" },
  { ticker: "^VIX", name: "VIX", tableName: "price_vix" },
]

interface FileStatus {
  file: string
  exists: boolean
  size: number
  lastModified: string
  dbStatus: {
    asset_id: string
    table_name: string
    exists: boolean
    count: number
    min_date: string | null
    max_date: string | null
  }
}

async function checkTableStatus(client: PoolClient, tableName: string) {
  try {
    // Check if table exists
    const tableExistsResult = await client.query(
      `SELECT to_regclass($1) as "exists"`,
      [`public.${tableName}`]
    )
    const tableExists = tableExistsResult.rows[0].exists !== null

    if (!tableExists) {
      return {
        exists: false,
        count: 0,
        min_date: null,
        max_date: null,
      }
    }

    // If table exists, get count and date range
    const statsResult = await client.query(
      `SELECT 
         COUNT(*) as "count", 
         MIN(timestamp) as "min_date", 
         MAX(timestamp) as "max_date" 
       FROM ${tableName}`
    )

    const { count, min_date, max_date } = statsResult.rows[0]

    return {
      exists: true,
      count: parseInt(count, 10),
      min_date: min_date ? new Date(min_date).toISOString().split("T")[0] : null,
      max_date: max_date ? new Date(max_date).toISOString().split("T")[0] : null,
    }
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error)
    // On any error, assume the table check failed
    return {
      exists: false,
      count: 0,
      min_date: null,
      max_date: null,
    }
  }
}

export async function POST(request: NextRequest) {
  // This feature is temporarily disabled to ensure all data comes from PostgreSQL.
  return NextResponse.json(
    {
      message: "Checking GitHub repository is temporarily disabled.",
      source: "feature-disabled",
    },
    { status: 200 }
  );

  /*
  // Original implementation is preserved below for future use.
  try {
    const { ticker, startDate, endDate } = await request.json();

    if (!ticker) {
      return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
    }

    console.log(`GitHub repo check request for ticker ${ticker}`);

    const retryInfo = githubRetryTracker[ticker];
    if (retryInfo && retryInfo.attempts >= MAX_GITHUB_RETRIES) {
      const timeSinceLastAttempt = Date.now() - retryInfo.lastAttempt;
      if (timeSinceLastAttempt < GITHUB_COOLDOWN_PERIOD) {
        const nextRetryTime = new Date(retryInfo.lastAttempt + GITHUB_COOLDOWN_PERIOD);
        console.log(`GitHub API limit reached for ${ticker}. Next retry available at: ${nextRetryTime}`);

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
        );
      } else {
        delete githubRetryTracker[ticker];
        console.log(`GitHub retry cooldown expired for ${ticker}, resetting counter`);
      }
    }

    if (!githubRetryTracker[ticker]) {
      githubRetryTracker[ticker] = { attempts: 0, lastAttempt: 0 };
    }

    try {
      const data = await checkGitHubRepo(ticker, startDate, endDate);

      if (githubRetryTracker[ticker]) {
        delete githubRetryTracker[ticker];
      }

      console.log(`GitHub repo check successful for ${ticker}: ${data.length} data points`);

      return NextResponse.json({
        data,
        source: "github",
        ticker,
        dataPoints: data.length,
      });
    } catch (error) {
      githubRetryTracker[ticker].attempts += 1;
      githubRetryTracker[ticker].lastAttempt = Date.now();

      const errorMessage = error instanceof Error ? error.message : "Unknown GitHub API error";
      console.error(
        `GitHub API attempt ${githubRetryTracker[ticker].attempts}/${MAX_GITHUB_RETRIES} failed for ${ticker}:`,
        errorMessage,
      );

      if (githubRetryTracker[ticker].attempts >= MAX_GITHUB_RETRIES) {
        const nextRetryTime = new Date(Date.now() + GITHUB_COOLDOWN_PERIOD);
        console.log(`GitHub API limit reached for ${ticker} after ${MAX_GITHUB_RETRIES} attempts`);

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
        );
      }

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
      );
    }
  } catch (error) {
    console.error("GitHub repo check API error:", error);
    return NextResponse.json(
      {
        error: `Failed to check GitHub repo: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
  */
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

export async function GET(request: NextRequest) {
  let client: PoolClient | null = null
  try {
    client = await assetPricesPool.connect()

    // Log the assets from the database
    const assetsResult = await client.query('SELECT ticker, name FROM assets ORDER BY name')
    console.log("Assets from DB:", assetsResult.rows)

    const statusPromises = ASSETS_TO_CHECK.map(async (asset) => {
      const fileName = `${asset.ticker}_OHLCV_D.csv`
      const filePath = path.join(DATA_DIR, asset.ticker, fileName)
      let fileStats
      let fileExists = false

      try {
        fileStats = await fs.stat(filePath)
        fileExists = true
      } catch (e) {
        // File does not exist
      }

      const dbStatus = await checkTableStatus(client as PoolClient, asset.tableName)

      return {
        file: path.join(asset.ticker, fileName),
        exists: fileExists,
        size: fileExists ? fileStats!.size : 0,
        lastModified: fileExists ? fileStats!.mtime.toISOString() : "N/A",
        dbStatus: {
          asset_id: asset.name,
          table_name: asset.tableName,
          ...dbStatus,
        },
      }
    })

    const statusResults = await Promise.all(statusPromises)

    return NextResponse.json({ status: statusResults })
  } catch (error) {
    console.error("Failed to check repository data:", error)
    return NextResponse.json(
      { 
        error: "Failed to check repository data", 
        details: error instanceof Error ? error.message : String(error),
        status: [] // Always return an empty array on error
      },
      { status: 500 }
    )
  } finally {
    if (client) {
      client.release()
    }
  }
}