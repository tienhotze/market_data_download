import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

const TIMEFRAME_TABLES = [
  { table: 'prices_ohlcv_1min', timeframe: '1min' },
  { table: 'prices_ohlcv_5min', timeframe: '5min' },
  { table: 'prices_ohlcv_1hour', timeframe: '1hour' },
  { table: 'prices_ohlcv_4hour', timeframe: '4hour' },
  { table: 'prices_ohlcv_12hour', timeframe: '12hour' },
  { table: 'prices_ohlcv_daily', timeframe: 'daily' },
  { table: 'prices_ohlcv_weekly', timeframe: 'weekly' },
  { table: 'prices_ohlcv_monthly', timeframe: 'monthly' },
  { table: 'prices_ohlcv_yearly', timeframe: 'yearly' },
];

const ASSET_CLASSES = {
  currencies: ['AUDJPY','AUDUSD','CADJPY','CADUSD','EURJPY','EURUSD','NZDUSD','USDCAD','USDCNH','USDJPY','USDMXN','USDNOK','USDSGD','USDTHB'],
  equityIndices: ['SPX'],
  commodities: ['Gold','WTI','CL=F','GC=F'],
  bonds: ['UST 10Y Yield','^TNX'],
  indices: ['DXY Index','^VIX']
};

function getAssetClass(symbol: string) {
  for (const [classKey, symbols] of Object.entries(ASSET_CLASSES)) {
    if (symbols.includes(symbol)) return classKey;
  }
  return 'other';
}

function getDataSource(symbol: string) {
  if (symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('JPY') || symbol.includes('AUD')) return 'OANDA';
  if (symbol === 'SPX' || symbol === 'VIX') return 'Yahoo Finance';
  return 'Bloomberg';
}

export async function GET(request: NextRequest) {
  let client: PoolClient | null = null;
  try {
    client = await assetPricesPool.connect();
    
    // Get all assets in a single query
    const assetRes = await client!.query('SELECT id, symbol, name FROM assets ORDER BY symbol ASC');
    const assets = assetRes.rows;
    
    // Get timeframe availability for all assets in a single query per timeframe
    const timeframeAvailability: Record<number, string[]> = {};
    
    for (const { table, timeframe } of TIMEFRAME_TABLES) {
      const q = `SELECT asset_id, COUNT(*) as count FROM ${table} GROUP BY asset_id HAVING COUNT(*) > 0`;
      const r = await client!.query(q);
      
      r.rows.forEach((row: any) => {
        const assetId = row.asset_id;
        if (!timeframeAvailability[assetId]) {
          timeframeAvailability[assetId] = [];
        }
        timeframeAvailability[assetId].push(timeframe);
      });
    }
    
    // Build the metadata results
    const metaResults = assets.map((asset: any) => ({
      symbol: asset.symbol,
      name: asset.name,
      assetClass: getAssetClass(asset.symbol),
      dataSource: getDataSource(asset.symbol),
      availableTimeframes: timeframeAvailability[asset.id] || [],
      id: asset.id
    }));
    
    return NextResponse.json(metaResults);
  } catch (error) {
    console.error('Error fetching asset metadata:', error);
    return NextResponse.json({ error: 'Failed to fetch asset metadata' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
} 