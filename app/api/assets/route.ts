import { NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";

export async function GET() {
  try {
    const client = await assetPricesPool.connect();
    try {
      const query = `
        SELECT id, symbol, name 
        FROM assets 
        ORDER BY symbol ASC
      `;
      const result = await client.query(query);
      const assets = result.rows;

      // Manually add economic data series
      assets.push({ id: 9999, symbol: "CPI", name: "Consumer Price Index" });

      return NextResponse.json(assets);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`Error fetching asset list:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to fetch asset list: ${errorMessage}` }, { status: 500 });
  }
} 