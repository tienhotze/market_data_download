import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

function calculateCorrelation(data1: number[], data2: number[]): number {
  if (data1.length !== data2.length || data1.length === 0) return 0;
  
  const n = data1.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n;
  
  const numerator = data1.reduce((sum, val, i) => 
    sum + (val - mean1) * (data2[i] - mean2), 0
  );
  
  const denominator1 = Math.sqrt(data1.reduce((sum, val) => 
    sum + Math.pow(val - mean1, 2), 0
  ));
  const denominator2 = Math.sqrt(data2.reduce((sum, val) => 
    sum + Math.pow(val - mean2, 2), 0
  ));
  
  return denominator1 * denominator2 === 0 ? 0 : numerator / (denominator1 * denominator2);
}

function calculateBeta(assetReturns: number[], marketReturns: number[]): number {
  if (assetReturns.length !== marketReturns.length || assetReturns.length === 0) return 0;
  
  const covariance = calculateCovariance(assetReturns, marketReturns);
  const marketVariance = calculateVariance(marketReturns);
  
  return marketVariance === 0 ? 0 : covariance / marketVariance;
}

function calculateCovariance(data1: number[], data2: number[]): number {
  const n = data1.length;
  const mean1 = data1.reduce((a, b) => a + b, 0) / n;
  const mean2 = data2.reduce((a, b) => a + b, 0) / n;
  
  return data1.reduce((sum, val, i) => 
    sum + (val - mean1) * (data2[i] - mean2), 0
  ) / n;
}

function calculateVariance(data: number[]): number {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  
  return data.reduce((sum, val) => 
    sum + Math.pow(val - mean, 2), 0
  ) / n;
}

function calculatePercentChanges(data: { date: string; value: number }[], periods: number): { date: string; change: number }[] {
  const changes: { date: string; change: number }[] = [];
  for (let i = periods; i < data.length; i++) {
    const currentPrice = data[i].value;
    const previousPrice = data[i - periods].value;
    changes.push({
      date: data[i].date,
      change: (currentPrice / previousPrice) - 1
    });
  }
  return changes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset1 = searchParams.get("asset1");
  const asset2 = searchParams.get("asset2");
  const type = searchParams.get("type") as "correlation" | "beta";
  const timeframe = searchParams.get("timeframe") || "daily";
  const window = searchParams.get("window") || "12m";

  if (!asset1 || !asset2 || !type) {
    return NextResponse.json({ error: "asset1, asset2, and type parameters are required" }, { status: 400 });
  }

  if (type !== "correlation" && type !== "beta") {
    return NextResponse.json({ error: "type must be 'correlation' or 'beta'" }, { status: 400 });
  }

  let client: PoolClient | null = null;
  try {
    client = await assetPricesPool.connect();
    
    // Calculate days based on window
    let days = 365;
    if (window === "custom") {
      days = 365;
    } else {
      const windowMap: Record<string, number> = {
        "1m": 30, "3m": 90, "6m": 180, "12m": 365,
        "2y": 730, "5y": 1825, "10y": 3650
      };
      days = windowMap[window] || 365;
    }

    // Map timeframe to table name
    const timeframeToTable: Record<string, string> = {
      '1min': 'prices_ohlcv_1min',
      '5min': 'prices_ohlcv_5min',
      '1hour': 'prices_ohlcv_1hour',
      '4hour': 'prices_ohlcv_4hour',
      '12hour': 'prices_ohlcv_12hour',
      'daily': 'prices_ohlcv_daily',
      'weekly': 'prices_ohlcv_weekly',
      'monthly': 'prices_ohlcv_monthly',
      'yearly': 'prices_ohlcv_yearly'
    };
    
    const tableName = timeframeToTable[timeframe];
    if (!tableName) {
      return NextResponse.json({ error: `Invalid timeframe: ${timeframe}` }, { status: 400 });
    }

    // Fetch data for both assets
    const query = `
      SELECT T1.symbol, T2.timestamp as date, T2.close as value 
      FROM assets AS T1 
      JOIN ${tableName} AS T2 ON T1.id = T2.asset_id 
      WHERE T1.symbol IN ($1, $2)
      AND T2.timestamp >= NOW() - INTERVAL '${days * 2} days'
      ORDER BY T1.symbol, T2.timestamp ASC;
    `;
    
    const { rows } = await client.query(query, [asset1, asset2]);
    
    if (rows.length === 0) {
      return NextResponse.json({ error: `No data found for assets: ${asset1}, ${asset2}` }, { status: 404 });
    }

    // Separate data by asset
    const asset1Data = rows.filter(row => row.symbol === asset1).map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      value: parseFloat(row.value)
    }));
    
    const asset2Data = rows.filter(row => row.symbol === asset2).map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      value: parseFloat(row.value)
    }));

    // Calculate percent changes (1-period)
    const asset1Changes = calculatePercentChanges(asset1Data, 1);
    const asset2Changes = calculatePercentChanges(asset2Data, 1);

    // Create date mapping for alignment
    const dateMap = new Map<string, { asset1: number; asset2: number }>();
    
    asset1Changes.forEach(change => {
      if (!dateMap.has(change.date)) {
        dateMap.set(change.date, { asset1: change.change, asset2: 0 });
      } else {
        dateMap.get(change.date)!.asset1 = change.change;
      }
    });
    
    asset2Changes.forEach(change => {
      if (!dateMap.has(change.date)) {
        dateMap.set(change.date, { asset1: 0, asset2: change.change });
      } else {
        dateMap.get(change.date)!.asset2 = change.change;
      }
    });

    // Convert to arrays and filter out incomplete data
    const alignedData = Array.from(dateMap.entries())
      .filter(([_, values]) => values.asset1 !== 0 && values.asset2 !== 0)
      .sort(([a], [b]) => a.localeCompare(b));

    if (alignedData.length < 30) {
      return NextResponse.json({ error: "Insufficient overlapping data for rolling analysis" }, { status: 400 });
    }

    // Calculate rolling metrics
    const rollingWindow = Math.min(30, Math.floor(alignedData.length / 3)); // 30 days or 1/3 of data
    const rollingDates: string[] = [];
    const rollingValues: number[] = [];

    for (let i = rollingWindow; i < alignedData.length; i++) {
      const windowData = alignedData.slice(i - rollingWindow, i);
      const asset1Returns = windowData.map(([_, values]) => values.asset1);
      const asset2Returns = windowData.map(([_, values]) => values.asset2);
      
      const metric = type === "correlation" 
        ? calculateCorrelation(asset1Returns, asset2Returns)
        : calculateBeta(asset1Returns, asset2Returns);
      
      rollingDates.push(alignedData[i][0]);
      rollingValues.push(metric);
    }

    return NextResponse.json({
      dates: rollingDates,
      values: rollingValues
    });

  } catch (error) {
    console.error(`Error calculating rolling ${type} for ${asset1} vs ${asset2}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to calculate rolling ${type}: ${errorMessage}` }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
} 