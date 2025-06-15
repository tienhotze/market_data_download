"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestPage() {
  const [testResults, setTestResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const runTest = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test_yfinance")
      const data = await response.json()
      setTestResults(data.results || [])
    } catch (error) {
      setTestResults([`Test failed: ${error}`])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>YFinance Debug Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTest} disabled={loading}>
            {loading ? "Running Test..." : "Run YFinance Test"}
          </Button>

          {testResults.length > 0 && (
            <div className="bg-gray-100 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Test Results:</h3>
              <pre className="text-sm whitespace-pre-wrap">{testResults.join("\n")}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
