import { type NextRequest, NextResponse } from "next/server"
import { economicDataPool } from "@/lib/db"

interface EconomicDataPoint {
  date: string
  value: number
  series: string
  seriesName: string
}

// Economic data series configurations
const ECONOMIC_SERIES = {
  // BLS Data
  unemployment: {
    id: "LNS14000000",
    name: "Unemployment Rate",
    source: "DB",
    unit: "%",
    frequency: "monthly",
  },
  cpi: {
    id: "CUUR0000SA0",
    name: "Consumer Price Index",
    source: "DB",
    unit: "Index",
    frequency: "monthly",
  },
  coreCpi: {
    id: "CUSR0000SA0L1E",
    name: "Core Consumer Price Index",
    source: "DB",
    unit: "Index",
    frequency: "monthly",
  },
  jobsAdded: {
    id: "CES0000000001",
    name: "Total Nonfarm Payrolls",
    source: "DB",
    unit: "Thousands",
    frequency: "monthly",
  },
  // BEA Data
  gdp: {
    id: "A191RL1Q225SBEA",
    name: "Real GDP",
    source: "DB",
    unit: "Billions",
    frequency: "quarterly",
  },
  retailSales: {
    id: "RSAFS",
    name: "Retail Sales",
    source: "DB",
    unit: "Millions",
    frequency: "monthly",
  },
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const series = searchParams.get("series")
  const startYear = searchParams.get("startYear")
  const endYear = searchParams.get("endYear")

  if (!series || !ECONOMIC_SERIES[series as keyof typeof ECONOMIC_SERIES]) {
    return NextResponse.json({ error: "Invalid series specified" }, { status: 400 })
  }

  const seriesConfig = ECONOMIC_SERIES[series as keyof typeof ECONOMIC_SERIES]

  try {
    let query = `SELECT date, value FROM indicator_values WHERE series_id = $1`
    const params: (string | number)[] = [seriesConfig.id]
    let paramIndex = 2

    if (startYear) {
      query += ` AND date >= $${paramIndex++}`
      params.push(`${startYear}-01-01`)
    }

    if (endYear) {
      query += ` AND date <= $${paramIndex++}`
      params.push(`${endYear}-12-31`)
    }

    query += ` ORDER BY date ASC`

    const client = await economicDataPool.connect()
    try {
      const result = await client.query(query, params)

      const data: EconomicDataPoint[] = result.rows.map((row) => ({
        date: new Date(row.date).toISOString().split("T")[0],
        value: parseFloat(row.value),
        series: seriesConfig.id,
        seriesName: seriesConfig.name,
      }))

      return NextResponse.json({
        series,
        seriesName: seriesConfig.name,
        data: data,
        source: seriesConfig.source,
        unit: seriesConfig.unit,
        frequency: seriesConfig.frequency,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error(`Error fetching ${series} data from database:`, error)
    return NextResponse.json(
      { error: `Failed to fetch ${series} data: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
}
