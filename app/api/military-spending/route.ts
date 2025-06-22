import { type NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"

interface MilitaryAidData {
  year: number
  country: string
  militaryAid: number
  economicAid: number
  humanitarianAid: number
  total: number
  source: string
  notes?: string
}

// Military aid data configurations
const MILITARY_AID_SERIES = {
  israel: {
    name: "Israel",
    source: "DB",
    categories: ["military", "economic", "humanitarian"],
  },
  ukraine: {
    name: "Ukraine", 
    source: "DB",
    categories: ["military", "economic", "humanitarian"],
  },
  // Add more countries as needed
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const country = searchParams.get("country")
  const startYear = searchParams.get("startYear")
  const endYear = searchParams.get("endYear")

  if (!country || !MILITARY_AID_SERIES[country as keyof typeof MILITARY_AID_SERIES]) {
    return NextResponse.json({ error: "Invalid country specified" }, { status: 400 })
  }

  const countryConfig = MILITARY_AID_SERIES[country as keyof typeof MILITARY_AID_SERIES]

  try {
    let query = `SELECT year, country, military_aid, economic_aid, humanitarian_aid, total, source, notes 
                 FROM military_aid_data WHERE country = $1`
    const params: (string | number)[] = [country]
    let paramIndex = 2

    if (startYear) {
      query += ` AND year >= $${paramIndex++}`
      params.push(parseInt(startYear))
    }

    if (endYear) {
      query += ` AND year <= $${paramIndex++}`
      params.push(parseInt(endYear))
    }

    query += ` ORDER BY year ASC`

    const client = await pool.connect()
    try {
      const result = await client.query(query, params)

      const data: MilitaryAidData[] = result.rows.map((row) => ({
        year: row.year,
        country: row.country,
        militaryAid: parseFloat(row.military_aid || 0),
        economicAid: parseFloat(row.economic_aid || 0),
        humanitarianAid: parseFloat(row.humanitarian_aid || 0),
        total: parseFloat(row.total || 0),
        source: row.source,
        notes: row.notes,
      }))

      // Calculate summary statistics
      const summary = {
        totalMilitaryAid: data.reduce((sum, item) => sum + item.militaryAid, 0),
        totalEconomicAid: data.reduce((sum, item) => sum + item.economicAid, 0),
        totalHumanitarianAid: data.reduce((sum, item) => sum + item.humanitarianAid, 0),
        grandTotal: data.reduce((sum, item) => sum + item.total, 0),
        yearRange: data.length > 0 ? `${Math.min(...data.map(d => d.year))}-${Math.max(...data.map(d => d.year))}` : "N/A",
        dataPoints: data.length,
      }

      return NextResponse.json({
        country,
        countryName: countryConfig.name,
        data: data,
        summary,
        source: countryConfig.source,
        categories: countryConfig.categories,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error(`Error fetching ${country} military aid data from database:`, error)
    
    // Return mock data for Israel if database is not available
    if (country === "israel") {
      const mockData: MilitaryAidData[] = [
        { year: 2015, country: "israel", militaryAid: 3.1, economicAid: 0.5, humanitarianAid: 0.1, total: 3.7, source: "Congressional Research Service" },
        { year: 2016, country: "israel", militaryAid: 3.1, economicAid: 0.5, humanitarianAid: 0.1, total: 3.7, source: "Congressional Research Service" },
        { year: 2017, country: "israel", militaryAid: 3.1, economicAid: 0.5, humanitarianAid: 0.1, total: 3.7, source: "Congressional Research Service" },
        { year: 2018, country: "israel", militaryAid: 3.3, economicAid: 0.5, humanitarianAid: 0.1, total: 3.9, source: "Congressional Research Service" },
        { year: 2019, country: "israel", militaryAid: 3.3, economicAid: 0.5, humanitarianAid: 0.1, total: 3.9, source: "Congressional Research Service" },
        { year: 2020, country: "israel", militaryAid: 3.3, economicAid: 0.5, humanitarianAid: 0.1, total: 3.9, source: "Congressional Research Service" },
        { year: 2021, country: "israel", militaryAid: 3.3, economicAid: 0.5, humanitarianAid: 0.1, total: 3.9, source: "Congressional Research Service" },
        { year: 2022, country: "israel", militaryAid: 3.3, economicAid: 0.5, humanitarianAid: 0.1, total: 3.9, source: "Congressional Research Service" },
        { year: 2023, country: "israel", militaryAid: 3.8, economicAid: 0.5, humanitarianAid: 0.1, total: 4.4, source: "Congressional Research Service" },
        { year: 2024, country: "israel", militaryAid: 3.8, economicAid: 0.5, humanitarianAid: 0.1, total: 4.4, source: "Congressional Research Service" },
        { year: 2025, country: "israel", militaryAid: 1.2, economicAid: 0.2, humanitarianAid: 0.05, total: 1.45, source: "YTD Estimate" },
      ]

      const summary = {
        totalMilitaryAid: mockData.reduce((sum, item) => sum + item.militaryAid, 0),
        totalEconomicAid: mockData.reduce((sum, item) => sum + item.economicAid, 0),
        totalHumanitarianAid: mockData.reduce((sum, item) => sum + item.humanitarianAid, 0),
        grandTotal: mockData.reduce((sum, item) => sum + item.total, 0),
        yearRange: "2015-2025",
        dataPoints: mockData.length,
      }

      return NextResponse.json({
        country,
        countryName: countryConfig.name,
        data: mockData,
        summary,
        source: "Mock Data (Database Unavailable)",
        categories: countryConfig.categories,
      })
    }

    return NextResponse.json(
      { error: `Failed to fetch ${country} military aid data: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    )
  }
} 