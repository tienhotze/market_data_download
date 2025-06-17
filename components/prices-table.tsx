"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { TickerData } from "@/types"

interface PricesTableProps {
  ticker: TickerData
  dateRange: { start: string; end: string } | null
  data: any[]
  loading: boolean
  period?: string
}

export function PricesTable({ ticker, dateRange, data, loading, period = "1mo" }: PricesTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const itemsPerPage = 20
  const totalPages = Math.ceil(data.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = data.slice(startIndex, endIndex)

  const handleSaveCSV = async () => {
    setSaving(true)
    try {
      const response = await fetch("/api/save_prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.symbol,
          data: data,
          period: period,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success!",
          description: (
            <div>
              <p>CSV saved to GitHub</p>
              <p className="text-xs text-gray-600 mt-1">SHA: {result.sha}</p>
              <a
                href={result.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs"
              >
                View commit →
              </a>
            </div>
          ),
        })
      } else {
        throw new Error("Failed to save CSV")
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save CSV to GitHub. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading price data...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>OHLCV Daily - {ticker.symbol}</CardTitle>
        <Button onClick={handleSaveCSV} disabled={data.length === 0 || saving} className="flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Save CSV
        </Button>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No price data available for the selected period. This could be due to:
            <ul className="mt-2 text-sm">
              <li>• Invalid ticker symbol</li>
              <li>• No trading data for the selected period</li>
              <li>• Yahoo Finance API temporarily unavailable</li>
            </ul>
          </div>
        ) : (
          <>
            <div className="table-container">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">Close</TableHead>
                    <TableHead className="text-right">Adj Close</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.Date}</TableCell>
                      <TableCell className="text-right">{row.Open?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell className="text-right">{row.High?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell className="text-right">{row.Low?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell className="text-right">{row.Close?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell className="text-right">{row["Adj Close"]?.toFixed(2) || "N/A"}</TableCell>
                      <TableCell className="text-right">{row.Volume?.toLocaleString() || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
