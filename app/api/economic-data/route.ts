import { type NextRequest, NextResponse } from "next/server"

interface EconomicDataPoint {
  date: string
  value: number
  series: string
  seriesName: string
}

interface BLSResponse {
  status: string
  responseTime: number
  message: string[]
  Results: {
    series: Array<{
      seriesID: string
      data: Array<{
        year: string
        period: string
        periodName: string
        value: string
        footnotes: any[]
      }>
    }>
  }
}

interface BEAResponse {
  BEAAPI: {
    Results: {
      Data: Array<{
        TimePeriod: string
        DataValue: string
        SeriesCode: string
      }>
    }
  }
}

// Economic data series configurations
const ECONOMIC_SERIES = {
  // BLS Data
  unemployment: {
    id: "LNS14000000",
    name: "Unemployment Rate",
    source: "BLS",
    unit: "%",
    frequency: "monthly",
  },
  cpi: {
    id: "CUUR0000SA0",
    name: "Consumer Price Index",
    source: "BLS",
    unit: "Index",
    frequency: "monthly",
  },
  jobsAdded: {
    id: "CES0000000001",
    name: "Total Nonfarm Payrolls",
    source: "BLS",
    unit: "Thousands",
    frequency: "monthly",
  },
  // BEA Data
  gdp: {
    id: "A191RL1Q225SBEA",
    name: "Real GDP",
    source: "BEA",
    unit: "Billions",
    frequency: "quarterly",
  },
  retailSales: {
    id: "RSAFS",
    name: "Retail Sales",
    source: "BEA",
    unit: "Millions",
    frequency: "monthly",
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const series = searchParams.get("series")
  const startYear = searchParams.get("startYear") || "2014"
  const endYear = searchParams.get("endYear") || new Date().getFullYear().toString()

  if (!series || !ECONOMIC_SERIES[series as keyof typeof ECONOMIC_SERIES]) {
    return NextResponse.json({ error: "Invalid series specified" }, { status: 400 })
  }

  const seriesConfig = ECONOMIC_SERIES[series as keyof typeof ECONOMIC_SERIES]

  try {
    // First try to get data from GitHub
    let data = await fetchFromGitHub(series, seriesConfig)

    // If no data from GitHub or data is stale, fetch from API
    if (!data || isDataStale(data)) {
      console.log(`Fetching fresh ${series} data from ${seriesConfig.source}`)

      if (seriesConfig.source === "BLS") {
        data = await fetchBLSData(seriesConfig.id, seriesConfig.name, startYear, endYear)
      } else if (seriesConfig.source === "BEA") {
        data = await fetchBEAData(seriesConfig.id, seriesConfig.name, startYear, endYear)
      }

      // Save to GitHub
      if (data && data.length > 0) {
        await saveToGitHub(series, data, seriesConfig)
      }
    }

    return NextResponse.json({
      series,
      seriesName: seriesConfig.name,
      data: data || [],
      source: seriesConfig.source,
      unit: seriesConfig.unit,
      frequency: seriesConfig.frequency,
    })
  } catch (error) {
    console.error(`Error fetching ${series} data:`, error)
    return NextResponse.json(
      { error: `Failed to fetch ${series} data: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}

async function fetchFromGitHub(series: string, config: any): Promise<EconomicDataPoint[] | null> {
  try {
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return null

    const fileName = `${series}_${config.source.toLowerCase()}.json`
    const filePath = `economic_data/US/${fileName}`
    const apiUrl = `https://api.github.com/repos/tienhotze/market_data_download/contents/${filePath}`

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (response.ok) {
      const file = await response.json()
      const dataResponse = await fetch(file.download_url)
      if (dataResponse.ok) {
        const jsonData = await dataResponse.json()
        return jsonData.data || []
      }
    }
    return null
  } catch (error) {
    console.error("Error fetching from GitHub:", error)
    return null
  }
}

async function fetchBLSData(
  seriesId: string,
  seriesName: string,
  startYear: string,
  endYear: string,
): Promise<EconomicDataPoint[]> {
  const url = "https://api.bls.gov/publicAPI/v2/timeseries/data/"

  const requestBody = {
    seriesid: [seriesId],
    startyear: startYear,
    endyear: endYear,
    registrationkey: process.env.BLS_API_KEY || undefined,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`BLS API error: ${response.status}`)
  }

  const data: BLSResponse = await response.json()

  if (data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(`BLS API request failed: ${data.message?.join(", ")}`)
  }

  const series = data.Results.series[0]
  if (!series) {
    throw new Error("No series data returned from BLS")
  }

  return series.data
    .map((point) => ({
      date: formatBLSDate(point.year, point.period),
      value: Number.parseFloat(point.value),
      series: seriesId,
      seriesName: seriesName,
    }))
    .filter((point) => !isNaN(point.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

async function fetchBEAData(
  seriesId: string,
  seriesName: string,
  startYear: string,
  endYear: string,
): Promise<EconomicDataPoint[]> {
  const apiKey = process.env.BEA_API_KEY
  if (!apiKey) {
    throw new Error("BEA API key not configured")
  }

  const url = `https://apps.bea.gov/api/data/?UserID=${apiKey}&method=GetData&datasetname=NIPA&TableName=T10101&Frequency=Q&Year=${startYear},${endYear}&ResultFormat=json`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`BEA API error: ${response.status}`)
  }

  const data: BEAResponse = await response.json()

  return data.BEAAPI.Results.Data.map((point) => ({
    date: formatBEADate(point.TimePeriod),
    value: Number.parseFloat(point.DataValue.replace(/,/g, "")),
    series: seriesId,
    seriesName: seriesName,
  }))
    .filter((point) => !isNaN(point.value))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

async function saveToGitHub(series: string, data: EconomicDataPoint[], config: any): Promise<void> {
  try {
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return

    const fileName = `${series}_${config.source.toLowerCase()}.json`
    const filePath = `economic_data/US/${fileName}`
    const apiUrl = `https://api.github.com/repos/tienhotze/market_data_download/contents/${filePath}`

    const fileContent = {
      series,
      seriesName: config.name,
      source: config.source,
      unit: config.unit,
      frequency: config.frequency,
      lastUpdated: new Date().toISOString(),
      data,
    }

    const encodedContent = Buffer.from(JSON.stringify(fileContent, null, 2)).toString("base64")

    // Check if file exists
    let existingSha: string | undefined
    try {
      const existingResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      })
      if (existingResponse.ok) {
        const existingFile = await existingResponse.json()
        existingSha = existingFile.sha
      }
    } catch (error) {
      // File doesn't exist, will create new
    }

    const requestBody: any = {
      message: `Update ${config.name} data - ${new Date().toISOString().split("T")[0]}`,
      content: encodedContent,
    }

    if (existingSha) {
      requestBody.sha = existingSha
    }

    await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    console.error("Error saving to GitHub:", error)
  }
}

function formatBLSDate(year: string, period: string): string {
  // BLS periods: M01-M12 for months, Q01-Q04 for quarters
  if (period.startsWith("M")) {
    const month = period.substring(1).padStart(2, "0")
    return `${year}-${month}-01`
  } else if (period.startsWith("Q")) {
    const quarter = Number.parseInt(period.substring(1))
    const month = ((quarter - 1) * 3 + 1).toString().padStart(2, "0")
    return `${year}-${month}-01`
  }
  return `${year}-01-01`
}

function formatBEADate(timePeriod: string): string {
  // BEA format: 2023Q1, 2023Q2, etc.
  if (timePeriod.includes("Q")) {
    const [year, quarter] = timePeriod.split("Q")
    const month = ((Number.parseInt(quarter) - 1) * 3 + 1).toString().padStart(2, "0")
    return `${year}-${month}-01`
  }
  return timePeriod
}

function isDataStale(data: EconomicDataPoint[]): boolean {
  if (!data || data.length === 0) return true

  const lastDataDate = new Date(data[data.length - 1].date)
  const now = new Date()
  const daysSinceLastData = (now.getTime() - lastDataDate.getTime()) / (1000 * 60 * 60 * 24)

  // Consider data stale if it's more than 30 days old
  return daysSinceLastData > 30
}
