import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { ticker, startDate, endDate } = await request.json()

    if (!ticker || !startDate || !endDate) {
      return NextResponse.json({ error: "Ticker, start date, and end date are required" }, { status: 400 })
    }

    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) {
      return NextResponse.json({ hasCompleteData: false, data: [] })
    }

    // Check GitHub repo for existing data files
    const repoOwner = "tienhotze"
    const repoName = "market_data_download"
    const dataPath = `data/${ticker}`

    try {
      const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dataPath}`, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!response.ok) {
        return NextResponse.json({ hasCompleteData: false, data: [] })
      }

      const files = await response.json()

      // Look for CSV files and combine data
      let allData: any[] = []

      for (const file of files) {
        if (file.name.endsWith(".csv")) {
          try {
            const fileResponse = await fetch(file.download_url)
            if (fileResponse.ok) {
              const csvText = await fileResponse.text()
              const fileData = parseCSVData(csvText)
              allData = [...allData, ...fileData]
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

      // Check if we have complete data for the requested range
      const requestStart = new Date(startDate)
      const requestEnd = new Date(endDate)

      const hasCompleteData = checkDateCoverage(uniqueData, requestStart, requestEnd)

      return NextResponse.json({
        hasCompleteData,
        data: uniqueData,
        dataRange: {
          start: uniqueData.length > 0 ? uniqueData[0].date : null,
          end: uniqueData.length > 0 ? uniqueData[uniqueData.length - 1].date : null,
          count: uniqueData.length,
        },
      })
    } catch (error) {
      console.error("GitHub API error:", error)
      return NextResponse.json({ hasCompleteData: false, data: [] })
    }
  } catch (error) {
    console.error("Check repo data API error:", error)
    return NextResponse.json({ error: "Failed to check repository data" }, { status: 500 })
  }
}

function parseCSVData(csvText: string) {
  const lines = csvText.trim().split("\n")
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const [date, open, high, low, close, adjClose, volume] = lines[i].split(",")
    if (date && close && !isNaN(Number.parseFloat(close))) {
      data.push({
        date,
        open: Number.parseFloat(open),
        high: Number.parseFloat(high),
        low: Number.parseFloat(low),
        close: Number.parseFloat(close),
        volume: Number.parseInt(volume) || 0,
      })
    }
  }

  return data
}

function checkDateCoverage(data: any[], startDate: Date, endDate: Date): boolean {
  if (data.length === 0) return false

  const dataStart = new Date(data[0].date)
  const dataEnd = new Date(data[data.length - 1].date)

  // Check if our data covers the requested range (with some buffer for weekends)
  const bufferDays = 5 // Account for weekends and holidays
  const adjustedStart = new Date(startDate)
  adjustedStart.setDate(adjustedStart.getDate() - bufferDays)

  const adjustedEnd = new Date(endDate)
  adjustedEnd.setDate(adjustedEnd.getDate() + bufferDays)

  return dataStart <= adjustedStart && dataEnd >= adjustedEnd
}
