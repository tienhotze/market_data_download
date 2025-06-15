import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, data, period } = body

    if (!ticker || !data) {
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

    // Create CSV content
    const csvContent = [
      "Date,Open,High,Low,Close,Adj Close,Volume",
      ...data.map(
        (row: any) => `${row.Date},${row.Open},${row.High},${row.Low},${row.Close},${row["Adj Close"]},${row.Volume}`,
      ),
    ].join("\n")

    // Create file path
    const today = new Date().toISOString().split("T")[0]
    const filePath = `data/${ticker}/${today}_${period}.csv`
    const commitMessage = `feat: ${ticker} prices for ${period} period on ${today}`

    // GitHub API call
    const repoOwner = "tienhotze"
    const repoName = "market_data_download"
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`

    try {
      // Try to get existing file first
      const existingResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      let sha = undefined
      if (existingResponse.ok) {
        const existingFile = await existingResponse.json()
        sha = existingFile.sha
      }

      // Create or update file
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: commitMessage,
          content: Buffer.from(csvContent).toString("base64"),
          ...(sha && { sha }),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`GitHub API error: ${errorData.message}`)
      }

      const result = await response.json()

      return NextResponse.json({
        sha: result.commit.sha,
        githubUrl: `https://github.com/${repoOwner}/${repoName}/blob/main/${filePath}`,
        path: filePath,
      })
    } catch (githubError) {
      console.error("GitHub API error:", githubError)
      return NextResponse.json(
        {
          error: `Failed to save to GitHub: ${githubError instanceof Error ? githubError.message : "Unknown error"}`,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Save prices error:", error)
    return NextResponse.json(
      {
        error: `Failed to save prices: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
