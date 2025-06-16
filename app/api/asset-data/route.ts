import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { ticker, assetName, maxData = false, forceRefresh = false } = await request.json()

    if (!ticker || !assetName) {
      return NextResponse.json({ error: "Missing ticker or assetName" }, { status: 400 })
    }

    console.log(`Fetching data for ${assetName} (${ticker})`)

    let priceData: any[] = []

    // First, try to get data from GitHub repository
    if (!forceRefresh) {
      try {
        console.log(`Attempting to fetch ${assetName} data from GitHub...`)

        // Try to get the latest max data file from GitHub
        const githubResponse = await fetch(
          `https://api.github.com/repos/your-username/market_data_download/contents/data/${encodeURIComponent(ticker)}`,
          {
            headers: {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
              Accept: "application/vnd.github.v3+json",
            },
          },
        )

        if (githubResponse.ok) {
          const files = await githubResponse.json()

          // Look for the most recent max data file
          const maxFiles = files.filter((file: any) => file.name.includes("_max.csv"))
          if (maxFiles.length > 0) {
            // Get the most recent max file
            const latestMaxFile = maxFiles.sort((a: any, b: any) => b.name.localeCompare(a.name))[0]

            const fileResponse = await fetch(latestMaxFile.download_url)
            if (fileResponse.ok) {
              const csvContent = await fileResponse.text()
              priceData = parseCSV(csvContent)
              console.log(`Successfully loaded ${priceData.length} data points from GitHub for ${assetName}`)
            }
          }
        }
      } catch (error) {
        console.log(`GitHub fetch failed for ${assetName}, will try Yahoo Finance:`, error)
      }
    }

    // If no data from GitHub or force refresh, fetch from Yahoo Finance
    if (priceData.length === 0 || forceRefresh) {
      console.log(`Fetching fresh data from Yahoo Finance for ${assetName}`)

      try {
        // Calculate date range for maximum data (5 years)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setFullYear(startDate.getFullYear() - 5)

        const period1 = Math.floor(startDate.getTime() / 1000)
        const period2 = Math.floor(endDate.getTime() / 1000)

        const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/download/${ticker}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`

        const yahooResponse = await fetch(yahooUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        })

        if (yahooResponse.ok) {
          const csvContent = await yahooResponse.text()
          priceData = parseCSV(csvContent)
          console.log(`Successfully fetched ${priceData.length} data points from Yahoo Finance for ${assetName}`)

          // Save to GitHub in the background (don't wait for it)
          saveAssetDataToGitHub(ticker, assetName, csvContent).catch((error) => {
            console.error(`Failed to save ${assetName} to GitHub:`, error)
          })
        } else {
          throw new Error(`Yahoo Finance API returned ${yahooResponse.status}`)
        }
      } catch (error) {
        console.error(`Failed to fetch from Yahoo Finance for ${assetName}:`, error)
        return NextResponse.json({ error: `Failed to fetch data for ${assetName}: ${error}` }, { status: 500 })
      }
    }

    if (priceData.length === 0) {
      return NextResponse.json({ error: `No data available for ${assetName}` }, { status: 404 })
    }

    // Sort by date to ensure chronological order
    priceData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      assetName,
      ticker,
      priceData,
      dataPoints: priceData.length,
      dateRange: {
        start: priceData[0]?.date,
        end: priceData[priceData.length - 1]?.date,
      },
      source: forceRefresh ? "yahoo_finance" : "github_cache",
    })
  } catch (error) {
    console.error("Asset data API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function parseCSV(csvContent: string): any[] {
  const lines = csvContent.trim().split("\n")
  const headers = lines[0].split(",")

  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",")
    if (values.length >= 6) {
      const row = {
        date: values[0],
        open: Number.parseFloat(values[1]),
        high: Number.parseFloat(values[2]),
        low: Number.parseFloat(values[3]),
        close: Number.parseFloat(values[4]),
        volume: Number.parseInt(values[5]) || 0,
      }

      // Skip rows with invalid data
      if (!isNaN(row.open) && !isNaN(row.high) && !isNaN(row.low) && !isNaN(row.close)) {
        data.push(row)
      }
    }
  }

  return data
}

async function saveAssetDataToGitHub(ticker: string, assetName: string, csvContent: string): Promise<void> {
  try {
    if (!process.env.GITHUB_TOKEN) {
      console.log("No GitHub token available, skipping save")
      return
    }

    const today = new Date().toISOString().split("T")[0]
    const fileName = `${today}_max.csv`
    const filePath = `data/${ticker}/${fileName}`

    // Check if file already exists
    let sha: string | undefined
    try {
      const existingFileResponse = await fetch(
        `https://api.github.com/repos/your-username/market_data_download/contents/${filePath}`,
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: "application/vnd.github.v3+json",
          },
        },
      )

      if (existingFileResponse.ok) {
        const existingFile = await existingFileResponse.json()
        sha = existingFile.sha
      }
    } catch (error) {
      // File doesn't exist, which is fine
    }

    // Create or update the file
    const updateData = {
      message: `Update ${assetName} (${ticker}) data - ${today}`,
      content: Buffer.from(csvContent).toString("base64"),
      ...(sha && { sha }),
    }

    const response = await fetch(
      `https://api.github.com/repos/your-username/market_data_download/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      },
    )

    if (response.ok) {
      console.log(`Successfully saved ${assetName} data to GitHub`)
    } else {
      const errorText = await response.text()
      console.error(`Failed to save ${assetName} to GitHub:`, response.status, errorText)
    }
  } catch (error) {
    console.error(`Error saving ${assetName} to GitHub:`, error)
  }
}
