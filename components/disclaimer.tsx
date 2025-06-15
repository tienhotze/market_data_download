import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export function Disclaimer() {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-2">Important Disclaimer</p>
            <p className="mb-2">
              This tool uses Yahoo Finance data for research purposes only. Please review the{" "}
              <a
                href="https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                Yahoo Finance Terms of Service
              </a>{" "}
              before using this data.
            </p>
            <p>
              Data is provided "as is" and should not be used for trading decisions. Always verify data accuracy from
              official sources.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
