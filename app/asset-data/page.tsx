"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Download, Database } from "lucide-react";
import { Loader2 } from "lucide-react";
import { AssetLoader } from "@/components/asset-loader";
import { Toaster } from "@/components/ui/toaster";

const ASSET_SYMBOLS = [
  "WTI",
  "Gold",
  "VIX",
  "DXY Index",
  "SPX",
  "UST 10Y Yield",
];
const ASSET_NAMES: Record<string, string> = {
  WTI: "WTI Crude Oil",
  Gold: "Gold",
  VIX: "VIX",
  "DXY Index": "Dollar Index",
  SPX: "S&P 500 Index",
  "UST 10Y Yield": "10Y Treasury Yield",
};

export default function AssetDataPage() {
  const router = useRouter();
  const [assetData, setAssetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAllAssets() {
      setLoading(true);
      try {
        const allData = await Promise.all(
          ASSET_SYMBOLS.map(async (symbol) => {
            const res = await fetch(
              `/api/asset-analysis?asset=${encodeURIComponent(symbol)}`
            );
            if (!res.ok) return { symbol, error: true };
            const data = await res.json();
            return { symbol, data };
          })
        );
        setAssetData(allData);
      } catch (e) {
        setAssetData([]);
      } finally {
        setLoading(false);
      }
    }
    fetchAllAssets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/event-analysis")}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Event Analysis
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="h-8 w-8" />
                Asset Data Management
              </h1>
              <p className="text-lg text-gray-600">
                Load and manage historical price data for market analysis
              </p>
            </div>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Asset Data Status
            </CardTitle>
            <CardDescription>
              Manage historical price data for all assets. Data is loaded
              directly from the database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                <span>Loading asset data from database...</span>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">Asset Name</th>
                    <th className="px-4 py-2 text-left">Data Points</th>
                    <th className="px-4 py-2 text-left">Date Range</th>
                  </tr>
                </thead>
                <tbody>
                  {assetData.map((asset) => {
                    const name = ASSET_NAMES[asset.symbol] || asset.symbol;
                    const data = asset.data || [];
                    const dateRange =
                      data.length > 0
                        ? `${data[0].date} to ${data[data.length - 1].date}`
                        : "N/A";
                    return (
                      <tr key={asset.symbol}>
                        <td className="px-4 py-2 font-medium">{name}</td>
                        <td className="px-4 py-2">
                          {data.length > 0
                            ? data.length.toLocaleString()
                            : "N/A"}
                        </td>
                        <td className="px-4 py-2">{dateRange}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Toaster />
      </div>
    </div>
  );
}
