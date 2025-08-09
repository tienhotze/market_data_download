"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface FundingRate {
  symbol: string;
  broker: string;
  long_rate: number;
  short_rate: number;
  effective_date: string;
  timestamp: string;
}

interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
  lastPrices: Record<string, number | null>;
  priceData: Record<string, { date: string; close: number }[]>;
}

export default function FXMarketsPage() {
  const { toast } = useToast();
  const [fundingRates, setFundingRates] = useState<FundingRate[]>([]);
  const [correlationMatrix, setCorrelationMatrix] =
    useState<CorrelationMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [correlationDays, setCorrelationDays] = useState(30);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FundingRate;
    direction: "ascending" | "descending";
  } | null>({ key: "long_rate", direction: "descending" });
  const [scatterPlotYAxis, setScatterPlotYAxis] = useState<
    "long_rate" | "short_rate"
  >("long_rate");

  useEffect(() => {
    const fetchData = async () => {
      await fetchFundingRates();
      await fetchCorrelationMatrix();
    };
    fetchData();
  }, []);

  const fetchFundingRates = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching funding rates...");
      const response = await fetch("/api/fx/funding-rates?broker=OANDA");
      console.log("Funding rates response status:", response.status);
      if (!response.ok) throw new Error("Failed to fetch funding rates");
      const data = await response.json();
      console.log("Funding rates data:", data);
      setFundingRates(data.data || []);
    } catch (error) {
      console.error("Error fetching funding rates:", error);
      toast({
        title: "Error",
        description: "Failed to fetch funding rates",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCorrelationMatrix = async () => {
    console.log("Fetching correlation matrix...");
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/fx/correlation-matrix?days=${correlationDays}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch FX prices");
      }
      const data = await response.json();
      console.log("Correlation matrix data:", data);
      setCorrelationMatrix(data);
    } catch (error) {
      console.error("Error fetching FX prices:", error);
      toast({
        title: "Error",
        description: "Failed to fetch FX prices.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sortedFundingRates = () => {
    if (!sortConfig) {
      return fundingRates;
    }
    return [...fundingRates].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "long_rate" || sortConfig.key === "short_rate") {
        const aNum = aValue
          ? parseFloat(String(aValue).replace("%", ""))
          : -Infinity;
        const bNum = bValue
          ? parseFloat(String(bValue).replace("%", ""))
          : -Infinity;

        if (aNum < bNum) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aNum > bNum) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      }

      // Default sort for other columns
      if (aValue < bValue) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  };

  const requestSort = (key: keyof FundingRate) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof FundingRate) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === "ascending" ? " 🔼" : " 🔽";
  };

  const createCorrelationHeatmap = () => {
    if (!correlationMatrix) return null;

    const colorscale = [
      [0, "#ff0000"],
      [0.5, "#ffff00"],
      [1, "#00ff00"],
    ] as [number, string][];

    const plotData: any = {
      z: correlationMatrix.matrix,
      x: correlationMatrix.assets,
      y: correlationMatrix.assets,
      type: "heatmap" as const,
      colorscale: colorscale,
      zmin: -1,
      zmax: 1,
      textfont: { size: 7.5 },
      hoverongaps: false,
      text: correlationMatrix.matrix.map((row) =>
        row.map((val) => val.toFixed(2))
      ),
      hoverinfo: "x+y+z" as const,
    };

    return (
      <Plot
        data={[plotData]}
        layout={{
          title: "FX Correlation Matrix",
          width: 1200,
          height: 1000,
          xaxis: { title: "Currency Pairs", tickfont: { size: 10 } },
          yaxis: { title: "Currency Pairs", tickfont: { size: 10 } },
        }}
        config={{ responsive: true }}
      />
    );
  };
  const createPriceDataTable = () => {
    if (!correlationMatrix || !correlationMatrix.priceData) return null;

    // Get all unique dates from all assets
    const allDates = new Set<string>();
    Object.values(correlationMatrix.priceData).forEach((prices) => {
      prices.forEach((price) => allDates.add(price.date));
    });

    const priceMap: Record<string, Record<string, number>> = {};
    Object.entries(correlationMatrix.priceData).forEach(([symbol, prices]) => {
      priceMap[symbol] = {};
      prices.forEach((price) => {
        priceMap[symbol][price.date] = price.close;
      });
    });

    const filteredDates = Array.from(allDates).filter((date) => {
      // Check if all assets have a price on this date
      return correlationMatrix.assets.every(
        (asset) => priceMap[asset] && priceMap[asset][date]
      );
    });

    const sortedDates = filteredDates.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    return (
      <div className="overflow-x-auto mt-8">
        <h3 className="text-xl font-bold mb-4">FX Prices (Last 30 Days)</h3>
        <table className="w-full text-sm border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">
                Symbol
              </th>
              {sortedDates.map((date) => (
                <th
                  key={date}
                  className="border border-gray-300 px-2 py-1 text-right"
                >
                  {new Date(date).toLocaleDateString()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlationMatrix.assets.map((asset) => (
              <tr key={asset} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-2 py-1 font-medium">
                  {asset}
                </td>
                {sortedDates.map((date) => (
                  <td
                    key={date}
                    className="border border-gray-300 px-2 py-1 text-right"
                  >
                    {priceMap[asset] && priceMap[asset][date]
                      ? priceMap[asset][date].toFixed(4)
                      : "N/A"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const createPriceChangeTable = () => {
    if (!correlationMatrix || !correlationMatrix.priceData) return null;

    const priceMap: Record<string, Record<string, number>> = {};
    Object.entries(correlationMatrix.priceData).forEach(([symbol, prices]) => {
      priceMap[symbol] = {};
      prices.forEach((price) => {
        priceMap[symbol][price.date] = price.close;
      });
    });

    const allDates = new Set<string>();
    Object.values(correlationMatrix.priceData).forEach((prices) => {
      prices.forEach((price) => allDates.add(price.date));
    });

    const sortedDates = Array.from(allDates).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    const priceChanges: Record<string, Record<string, number>> = {};
    const averagePriceChanges: Record<string, number> = {};

    correlationMatrix.assets.forEach((asset) => {
      priceChanges[asset] = {};
      let changes: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const prevDate = sortedDates[i - 1];
        const price = priceMap[asset]?.[date];
        const prevPrice = priceMap[asset]?.[prevDate];
        if (price && prevPrice) {
          const change = (price - prevPrice) / prevPrice;
          priceChanges[asset][date] = change;
          changes.push(change);
        }
      }
      if (changes.length > 0) {
        averagePriceChanges[asset] =
          changes.reduce((a, b) => a + b, 0) / changes.length;
      }
    });

    return (
      <div className="overflow-x-auto mt-8">
        <h3 className="text-xl font-bold mb-4">Daily % Price Changes</h3>
        <table className="w-full text-sm border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 left-0 bg-gray-100 z-10">
                Symbol
              </th>
              {sortedDates.slice(1).map((date) => (
                <th
                  key={date}
                  className="border border-gray-300 px-2 py-1 text-right sticky top-0 bg-gray-100"
                >
                  {new Date(date).toLocaleDateString()}
                </th>
              ))}
              <th className="border border-gray-300 px-2 py-1 text-right sticky top-0 bg-gray-100">
                30d Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {correlationMatrix.assets.map((asset) => (
              <tr key={asset} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-2 py-1 font-medium sticky left-0 bg-white">
                  {asset}
                </td>
                {sortedDates.slice(1).map((date) => (
                  <td
                    key={date}
                    className="border border-gray-300 px-2 py-1 text-right"
                  >
                    {priceChanges[asset]?.[date]
                      ? `${(priceChanges[asset][date] * 100).toFixed(2)}%`
                      : "N/A"}
                  </td>
                ))}
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {averagePriceChanges[asset]
                    ? `${(averagePriceChanges[asset] * 100).toFixed(2)}%`
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const createFundingScatterPlot = () => {
    if (!correlationMatrix || !correlationMatrix.priceData) return null;

    const priceMap: Record<string, Record<string, number>> = {};
    Object.entries(correlationMatrix.priceData).forEach(([symbol, prices]) => {
      priceMap[symbol] = {};
      prices.forEach((price) => {
        priceMap[symbol][price.date] = price.close;
      });
    });

    const allDates = new Set<string>();
    Object.values(correlationMatrix.priceData).forEach((prices) => {
      prices.forEach((price) => allDates.add(price.date));
    });

    const sortedDates = Array.from(allDates).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    const averagePriceChanges: Record<string, number> = {};

    correlationMatrix.assets.forEach((asset) => {
      let changes: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const prevDate = sortedDates[i - 1];
        const price = priceMap[asset]?.[date];
        const prevPrice = priceMap[asset]?.[prevDate];
        if (price && prevPrice) {
          const change = (price - prevPrice) / prevPrice;
          changes.push(change);
        }
      }
      if (changes.length > 0) {
        averagePriceChanges[asset] =
          changes.reduce((a, b) => a + b, 0) / changes.length;
      }
    });

    const scatterData = fundingRates
      .map((rate) => {
        const avgChange = averagePriceChanges[rate.symbol];
        if (avgChange === undefined) return null;
        return {
          x: avgChange,
          y: rate[scatterPlotYAxis],
          text: rate.symbol,
        };
      })
      .filter((item) => item !== null);

    return (
      <div className="mt-8">
        <div className="flex items-center gap-4 mb-4">
          <Button
            onClick={() => setScatterPlotYAxis("long_rate")}
            variant={scatterPlotYAxis === "long_rate" ? "default" : "outline"}
          >
            Long Rate
          </Button>
          <Button
            onClick={() => setScatterPlotYAxis("short_rate")}
            variant={scatterPlotYAxis === "short_rate" ? "default" : "outline"}
          >
            Short Rate
          </Button>
        </div>
        <Plot
          data={[
            {
              x: scatterData.map((d) => d.x),
              y: scatterData.map((d) => d.y),
              text: scatterData.map((d) => d.text),
              mode: "markers",
              type: "scatter",
            },
          ]}
          layout={{
            title: `Funding Rates vs 30d Avg Price Change`,
            xaxis: { title: "30d Avg Price Change" },
            yaxis: {
              title:
                scatterPlotYAxis === "long_rate" ? "Long Rate" : "Short Rate",
            },
          }}
          config={{ responsive: true }}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation title="FX Markets Analytics" />

      <div className="w-full mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">FX Markets Analytics</h1>
          <Button onClick={fetchFundingRates} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh Data"
            )}
          </Button>
        </div>

        <Tabs defaultValue="correlation" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="correlation">Correlation Matrix</TabsTrigger>
            <TabsTrigger value="funding">Funding Rates</TabsTrigger>
          </TabsList>

          <TabsContent value="correlation">
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
                <CardDescription>
                  Cross-correlation matrix for currency pairs using closing
                  prices
                </CardDescription>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="correlation-days">
                      Time Period (days):
                    </Label>
                    <Input
                      id="correlation-days"
                      type="number"
                      min="5"
                      max="1000"
                      value={correlationDays}
                      onChange={(e) =>
                        setCorrelationDays(parseInt(e.target.value) || 30)
                      }
                      className="w-32"
                    />
                  </div>
                  <Button onClick={fetchCorrelationMatrix} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Calculate Matrix"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">
                      Calculating correlation matrix...
                    </span>
                  </div>
                ) : correlationMatrix ? (
                  <div>
                    <div className="flex justify-center">
                      {createCorrelationHeatmap()}
                    </div>
                    {createPriceDataTable()}
                    {createPriceChangeTable()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Click "Calculate Matrix" to generate the correlation matrix
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funding">
            <Card>
              <CardHeader>
                <CardTitle>Funding Rates</CardTitle>
                <CardDescription>
                  Current funding rates for currency pairs from OANDA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Loading funding rates...</span>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-100">
                            <th
                              className="border border-gray-300 px-2 py-1 text-left cursor-pointer"
                              onClick={() => requestSort("symbol")}
                            >
                              Symbol {getSortIndicator("symbol")}
                            </th>
                            <th
                              className="border border-gray-300 px-2 py-1 text-right cursor-pointer"
                              onClick={() => requestSort("long_rate")}
                            >
                              Long Rate {getSortIndicator("long_rate")}
                            </th>
                            <th
                              className="border border-gray-300 px-2 py-1 text-right cursor-pointer"
                              onClick={() => requestSort("short_rate")}
                            >
                              Short Rate {getSortIndicator("short_rate")}
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-left">
                              Effective Date
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-left">
                              Timestamp
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFundingRates().map((rate, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-1">
                                {rate.symbol}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {rate.long_rate || "N/A"}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right">
                                {rate.short_rate || "N/A"}
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {rate.effective_date}
                              </td>
                              <td className="border border-gray-300 px-2 py-1">
                                {new Date(rate.timestamp).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {createFundingScatterPlot()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
