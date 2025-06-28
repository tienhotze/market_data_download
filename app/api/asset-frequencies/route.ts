import { NextResponse, NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol parameter is required" }, { status: 400 });
  }

  try {
    let frequencies: { [key: string]: string } = {};

    if (symbol.toUpperCase() === 'CPI') {
      frequencies = {
        'monthly': 'Monthly',
        'yearly': 'Yearly'
      };
    } else {
      // For now, assume all other assets have all available frequencies.
      // We can refine this later to check for actual data.
      const allAssetFrequencies: { [key: string]: string } = {
          'tick': 'Tick',
          '1min': '1 Minute',
          '5min': '5 Minute',
          '1hour': '1 Hour',
          '4hour': '4 Hour',
          '12hour': '12 Hour',
          'daily': 'Daily',
          'weekly': 'Weekly',
          'monthly': 'Monthly',
          'yearly': 'Yearly'
      };
      frequencies = allAssetFrequencies
    }

    return NextResponse.json({ frequencies });
  } catch (error) {
    console.error(`Error fetching frequencies for ${symbol}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to fetch frequencies: ${errorMessage}` }, { status: 500 });
  }
} 