# FX Markets Page - Implementation Plan

## 1. Database Connection and Query Logic

### Extending lib/db.ts

First, we need to extend the database connection logic to include access to the funding_rates table:

```typescript
// lib/db.ts
import { Pool } from "pg";

// Existing connections...
const economicDataPool = new Pool({
  user: "postgres",
  host: process.env.PG_HOST || "192.53.174.253",
  database: "economic_data",
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});

const assetPricesPool = new Pool({
  user: "postgres",
  host: process.env.PG_HOST || "192.53.174.253",
  database: "asset_prices",
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
});

// Add helper functions for funding rates
export async function getFundingRates(
  symbols?: string[],
  broker?: string,
  limit?: number
) {
  const client = await assetPricesPool.connect();
  try {
    let query = `
      SELECT 
        a.symbol,
        e.name as broker,
        fr.long_rate,
        fr.short_rate,
        fr.effective_date,
        fr.timestamp
      FROM funding_rates fr
      JOIN assets a ON fr.asset_id = a.id
      JOIN exchanges e ON fr.broker_id = e.id
      WHERE e.name = 'OANDA'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (symbols && symbols.length > 0) {
      query += ` AND a.symbol = ANY($${paramIndex})`;
      params.push(symbols);
      paramIndex++;
    }

    if (broker) {
      query += ` AND e.name = $${paramIndex}`;
      params.push(broker);
      paramIndex++;
    }

    query += ` ORDER BY fr.effective_date DESC, fr.timestamp DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getCurrencyPairsWithFundingRates() {
  const client = await assetPricesPool.connect();
  try {
    const query = `
      SELECT DISTINCT a.symbol
      FROM funding_rates fr
      JOIN assets a ON fr.asset_id = a.id
      JOIN exchanges e ON fr.broker_id = e.id
      WHERE e.name = 'OANDA'
      ORDER BY a.symbol
    `;

    const result = await client.query(query);
    return result.rows.map((row) => row.symbol);
  } finally {
    client.release();
  }
}

export { economicDataPool, assetPricesPool };
```

## 2. API Route for Funding Rates

### API Route: `/api/fx/funding-rates/route.ts`

```typescript
// app/api/fx/funding-rates/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getFundingRates } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const broker = searchParams.get("broker") || "OANDA";
  const symbolsParam = searchParams.get("symbols");
  const limitParam = searchParams.get("limit");

  const symbols = symbolsParam ? symbolsParam.split(",") : undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    const fundingRates = await getFundingRates(symbols, broker, limit);

    return NextResponse.json({
      data: fundingRates,
    });
  } catch (error) {
    console.error("Error fetching funding rates:", error);
    return NextResponse.json(
      { error: "Failed to fetch funding rates" },
      { status: 500 }
    );
  }
}
```

## 3. API Route for Correlation Matrix

### API Route: `/api/fx/correlation-matrix/route.ts`

