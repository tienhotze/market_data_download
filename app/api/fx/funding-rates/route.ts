import { type NextRequest, NextResponse } from "next/server";
import { getFundingRates } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const broker = searchParams.get("broker") || "OANDA";
  const symbolsParam = searchParams.get("symbols");
  const limitParam = searchParams.get("limit");
  
  const symbols = symbolsParam ? symbolsParam.split(",") : undefined;
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    console.log("Fetching funding rates with params:", { broker, symbols, limit });
    const fundingRates = await getFundingRates(symbols, broker, limit);
    console.log("Successfully fetched funding rates:", fundingRates.length, "records");
    
    return NextResponse.json({
      data: fundingRates
    });
  } catch (error) {
    console.error("Error fetching funding rates:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch funding rates",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}