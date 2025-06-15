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
    let researchSource = "Mock"

    // Try to fetch real news data
    try {
      newsData = await fetchYahooNews(ticker)
      newsSource = "Yahoo Finance"
    } catch (error) {
      console.log("Yahoo news failed, using mock data:", error)
      newsData = generateMockNews(ticker)
    }

    // Try to fetch real research data
    try {
      researchData = await fetchYahooResearch(ticker)
      researchSource = "Yahoo Finance"
    } catch (error) {
      console.log("Yahoo research failed, using mock data:", error)
      researchData = generateMockResearch(ticker)
    }

    return NextResponse.json({
      news: newsData,
      research: researchData,
      ticker,
      sources: {
        news: newsSource,
        research: researchSource,
      },
      warning:
        newsSource === "Mock" || researchSource === "Mock" ? "Some data is mock due to API limitations" : undefined,
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

async function fetchYahooResearch(symbol: string) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=recommendationTrend,upgradeDowngradeHistory`

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
    throw new Error(`Research API returned ${response.status}`)
  }

  const data = await response.json()
  const result = data.quoteSummary?.result?.[0]
  const upgrades = result?.upgradeDowngradeHistory?.history || []

  if (upgrades.length === 0) {
    throw new Error("No research data returned")
  }

  return upgrades.slice(0, 10).map((item: any, index: number) => ({
    id: `research_${index}`,
    title: `${item.firm || "Unknown Firm"} - ${item.toGrade || "N/A"}`,
    publisher: item.firm || "Unknown Firm",
    publishedAt: new Date((item.epochGradeDate || Date.now() / 1000) * 1000).toISOString(),
    url: "",
    summary: `Grade: ${item.toGrade || "N/A"}${item.fromGrade ? `, Previous: ${item.fromGrade}` : ""}`,
  }))
}

function generateMockNews(ticker: string) {
  const newsTemplates = [
    `${ticker} Reports Strong Quarterly Earnings Beat`,
    `Analysts Upgrade ${ticker} Price Target on Growth Outlook`,
    `${ticker} Announces Strategic Partnership Deal`,
    `Market Volatility Impacts ${ticker} Trading Volume`,
    `${ticker} CEO Discusses Future Innovation Plans`,
    `Institutional Investors Increase ${ticker} Holdings`,
    `${ticker} Dividend Announcement Boosts Investor Confidence`,
    `Technical Analysis: ${ticker} Shows Bullish Pattern`,
  ]

  const publishers = ["Reuters", "Bloomberg", "CNBC", "MarketWatch", "Yahoo Finance", "Seeking Alpha"]

  return newsTemplates.slice(0, 6).map((title, index) => ({
    id: `mock_news_${index}`,
    title,
    publisher: publishers[index % publishers.length],
    publishedAt: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
    url: `https://example.com/news/${ticker.toLowerCase()}-${index}`,
    summary: `This is a mock news summary about ${ticker}. In a real implementation, this would contain actual news content from financial news sources.`,
  }))
}

function generateMockResearch(ticker: string) {
  const firms = ["Goldman Sachs", "Morgan Stanley", "JP Morgan", "Bank of America", "Citigroup", "Wells Fargo"]
  const grades = ["Strong Buy", "Buy", "Hold", "Outperform", "Neutral", "Overweight"]
  const previousGrades = ["Hold", "Buy", "Neutral", "Underweight", "Sell", "Hold"]

  return firms.slice(0, 5).map((firm, index) => ({
    id: `mock_research_${index}`,
    title: `${firm} - ${grades[index % grades.length]}`,
    publisher: firm,
    publishedAt: new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000).toISOString(),
    url: "",
    summary: `Grade: ${grades[index % grades.length]}, Previous: ${previousGrades[index % previousGrades.length]}. Price target updated based on recent performance analysis.`,
  }))
}
