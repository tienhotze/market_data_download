import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { q: query, limit = 10 } = body

    if (!query || query.length < 1) {
      return NextResponse.json([])
    }

    const searchQuery = query.trim().toUpperCase()

    // Comprehensive ticker database
    const allTickers: Record<string, { name: string; type: string }> = {
      // Major Tech Stocks
      AAPL: { name: "Apple Inc.", type: "Equity" },
      MSFT: { name: "Microsoft Corporation", type: "Equity" },
      GOOGL: { name: "Alphabet Inc. Class A", type: "Equity" },
      GOOG: { name: "Alphabet Inc. Class C", type: "Equity" },
      AMZN: { name: "Amazon.com Inc.", type: "Equity" },
      TSLA: { name: "Tesla Inc.", type: "Equity" },
      META: { name: "Meta Platforms Inc.", type: "Equity" },
      NVDA: { name: "NVIDIA Corporation", type: "Equity" },
      NFLX: { name: "Netflix Inc.", type: "Equity" },
      ADBE: { name: "Adobe Inc.", type: "Equity" },

      // Financial Stocks
      JPM: { name: "JPMorgan Chase & Co.", type: "Equity" },
      BAC: { name: "Bank of America Corp.", type: "Equity" },
      WFC: { name: "Wells Fargo & Company", type: "Equity" },
      V: { name: "Visa Inc.", type: "Equity" },
      MA: { name: "Mastercard Inc.", type: "Equity" },

      // Healthcare & Pharma
      JNJ: { name: "Johnson & Johnson", type: "Equity" },
      PFE: { name: "Pfizer Inc.", type: "Equity" },
      UNH: { name: "UnitedHealth Group Inc.", type: "Equity" },

      // Consumer & Retail
      WMT: { name: "Walmart Inc.", type: "Equity" },
      HD: { name: "Home Depot Inc.", type: "Equity" },
      DIS: { name: "Walt Disney Company", type: "Equity" },
      KO: { name: "Coca-Cola Company", type: "Equity" },

      // ETFs
      SPY: { name: "SPDR S&P 500 ETF Trust", type: "ETF" },
      QQQ: { name: "Invesco QQQ Trust", type: "ETF" },
      VTI: { name: "Vanguard Total Stock Market ETF", type: "ETF" },
      IWM: { name: "iShares Russell 2000 ETF", type: "ETF" },
      GLD: { name: "SPDR Gold Shares", type: "ETF" },

      // Crypto
      "BTC-USD": { name: "Bitcoin USD", type: "Cryptocurrency" },
      "ETH-USD": { name: "Ethereum USD", type: "Cryptocurrency" },

      // Indices
      "^GSPC": { name: "S&P 500", type: "Index" },
      "^DJI": { name: "Dow Jones Industrial Average", type: "Index" },
      "^IXIC": { name: "NASDAQ Composite", type: "Index" },
    }

    const results = []

    // Exact match first
    if (allTickers[searchQuery]) {
      results.push({
        symbol: searchQuery,
        name: allTickers[searchQuery].name,
        type: allTickers[searchQuery].type,
      })
    }

    // Partial matches
    for (const [symbol, info] of Object.entries(allTickers)) {
      if (results.length >= limit) break

      if (results.some((r) => r.symbol === symbol)) continue

      if (
        symbol.includes(searchQuery) ||
        symbol.startsWith(searchQuery) ||
        info.name.toUpperCase().includes(searchQuery)
      ) {
        results.push({
          symbol,
          name: info.name,
          type: info.type,
        })
      }
    }

    return NextResponse.json(results.slice(0, limit))
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
