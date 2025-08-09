import { type NextRequest, NextResponse } from "next/server";
import { assetPricesPool, getClosingPrices, alignData, calculateCorrelation, getLastPrice } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get("days") || "30";
  const symbolsParam = searchParams.get("symbols");
  
  let days = parseInt(daysParam, 10);
  
  // Validate days parameter
  if (isNaN(days) || days < 5 || days > 1000) {
    days = 30; // Default to 30 days if invalid
  }
  
  const symbols = symbolsParam ? symbolsParam.split(",") : undefined;

  try {
    // Get all currency pairs from the database for OANDA broker
    let currencyPairs: string[];
    const client = await assetPricesPool.connect();
    try {
      const query = `
        SELECT DISTINCT a.symbol FROM assets a
        JOIN asset_types at ON a.asset_type_id = at.id
        JOIN funding_rates fr ON a.id = fr.asset_id
        JOIN exchanges e ON fr.broker_id = e.id
        WHERE at.name = 'FX' AND e.name = 'OANDA'
        ORDER BY a.symbol
      `;
      const result = await client.query(query);
      currencyPairs = result.rows.map(row => row.symbol);
    } finally {
      client.release();
    }
    
    console.log(`Found ${currencyPairs.length} currency pairs`);
    
    // Get closing prices
    const prices = await getClosingPrices(currencyPairs, days);
    
    // Filter out pairs with no data
    const pairsWithPrices = Object.keys(prices).filter(symbol => prices[symbol].length > 0);
    console.log(`Found ${pairsWithPrices.length} currency pairs with price data`);
    
    // Prepare price data for the response
    const priceData: Record<string, { date: string; close: number }[]> = {};
    for (const symbol of pairsWithPrices) {
      priceData[symbol] = prices[symbol];
    }
    
    if (pairsWithPrices.length === 0) {
      return NextResponse.json({
        assets: [],
        matrix: [],
        lastPrices: {}
      });
    }
    
    // Align data to common dates
    const alignedPrices = alignData(prices);
    
    // Get assets that have aligned data
    const assets = Object.keys(alignedPrices);
    console.log(`Aligned data for ${assets.length} currency pairs`);
    
    if (assets.length === 0) {
      return NextResponse.json({
        assets: [],
        matrix: [],
        lastPrices: {}
      });
    }
    
    // Calculate correlation matrix
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

    const lastPrices: Record<string, number | null> = {};
    for (const asset of assets) {
      lastPrices[asset] = await getLastPrice(asset);
    }
    
    return NextResponse.json({
      assets,
      matrix,
      lastPrices,
      priceData
    });
  } catch (error) {
    console.error("Error calculating correlation matrix:", error);
    return NextResponse.json(
      { error: "Failed to calculate correlation matrix" },
      { status: 500 }
    );
  }
}