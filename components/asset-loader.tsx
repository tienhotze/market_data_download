"use client";

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const ASSET_SYMBOLS = ["^GSPC", "CL=F", "GC=F", "DX-Y.NYB", "^TNX", "^VIX"];
const ASSET_NAMES: Record<string, string> = {
  "^GSPC": "S&P 500",
  "CL=F": "WTI Crude Oil",
  "GC=F": "Gold",
  "DX-Y.NYB": "Dollar Index",
  "^TNX": "10Y Treasury Yield",
  "^VIX": "VIX",
};

export function AssetLoader() {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 mr-2 animate-spin" />
        <span>Loading asset data from database...</span>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset Name</TableHead>
          <TableHead>Data Points</TableHead>
          <TableHead>Date Range</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assetData.map((asset) => {
          const name = ASSET_NAMES[asset.symbol] || asset.symbol;
          const data = asset.data || [];
          const dateRange =
            data.length > 0
              ? `${data[0].date} to ${data[data.length - 1].date}`
              : "N/A";
          return (
            <TableRow key={asset.symbol}>
              <TableCell className="font-medium">{name}</TableCell>
              <TableCell>
                {data.length > 0 ? data.length.toLocaleString() : "N/A"}
              </TableCell>
              <TableCell>{dateRange}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
