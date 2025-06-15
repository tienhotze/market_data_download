import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ticker, type, items } = body

    if (!ticker || !type || !items) {
      return NextResponse.json({ error: "Ticker, type, and items are required" }, { status: 400 })
    }

    if (!["news", "research"].includes(type)) {
      return NextResponse.json({ error: "Type must be news or research" }, { status: 400 })
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

    // Create JSON content
    const jsonContent = JSON.stringify(
      {
        asOf: new Date().toISOString(),
        items,
      },
      null,
      2,
    )

    // Create file path
    const today = new Date().toISOString().split("T")[0]
    const filePath = `${type}/${ticker}/${today}.json`
    const commitMessage = `feat: ${ticker} ${type} to ${today}`

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
          content: Buffer.from(jsonContent).toString("base64"),
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
    console.error("Save docs error:", error)
    return NextResponse.json(
      {
        error: `Failed to save docs: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
