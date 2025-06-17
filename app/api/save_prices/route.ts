import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, data, period } = body

    if (!ticker || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Ticker and data are required" }, { status: 400 })
    }

    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      return NextResponse.json(
        {
          error: "GitHub token not configured. Please set GITHUB_TOKEN environment variable.",
        },
        { status: 400 },
      )
    }

    // Use new naming convention: /data/{ticker}/{ticker}_OHLCV_D.csv
    const fileName = `${ticker}_OHLCV_D.csv`
    const filePath = `data/${ticker}/${fileName}`
    const commitMessage = `feat: ${ticker} OHLCV data for ${period} period on ${new Date().toISOString().split("T")[0]}`

    // GitHub API configuration
    const repoOwner = "tienhotze"
    const repoName = "market_data_download"
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`

    let existingData: any[] = []
    let existingSha: string | undefined

    try {
      // Try to get existing file first
      console.log(`Checking for existing file: ${filePath}`)
      const existingResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Market-Data-Downloader",
        },
      })

      if (existingResponse.ok) {
        const existingFile = await existingResponse.json()
        existingSha = existingFile.sha

        // Download and parse existing CSV content
        const csvResponse = await fetch(existingFile.download_url)
        if (csvResponse.ok) {
          const csvText = await csvResponse.text()
          existingData = parseCSVData(csvText)
          console.log(`Found existing file with ${existingData.length} rows`)
        }
      } else if (existingResponse.status === 404) {
        console.log(`File ${filePath} doesn't exist yet, will create new file`)
      } else {
        console.log(`Error checking existing file: ${existingResponse.status}`)
      }
    } catch (error) {
      console.log("Error checking existing file:", error)
    }

    // Merge new data with existing data
    const mergedData = mergeAndDeduplicateData(existingData, data)
    console.log(`Merged data: ${existingData.length} existing + ${data.length} new = ${mergedData.length} total`)

    // Create CSV content with merged data
    const csvContent = [
      "Date,Open,High,Low,Close,Adj Close,Volume",
      ...mergedData.map(
        (row: any) => `${row.Date},${row.Open},${row.High},${row.Low},${row.Close},${row["Adj Close"]},${row.Volume}`,
      ),
    ].join("\n")

    const encodedContent = Buffer.from(csvContent).toString("base64")

    const requestBody: any = {
      message: commitMessage,
      content: encodedContent,
    }

    if (existingSha) {
      requestBody.sha = existingSha
      console.log(`Updating existing file ${filePath}`)
    } else {
      console.log(`Creating new file ${filePath}`)
    }

    // Create or update file
    const response = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Market-Data-Downloader",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`GitHub API error: ${response.status} - ${errorText}`)
      throw new Error(`GitHub API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      sha: result.content.sha,
      githubUrl: result.content.html_url,
      fileName: fileName,
      recordCount: mergedData.length,
      newRecords: data.length,
      existingRecords: existingData.length,
    })
  } catch (error) {
    console.error("Error saving CSV:", error)
    return NextResponse.json(
      { error: `Failed to save CSV: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

function parseCSVData(csvText: string): any[] {
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

      // Parse the row
      const row = {
        Date: values[0],
        Open: Number.parseFloat(values[1]) || 0,
        High: Number.parseFloat(values[2]) || 0,
        Low: Number.parseFloat(values[3]) || 0,
        Close: Number.parseFloat(values[4]) || 0,
        "Adj Close": Number.parseFloat(values[5]) || 0,
        Volume: Number.parseInt(values[6]) || 0,
      }

      data.push(row)
    }

    console.log(`Successfully parsed ${data.length} rows from CSV`)
    return data
  } catch (error) {
    console.error("Error parsing CSV data:", error)
    return []
  }
}

function mergeAndDeduplicateData(existingData: any[], newData: any[]): any[] {
  // Combine existing and new data
  const allData = [...existingData, ...newData]

  // Create a map to deduplicate by date
  const dataMap = new Map()

  allData.forEach((row) => {
    const date = row.Date
    if (!dataMap.has(date) || new Date(row.Date) >= new Date(dataMap.get(date).Date)) {
      // Keep the most recent entry for each date
      dataMap.set(date, row)
    }
  })

  // Convert back to array and sort by date (latest to earliest)
  const deduplicatedData = Array.from(dataMap.values())
  deduplicatedData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())

  return deduplicatedData
}
