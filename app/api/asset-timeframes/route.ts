import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 });
  }

  let client: PoolClient | null = null;
  try {
    client = await assetPricesPool.connect();
    
    // Get asset ID first
    const assetQuery = `SELECT id FROM assets WHERE symbol = $1`;
    const assetResult = await client.query(assetQuery, [symbol]);
    
    if (assetResult.rows.length === 0) {
      return NextResponse.json({ error: `Asset not found: ${symbol}` }, { status: 404 });
    }
    
    const assetId = assetResult.rows[0].id;
    
    // Check which tables have data for this asset
    const tables = [
      'prices_ohlcv_1min',
      'prices_ohlcv_5min', 
      'prices_ohlcv_1hour',
      'prices_ohlcv_4hour',
      'prices_ohlcv_12hour',
      'prices_ohlcv_daily',
      'prices_ohlcv_weekly',
      'prices_ohlcv_monthly',
      'prices_ohlcv_yearly'
    ];
    
    const availableTimeframes: string[] = [];
    
    for (const table of tables) {
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM ${table} 
        WHERE asset_id = $1
      `;
      
      const result = await client.query(checkQuery, [assetId]);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        // Map table name to timeframe
        const timeframeMap: Record<string, string> = {
          'prices_ohlcv_1min': '1min',
          'prices_ohlcv_5min': '5min',
          'prices_ohlcv_1hour': '1hour',
          'prices_ohlcv_4hour': '4hour',
          'prices_ohlcv_12hour': '12hour',
          'prices_ohlcv_daily': 'daily',
          'prices_ohlcv_weekly': 'weekly',
          'prices_ohlcv_monthly': 'monthly',
          'prices_ohlcv_yearly': 'yearly'
        };
        
        availableTimeframes.push(timeframeMap[table]);
      }
    }
    
    return NextResponse.json({
      symbol,
      availableTimeframes,
      count: availableTimeframes.length
    });

  } catch (error) {
    console.error(`Error checking timeframes for ${symbol}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to check timeframes: ${errorMessage}` }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
} 