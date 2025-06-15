import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker } = body

    if (!ticker) {
      return NextResponse.json({ error: "Ticker is required" }, { status: 400 })
    }

    console.log(`Fetching news and research for ${ticker}`)

    let newsData: any[] = []
    let researchData: any[] = []
    let newsSource = "Mock"
    const researchSource = "Mock"

    // Try to fetch real news data
    try {
      newsData = await fetchYahooNews(ticker)
      newsSource = "Yahoo Finance"
    } catch (error) {
      console.log("Yahoo news failed:", error)
      newsData = []
      newsSource = "None"
    }

    // Try to fetch real research data (currently not implemented)
    console.log("Research API not implemented - no data available")
    researchData = []

    return NextResponse.json({
      news: newsData,
      research: researchData,
      ticker,
      sources: {
        news: newsSource,
        research: "None",
      },
    })
  } catch (error) {
    console.error("Fetch docs error:", error)
    return NextResponse.json({ error: "Failed to fetch docs" }, { status: 400 })
  }
}

async function fetchYahooNews(symbol: string) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=US&quotesCount=1&newsCount=10`

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
    throw new Error(`News API returned ${response.status}`)
  }

  const data = await response.json()
  const news = data.news || []

  if (news.length === 0) {
    throw new Error("No news data returned")
  }

  return news.slice(0, 10).map((item: any, index: number) => ({
    id: item.uuid || `news_${index}`,
    title: item.title || "No title",
    publisher: item.publisher || "Unknown",
    publishedAt: new Date((item.providerPublishTime || Date.now() / 1000) * 1000).toISOString(),
    url: item.link || "",
    summary: item.summary || "No summary available",
  }))
}
