import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset1 = searchParams.get("asset1");
  const asset2 = searchParams.get("asset2");
  const timeframe = searchParams.get("timeframe") || "daily";
  const window = searchParams.get("window") || "10y";

  if (!asset1 || !asset2) {
    return NextResponse.json({ error: "asset1 and asset2 parameters are required" }, { status: 400 });
  }

  let client: PoolClient | null = null;
  try {
    client = await assetPricesPool.connect();
    
    // Calculate days based on window
    let days = 3650; // Default to 10 years
    const windowMap: Record<string, number> = {
      "1y": 365, "2y": 730, "5y": 1825, "10y": 3650
    };
    days = windowMap[window] || 3650;

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
      AND T2.timestamp >= NOW() - INTERVAL '${days} days'
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

    // Normalize prices to start at 100 for better comparison
    const normalizePrices = (data: { date: string; value: number }[]) => {
      if (data.length === 0) return data;
      const firstValue = data[0].value;
      return data.map(item => ({
        date: item.date,
        value: (item.value / firstValue) * 100
      }));
    };

    const normalizedAsset1Data = normalizePrices(asset1Data);
    const normalizedAsset2Data = normalizePrices(asset2Data);

    return NextResponse.json({
      asset1: normalizedAsset1Data,
      asset2: normalizedAsset2Data
    });

  } catch (error) {
    console.error(`Error fetching price data for ${asset1} vs ${asset2}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to fetch price data: ${errorMessage}` }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
} 