import { type NextRequest, NextResponse } from "next/server"
import { assetPricesPool } from "@/lib/db"
import { PoolClient } from "pg"

// Function to resample data to higher timeframes
function resampleData(data: any[], targetTimeframe: string): any[] {
  if (data.length === 0) return data;
  
  const resampled: any[] = [];
  const timeframeMap: Record<string, number> = {
    '1min': 1,
    '5min': 5,
    '1hour': 60,
    '4hour': 240,
    '12hour': 720,
    'daily': 1440,
    'weekly': 10080,
    'monthly': 43200,
    'yearly': 525600
  };
  
  const targetMinutes = timeframeMap[targetTimeframe] || 1440; // Default to daily
  
  // Group data by target timeframe
  const grouped = new Map<string, any[]>();
  
  data.forEach(row => {
    const date = new Date(row.date);
    let key: string;
    
    if (targetTimeframe === 'daily') {
      key = date.toISOString().split('T')[0];
    } else if (targetTimeframe === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (targetTimeframe === 'monthly') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (targetTimeframe === 'yearly') {
      key = date.getFullYear().toString();
    } else {
      // For intraday timeframes, use the original timestamp
      key = row.date;
    }
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(row);
  });
  
  // Calculate OHLCV for each group
  grouped.forEach((group, key) => {
    if (group.length > 0) {
      const values = group.map((row: any) => parseFloat(row.value));
      const resampledRow = {
        date: group[0].date,
        value: values[values.length - 1] // Use close price (last value)
      };
      resampled.push(resampledRow);
    }
  });
  
  return resampled.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")
  const timeframe = searchParams.get("timeframe") || "daily"
  const days = searchParams.get("days") || "365"

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 })
  }

  let client: PoolClient | null = null
  try {
    client = await assetPricesPool.connect()
    
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
    
    // First try to get data from the requested timeframe
    let query = `
      SELECT T2.timestamp as date, T2.close as value 
      FROM assets AS T1 
      JOIN ${tableName} AS T2 ON T1.id = T2.asset_id 
      WHERE T1.symbol = $1 
      AND T2.timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY T2.timestamp ASC;
    `;
    
    let { rows } = await client.query(query, [symbol]);
    
    // If no data found in requested timeframe, try to resample from lower timeframes
    if (rows.length === 0) {
      console.log(`No data found in ${timeframe} for ${symbol}, trying to resample...`);
      
      // Try to get data from the highest available timeframe
      const availableTimeframes = ['prices_ohlcv_1min', 'prices_ohlcv_5min', 'prices_ohlcv_1hour', 'prices_ohlcv_4hour', 'prices_ohlcv_12hour', 'prices_ohlcv_daily'];
      
      for (const table of availableTimeframes) {
        const resampleQuery = `
          SELECT T2.timestamp as date, T2.close as value 
          FROM assets AS T1 
          JOIN ${table} AS T2 ON T1.id = T2.asset_id 
          WHERE T1.symbol = $1 
          AND T2.timestamp >= NOW() - INTERVAL '${parseInt(days) * 2} days'
          ORDER BY T2.timestamp ASC;
        `;
        
        const resampleResult = await client.query(resampleQuery, [symbol]);
        
        if (resampleResult.rows.length > 0) {
          console.log(`Found data in ${table} for ${symbol}, resampling to ${timeframe}`);
          rows = resampleData(resampleResult.rows, timeframe);
          break;
        }
      }
    }
    
    if (rows.length === 0) {
      return NextResponse.json({ error: `No data found for symbol: ${symbol}` }, { status: 404 })
    }

    const data = rows.map(row => ({
      date: new Date(row.date).toISOString().split('T')[0],
      value: parseFloat(row.value)
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error(`Error fetching asset data for ${symbol}:`, error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"
    return NextResponse.json({ error: `Failed to fetch asset data: ${errorMessage}` }, { status: 500 })
  } finally {
    if (client) {
      client.release()
    }
  }
}