```typescript
// app/api/fx/correlation-matrix/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";

// Helper function to calculate correlation between two arrays
function calculateCorrelation(data1: number[], data2: number[]): number {
  if (data1.length !== data2.length || data1.length === 0) return 0;

  const n = data1.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n;

  const numerator = data1.reduce(
    (sum, val, i) => sum + (val - mean1) * (data2[i] - mean2),
    0
  );

  const denominator1 = Math.sqrt(
    data1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0)
  );
  const denominator2 = Math.sqrt(
    data2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0)
  );

  return denominator1 * denominator2 === 0
    ? 0
    : numerator / (denominator1 * denominator2);
}

// Helper function to get closing prices for currency pairs
async function getClosingPrices(symbols: string[], days: number) {
  const client = await assetPricesPool.connect();
  try {
    // Get asset IDs for symbols
    const assetQuery = `
      SELECT id, symbol FROM assets WHERE symbol = ANY($1)
    `;
    const assetResult = await client.query(assetQuery, [symbols]);
    const assetMap = new Map(
      assetResult.rows.map((row) => [row.symbol, row.id])
    );

    const prices: Record<string, { date: string; close: number }[]> = {};

    // Get closing prices for each asset
    for (const symbol of symbols) {
      const assetId = assetMap.get(symbol);
      if (!assetId) continue;

      const priceQuery = `
        SELECT timestamp::date as date, close
        FROM prices_ohlcv_daily
        WHERE asset_id = $1
        AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp DESC
      `;

      const priceResult = await client.query(priceQuery, [assetId]);
      prices[symbol] = priceResult.rows.map((row) => ({
        date: row.date,
        close: parseFloat(row.close),
      }));
    }

    return prices;
  } finally {
    client.release();
  }
}

// Helper function to align data to common dates
function alignData(
  prices: Record<string, { date: string; close: number }[]>
): Record<string, number[]> {
  // Get all unique dates
  const allDates = new Set<string>();
  Object.values(prices).forEach((priceArray) => {
    priceArray.forEach((price) => allDates.add(price.date));
  });

  const sortedDates = Array.from(allDates).sort();

  // Create aligned arrays
  const aligned: Record<string, number[]> = {};
  Object.keys(prices).forEach((symbol) => {
    aligned[symbol] = [];
    const symbolPrices = prices[symbol];

    sortedDates.forEach((date) => {
      const priceEntry = symbolPrices.find((p) => p.date === date);
      aligned[symbol].push(priceEntry ? priceEntry.close : NaN);
    });
  });

  // Remove dates with missing data
  const cleanAligned: Record<string, number[]> = {};
  Object.keys(aligned).forEach((symbol) => {
    cleanAligned[symbol] = [];
  });

  for (let i = 0; i < sortedDates.length; i++) {
    let hasMissing = false;
    Object.values(aligned).forEach((prices) => {
      if (isNaN(prices[i])) hasMissing = true;
    });

    if (!hasMissing) {
      Object.keys(aligned).forEach((symbol) => {
        cleanAligned[symbol].push(aligned[symbol][i]);
      });
    }
  }

  return cleanAligned;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days") || "30";
  const symbolsParam = searchParams.get("symbols");

  const days = parseInt(daysParam, 10);
  const symbols = symbolsParam ? symbolsParam.split(",") : undefined;

  try {
    // Get all currency pairs if not specified
    let currencyPairs: string[];
    if (symbols) {
      currencyPairs = symbols;
    } else {
      // Get all currency pairs from the database
      const client = await assetPricesPool.connect();
      try {
        const query = `
          SELECT DISTINCT symbol
          FROM assets
          WHERE symbol IN (
            'AUDJPY','AUDUSD','CADJPY','CADUSD','EURJPY','EURUSD','NZDUSD',
            'USDCAD','USDCNH','USDJPY','USDMXN','USDNOK','USDSGD','USDTHB'
          )
          ORDER BY symbol
        `;
        const result = await client.query(query);
        currencyPairs = result.rows.map((row) => row.symbol);
      } finally {
        client.release();
      }
    }

    // Get closing prices
    const prices = await getClosingPrices(currencyPairs, days);

    // Align data to common dates
    const alignedPrices = alignData(prices);

    // Calculate correlation matrix
    const assets = Object.keys(alignedPrices);
    const matrix: number[][] = [];

    for (let i = 0; i < assets.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < assets.length; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const correlation = calculateCorrelation(
            alignedPrices[assets[i]],
            alignedPrices[assets[j]]
          );
          matrix[i][j] = correlation;
        }
      }
    }

    return NextResponse.json({
      assets,
      matrix,
    });
  } catch (error) {
    console.error("Error calculating correlation matrix:", error);
    return NextResponse.json(
      { error: "Failed to calculate correlation matrix" },
      { status: 500 }
    );
  }
}
```

## 4. FX Markets Page Component

### Main Page Component: `app/fx-markets/page.tsx`

