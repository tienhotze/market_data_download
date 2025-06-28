import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

const ASSETS_TO_VERIFY = [
  { name: 'Gold', symbol: 'Gold' },
  { name: 'WTI Oil', symbol: 'WTI' },
  { name: 'SPX', symbol: 'SPX' },
  { name: '10Y Bond Yields', symbol: 'UST 10Y Yield' },
  { name: 'VIX', symbol: 'VIX' },
  { name: 'DXY', symbol: 'DXY Index' },
];

interface VerificationResult {
    assetName: string;
    symbol: string;
    status: 'success' | 'failure';
    recordCount?: number;
    error?: string;
}

export async function GET(request: NextRequest) {
    let client: PoolClient | null = null;
    const results: VerificationResult[] = [];

    try {
        client = await assetPricesPool.connect();

        for (const asset of ASSETS_TO_VERIFY) {
            try {
                const query = `
                    SELECT COUNT(T2.timestamp) as count 
                    FROM assets AS T1 
                    JOIN prices_ohlcv_daily AS T2 ON T1.id = T2.asset_id 
                    WHERE T1.symbol = $1;
                `;
                const res = await client.query(query, [asset.symbol]);
                const count = res.rows[0].count;
                results.push({
                    assetName: asset.name,
                    symbol: asset.symbol,
                    status: 'success',
                    recordCount: parseInt(count, 10),
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown database error';
                results.push({
                    assetName: asset.name,
                    symbol: asset.symbol,
                    status: 'failure',
                    error: errorMessage,
                });
            }
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown connection error';
        return NextResponse.json({ 
            error: 'Database connection failed',
            details: errorMessage,
            results,
         }, { status: 500 });
    } finally {
        if (client) {
            client.release();
        }
    }
    
    return NextResponse.json({ results });
} 