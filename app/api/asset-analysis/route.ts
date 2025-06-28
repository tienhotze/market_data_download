import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool } from "@/lib/db";
import { PoolClient } from "pg";

async function getAssetData(client: PoolClient, assetSymbol: string) {
  const query = `
    SELECT T2.timestamp as date, T2.close as value 
    FROM assets AS T1 
    JOIN prices_ohlcv_daily AS T2 ON T1.id = T2.asset_id 
    WHERE T1.symbol = $1 
    ORDER BY T2.timestamp ASC;
  `;
  const { rows } = await client.query(query, [assetSymbol]);
  if (rows.length === 0) {
    // Return empty array if no data, to avoid errors downstream
    return [];
  }
  return rows.map(row => ({
      ...row,
      date: new Date(row.date).toISOString().split('T')[0],
      value: parseFloat(row.value)
  }));
}

function calculateChange(data: any[], period: number) {
  if (data.length < period) return [];
  const changes = [];
  for (let i = period; i < data.length; i++) {
    const prevValue = data[i - period].value;
    if (prevValue !== 0 && prevValue !== null) {
      changes.push({
        date: data[i].date,
        value: data[i].value - prevValue,
      });
    } else {
       changes.push({ date: data[i].date, value: null });
    }
  }
  return changes;
}

function calculatePercentChange(data: any[], period: number) {
  if (data.length < period) return [];
  const changes = [];
  for (let i = period; i < data.length; i++) {
    const prevValue = data[i - period].value;
    if (prevValue !== 0 && prevValue !== null) {
      changes.push({
        date: data[i].date,
        value: ((data[i].value - prevValue) / prevValue) * 100,
      });
    } else {
        changes.push({ date: data[i].date, value: null });
    }
  }
  return changes;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset");
  const transformation = searchParams.get("transformation");
  const periodStr = searchParams.get("period");
  
  if (!asset) {
    return NextResponse.json({ error: "Asset parameter is required" }, { status: 400 });
  }

  let client: PoolClient | null = null;
  try {
    client = await assetPricesPool.connect();
    let data = await getAssetData(client, asset);
    
    if (transformation && (transformation === "percent" || transformation === "simple")) {
        const period = parseInt(periodStr || "1", 10);
        if (transformation === "percent") {
            data = calculatePercentChange(data, period);
        } else {
            data = calculateChange(data, period);
        }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Failed to fetch asset analysis for ${asset}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to fetch asset analysis: ${errorMessage}` }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}