```typescript
// app/fx-markets/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface FundingRate {
  symbol: string;
  broker: string;
  long_rate: number;
  short_rate: number;
  effective_date: string;
  timestamp: string;
}

interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
}

export default function FXMarketsPage() {
  const { toast } = useToast();
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [correlationMatrix, setCorrelationMatrix] =
    useState<CorrelationMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [correlationDays, setCorrelationDays] = useState(30);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);

  // Fetch funding rates on load
  useEffect(() => {
    fetchFundingRates();
  }, []);

  const fetchFundingRates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/fx/funding-rates");
      if (!response.ok) throw new Error("Failed to fetch funding rates");
      const data = await response.json();
      setFundingRates(data.data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch funding rates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCorrelationMatrix = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/fx/correlation-matrix?days=${correlationDays}`
      );
      if (!response.ok) throw new Error("Failed to fetch correlation matrix");
      const data = await response.json();
      setCorrelationMatrix(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch correlation matrix",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCorrelationHeatmap = () => {
    if (!correlationMatrix) return null;

    const colorscale = [
      [0, "#ff0000"],
      [0.5, "#ffff00"],
      [1, "#00ff00"],
    ] as [number, string][];

    const plotData = {
      z: correlationMatrix.matrix,
      x: correlationMatrix.assets,
      y: correlationMatrix.assets,
      type: "heatmap" as const,
      colorscale: colorscale,
      zmin: -1,
      zmax: 1,
      textfont: { size: 10 },
      hoverongaps: false,
    };

    return (
      <Plot
        data={[plotData]}
        layout={{
          title: "FX Correlation Matrix",
          width: 600,
          height: 500,
          xaxis: { title: "Currency Pairs" },
          yaxis: { title: "Currency Pairs" },
        }}
        config={{ responsive: true }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation title="FX Markets Analytics" />

      <div className="w-full mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">FX Markets Analytics</h1>
          <Button onClick={fetchFundingRates} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh Data"
            )}
          </Button>
        </div>

        <Tabs defaultValue="funding" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="funding">Funding Rates</TabsTrigger>
            <TabsTrigger value="correlation">Correlation Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="funding">
            <Card>
              <CardHeader>
                <CardTitle>Funding Rates</CardTitle>
                <CardDescription>
                  Current funding rates for currency pairs from OANDA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading funding rates...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1 text-left">
                            Symbol
                          </th>
                          <th className="border border-gray-300 px-2 py-1 text-right">
                            Long Rate
                          </th>
                          <th className="border border-gray-300 px-2 py-1 text-right">
                            Short Rate
                          </th>
                          <th className="border border-gray-300 px-2 py-1 text-left">
                            Effective Date
                          </th>
                          <th className="border border-gray-300 px-2 py-1 text-left">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundingRates.map((rate, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-2 py-1">
                              {rate.symbol}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {rate.long_rate?.toFixed(6) || "N/A"}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {rate.short_rate?.toFixed(6) || "N/A"}
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                              {rate.effective_date}
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                              {new Date(rate.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlation">
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
                <CardDescription>
                  Cross-correlation matrix for currency pairs using closing
                  prices
                </CardDescription>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="correlation-days">Time Period:</Label>
                    <Select
                      value={correlationDays.toString()}
                      onValueChange={(value) =>
                        setCorrelationDays(parseInt(value))
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                        <SelectItem value="180">180 Days</SelectItem>
                        <SelectItem value="365">1 Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={fetchCorrelationMatrix} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Calculate Matrix"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">
                      Calculating correlation matrix...
                    </span>
                  </div>
                ) : correlationMatrix ? (
                  <div className="flex justify-center">
                    {createCorrelationHeatmap()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Click "Calculate Matrix" to generate the correlation matrix
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

## 5. Additional Considerations

### Error Handling

- Implement proper error handling for database connections
- Add validation for API parameters
- Handle missing data scenarios gracefully

### Performance Optimization

- Implement caching for correlation matrix calculations
- Use database indexes for efficient querying
- Consider pagination for large datasets

### Security

- Validate all API parameters
- Implement rate limiting for API endpoints
- Use environment variables for database credentials

### Testing

- Test with sample data
- Verify correlation calculations
- Check UI responsiveness across devices

This implementation plan provides a comprehensive approach to building the FX markets page with funding rates and cross-correlation matrix functionality.
