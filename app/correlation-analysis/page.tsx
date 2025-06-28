"use client";

import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  BarChart3,
  Calculator,
  Clock,
  Database,
  DollarSign,
  TrendingDown,
  Zap,
  Loader2,
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Asset {
  id: number;
  symbol: string;
  name: string;
  assetClass: string;
  timeframes: string[];
  dataSource: string;
  availableTimeframes: string[];
}

interface AssetData {
  date: string;
  value: number;
}

interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
}

interface BetaMatrix {
  assets: string[];
  matrix: number[][];
}

interface RollingData {
  dates: string[];
  values: number[];
}

const DATA_WINDOWS = [
  { value: "1m", label: "1 Month" },
  { value: "3m", label: "3 Months" },
  { value: "6m", label: "6 Months" },
  { value: "12m", label: "12 Months" },
  { value: "2y", label: "2 Years" },
  { value: "5y", label: "5 Years" },
  { value: "10y", label: "10 Years" },
  { value: "custom", label: "Custom" },
];

const CHART_WINDOWS = [
  { value: "1y", label: "1 Year" },
  { value: "2y", label: "2 Years" },
  { value: "5y", label: "5 Years" },
  { value: "10y", label: "10 Years" },
];

const TIMEFRAMES = [
  { value: "1min", label: "1 Minute" },
  { value: "5min", label: "5 Minutes" },
  { value: "1hour", label: "1 Hour" },
  { value: "4hour", label: "4 Hours" },
  { value: "12hour", label: "12 Hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Asset classification based on database content
const ASSET_CLASSES = {
  currencies: {
    name: "Currencies",
    icon: DollarSign,
    assets: [
      "AUDJPY",
      "AUDUSD",
      "CADJPY",
      "CADUSD",
      "EURJPY",
      "EURUSD",
      "NZDUSD",
      "USDCAD",
      "USDCNH",
      "USDJPY",
      "USDMXN",
      "USDNOK",
      "USDSGD",
      "USDTHB",
    ],
  },
  equityIndices: {
    name: "Equity Indices",
    icon: TrendingUp,
    assets: ["SPX"],
  },
  commodities: {
    name: "Commodities",
    icon: Zap,
    assets: ["Gold", "WTI", "CL=F", "GC=F"],
  },
  bonds: {
    name: "Bonds & Rates",
    icon: TrendingDown,
    assets: ["UST 10Y Yield", "^TNX"],
  },
  indices: {
    name: "Indices",
    icon: BarChart3,
    assets: ["DXY Index", "^VIX"],
  },
};

export default function CorrelationAnalysisPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState("daily");
  const [dataWindow, setDataWindow] = useState("12m");
  const [customDays, setCustomDays] = useState(365);
  const [percentChangePeriods, setPercentChangePeriods] = useState(1);
  const [correlationMatrix, setCorrelationMatrix] =
    useState<CorrelationMatrix | null>(null);
  const [betaMatrix, setBetaMatrix] = useState<BetaMatrix | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{
    asset1: string;
    asset2: string;
    type: "correlation" | "beta";
  } | null>(null);
  const [rollingData, setRollingData] = useState<RollingData | null>(null);
  const [priceData, setPriceData] = useState<{
    asset1: AssetData[];
    asset2: AssetData[];
  } | null>(null);
  const [chartWindow, setChartWindow] = useState("10y");
  const [alignedDataPoints, setAlignedDataPoints] = useState<number | null>(
    null
  );
  const [rawData, setRawData] = useState<{
    [symbol: string]: AssetData[];
  } | null>(null);
  const [transformedData, setTransformedData] = useState<{
    [symbol: string]: { date: string; value: number }[];
  } | null>(null);
  const [rollingCorrelations, setRollingCorrelations] = useState<{
    [pair: string]: { dates: string[]; values: number[] };
  } | null>(null);
  const [rollingBetas, setRollingBetas] = useState<{
    [pair: string]: { dates: string[]; values: number[] };
  } | null>(null);
  const [selectedPair1, setSelectedPair1] = useState<string>("");
  const [selectedPair2, setSelectedPair2] = useState<string>("");
  const [pairPriceData, setPairPriceData] = useState<{
    pair1: AssetData[];
    pair2: AssetData[];
    correlation: { dates: string[]; values: number[] };
  } | null>(null);
  const [correlationWindowDays, setCorrelationWindowDays] =
    useState<number>(365);

  // Fetch asset metadata (including timeframes) on load
  useEffect(() => {
    fetchAssetMetadata();
  }, []);

  const fetchAssetMetadata = async () => {
    try {
      setIsLoadingAssets(true);
      const response = await fetch("/api/asset-metadata");
      if (!response.ok) throw new Error("Failed to fetch asset metadata");
      const data = await response.json();
      setAssets(data);
    } catch (error) {
      console.error("Error fetching asset metadata:", error);
      toast({
        title: "Error",
        description: "Failed to load asset metadata",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAssets(false);
    }
  };

  const handleAssetToggle = (assetId: number) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const calculateCorrelation = (data1: number[], data2: number[]): number => {
    if (data1.length !== data2.length || data1.length === 0) return 0;

    const n = data1.length;
    const mean1 = data1.reduce((a, b) => a + b, 0) / n;
    const mean2 = data2.reduce((a, b) => a + b, 0) / n;

    const numerator = data1.reduce(
      (sum, val, i) => sum + (val - mean1) * (data2[i] - mean2),
      0
    );

    const denominator1 = Math.sqrt(
      data1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0)
    );
    const denominator2 = Math.sqrt(
      data2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0)
    );

    return denominator1 * denominator2 === 0
      ? 0
      : numerator / (denominator1 * denominator2);
  };

  const calculateBeta = (
    assetReturns: number[],
    marketReturns: number[]
  ): number => {
    if (
      assetReturns.length !== marketReturns.length ||
      assetReturns.length === 0
    )
      return 0;

    const covariance = calculateCovariance(assetReturns, marketReturns);
    const marketVariance = calculateVariance(marketReturns);

    return marketVariance === 0 ? 0 : covariance / marketVariance;
  };

  const calculateCovariance = (data1: number[], data2: number[]): number => {
    const n = data1.length;
    const mean1 = data1.reduce((a, b) => a + b, 0) / n;
    const mean2 = data2.reduce((a, b) => a + b, 0) / n;

    return (
      data1.reduce(
        (sum, val, i) => sum + (val - mean1) * (data2[i] - mean2),
        0
      ) / n
    );
  };

  const calculateVariance = (data: number[]): number => {
    const n = data.length;
    const mean = data.reduce((a, b) => a + b, 0) / n;

    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  };

  const calculatePercentChanges = (
    data: AssetData[],
    periods: number
  ): number[] => {
    const changes: number[] = [];
    for (let i = periods; i < data.length; i++) {
      const currentPrice = data[i].value;
      const previousPrice = data[i - periods].value;
      changes.push(currentPrice / previousPrice - 1);
    }
    return changes;
  };

  const runAnalysis = async () => {
    if (selectedAssets.length < 2) {
      toast({
        title: "Error",
        description: "Please select at least 2 assets for analysis",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setAlignedDataPoints(null); // Reset aligned data points count
    setRawData(null); // Reset raw data
    setTransformedData(null); // Reset transformed data
    try {
      // Calculate correlation window days (this is the rolling window size)
      let correlationWindowDays = 365; // Default 1 year
      if (dataWindow === "custom") {
        correlationWindowDays = customDays;
      } else {
        const windowMap: Record<string, number> = {
          "1m": 30,
          "3m": 90,
          "6m": 180,
          "12m": 365,
          "1y": 365,
          "2y": 730,
          "5y": 1825,
          "10y": 3650,
        };
        correlationWindowDays = windowMap[dataWindow] || 365;
      }

      setCorrelationWindowDays(correlationWindowDays);

      // Calculate data download period: Data Window + 1 year to ensure enough data for rolling analysis
      // This ensures we can calculate rolling correlations for the full Data Window period
      const extraDataDays = 365; // Always add 1 year of extra data
      const totalDownloadDays = correlationWindowDays + extraDataDays;

      console.log(`Data Window: ${dataWindow} (${correlationWindowDays} days)`);
      console.log(
        `Downloading ${totalDownloadDays} days of data (${correlationWindowDays} + ${extraDataDays})`
      );

      // Fetch data for selected assets
      const assetDataPromises = selectedAssets.map(async (assetId) => {
        const asset = assets.find((a) => a.id === assetId);
        if (!asset) return null;

        const response = await fetch(
          `/api/asset-data?symbol=${asset.symbol}&timeframe=${selectedTimeframe}&days=${totalDownloadDays}`
        );
        if (!response.ok)
          throw new Error(`Failed to fetch data for ${asset.symbol}`);
        return response.json();
      });

      const assetDataResults = await Promise.all(assetDataPromises);
      const validAssetData = assetDataResults.filter((data) => data !== null);

      if (validAssetData.length < 2) {
        throw new Error("Insufficient data for analysis");
      }

      // Align data to common date range and remove missing values
      const alignedData = alignDataToCommonDates(validAssetData);

      if (alignedData.length === 0 || alignedData[0].length === 0) {
        throw new Error(
          "No common data points found after alignment. Please check that all selected assets have overlapping data for the selected time period."
        );
      }

      if (alignedData[0].length < correlationWindowDays) {
        toast({
          title: "Warning",
          description: `Only ${alignedData[0].length} data points available, but ${correlationWindowDays} days needed for rolling analysis. Results may be limited.`,
          variant: "destructive",
        });
      }

      // Store raw aligned data
      const rawDataMap: { [symbol: string]: AssetData[] } = {};
      const transformedDataMap: {
        [symbol: string]: { date: string; value: number }[];
      } = {};

      alignedData.forEach((dataArray, index) => {
        const symbol =
          assets.find((a) => a.id === selectedAssets[index])?.symbol || "";
        rawDataMap[symbol] = dataArray;

        // Calculate percentage changes for transformed data
        const percentChanges = calculatePercentChanges(
          dataArray,
          percentChangePeriods
        );
        const transformedArray = dataArray
          .slice(percentChangePeriods)
          .map((dataPoint, i) => ({
            date: dataPoint.date,
            value: percentChanges[i],
          }));
        transformedDataMap[symbol] = transformedArray;
      });

      setRawData(rawDataMap);
      setTransformedData(transformedDataMap);

      // Calculate rolling correlations and betas using the full correlation window size
      // This ensures rolling windows match the Data Window selection
      const rollingCorrData = calculateRollingCorrelations(
        alignedData,
        correlationWindowDays
      );
      const rollingBetaData = calculateRollingBetas(
        alignedData,
        correlationWindowDays
      );

      setRollingCorrelations(rollingCorrData);
      setRollingBetas(rollingBetaData);

      // Calculate correlation matrix using the full dataset
      const correlationMatrixData: number[][] = [];
      const betaMatrixData: number[][] = [];
      const assetSymbols = validAssetData.map(
        (_, index) =>
          assets.find((a) => a.id === selectedAssets[index])?.symbol || ""
      );

      for (let i = 0; i < alignedData.length; i++) {
        correlationMatrixData[i] = [];
        betaMatrixData[i] = [];
        for (let j = 0; j < alignedData.length; j++) {
          if (i === j) {
            correlationMatrixData[i][j] = 1;
            betaMatrixData[i][j] = 1;
          } else {
            const percentChangesI = calculatePercentChanges(
              alignedData[i],
              percentChangePeriods
            );
            const percentChangesJ = calculatePercentChanges(
              alignedData[j],
              percentChangePeriods
            );

            correlationMatrixData[i][j] = calculateCorrelation(
              percentChangesI,
              percentChangesJ
            );
            betaMatrixData[i][j] = calculateBeta(
              percentChangesI,
              percentChangesJ
            );
          }
        }
      }

      setCorrelationMatrix({
        assets: assetSymbols,
        matrix: correlationMatrixData,
      });

      setBetaMatrix({
        assets: assetSymbols,
        matrix: betaMatrixData,
      });

      setAlignedDataPoints(alignedData[0].length);

      toast({
        title: "Success",
        description: `Analysis completed successfully with ${alignedData[0].length} aligned data points (${correlationWindowDays}-day rolling window)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Analysis failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to align data to common dates and remove missing values
  const alignDataToCommonDates = (
    assetDataArrays: AssetData[][]
  ): AssetData[][] => {
    if (assetDataArrays.length === 0) return [];

    console.log(`Aligning ${assetDataArrays.length} asset data arrays...`);

    // Log initial data lengths
    assetDataArrays.forEach((dataArray, index) => {
      console.log(`Asset ${index}: ${dataArray.length} data points`);
    });

    // Create a map of all unique dates across all assets
    const allDates = new Set<string>();
    assetDataArrays.forEach((dataArray) => {
      dataArray.forEach((dataPoint) => {
        allDates.add(dataPoint.date);
      });
    });

    // Sort dates chronologically (descending - latest first)
    const sortedDates = Array.from(allDates).sort().reverse();
    console.log(`Total unique dates found: ${sortedDates.length}`);

    // Create aligned data arrays
    const alignedArrays: AssetData[][] = assetDataArrays.map(() => []);

    // For each date, check if all assets have data for that date
    let alignedCount = 0;
    sortedDates.forEach((date) => {
      const hasAllData = assetDataArrays.every((dataArray) => {
        const dataPoint = dataArray.find((dp) => dp.date === date);
        return (
          dataPoint &&
          dataPoint.value !== null &&
          dataPoint.value !== undefined &&
          !isNaN(dataPoint.value)
        );
      });

      // Only include the date if all assets have valid data
      if (hasAllData) {
        alignedCount++;
        assetDataArrays.forEach((dataArray, index) => {
          const dataPoint = dataArray.find((dp) => dp.date === date);
          if (dataPoint) {
            alignedArrays[index].push(dataPoint);
          }
        });
      }
    });

    console.log(`Successfully aligned ${alignedCount} data points`);

    // Verify all arrays have the same length
    const lengths = alignedArrays.map((arr) => arr.length);
    const allSameLength = lengths.every((len) => len === lengths[0]);

    if (!allSameLength) {
      console.warn(
        "Data alignment warning: Arrays have different lengths after alignment"
      );
      console.warn("Array lengths:", lengths);
    } else {
      console.log(`All arrays aligned to ${lengths[0]} data points`);
    }

    // Log date range for aligned data
    if (alignedArrays[0].length > 0) {
      const firstDate = alignedArrays[0][0].date;
      const lastDate = alignedArrays[0][alignedArrays[0].length - 1].date;
      console.log(`Aligned data date range: ${firstDate} to ${lastDate}`);
    }

    return alignedArrays;
  };

  // Function to calculate rolling correlations for all asset pairs
  const calculateRollingCorrelations = (
    alignedData: AssetData[][],
    windowSize: number = 30
  ) => {
    const symbols = alignedData.map(
      (_, index) =>
        assets.find((a) => a.id === selectedAssets[index])?.symbol || ""
    );

    const rollingData: {
      [pair: string]: { dates: string[]; values: number[] };
    } = {};

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const pairKey = `${symbols[i]}-${symbols[j]}`;
        const dates: string[] = [];
        const values: number[] = [];

        const data1 = alignedData[i];
        const data2 = alignedData[j];

        // Calculate rolling correlation
        for (let k = windowSize; k < data1.length; k++) {
          const window1 = data1.slice(k - windowSize, k).map((d) => d.value);
          const window2 = data2.slice(k - windowSize, k).map((d) => d.value);

          const correlation = calculateCorrelation(window1, window2);
          dates.push(data1[k].date);
          values.push(correlation);
        }

        rollingData[pairKey] = { dates, values };
      }
    }

    return rollingData;
  };

  // Function to calculate rolling betas for all asset pairs
  const calculateRollingBetas = (
    alignedData: AssetData[][],
    windowSize: number = 30
  ) => {
    const symbols = alignedData.map(
      (_, index) =>
        assets.find((a) => a.id === selectedAssets[index])?.symbol || ""
    );

    const rollingData: {
      [pair: string]: { dates: string[]; values: number[] };
    } = {};

    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const pairKey = `${symbols[i]}-${symbols[j]}`;
        const dates: string[] = [];
        const values: number[] = [];

        const data1 = alignedData[i];
        const data2 = alignedData[j];

        // Calculate rolling beta
        for (let k = windowSize; k < data1.length; k++) {
          const window1 = data1.slice(k - windowSize, k).map((d) => d.value);
          const window2 = data2.slice(k - windowSize, k).map((d) => d.value);

          const beta = calculateBeta(window1, window2);
          dates.push(data1[k].date);
          values.push(beta);
        }

        rollingData[pairKey] = { dates, values };
      }
    }

    return rollingData;
  };

  // Function to calculate rolling correlation for a specific pair
  const calculatePairRollingCorrelation = (
    data1: AssetData[],
    data2: AssetData[],
    windowSize: number = 30
  ) => {
    const dates: string[] = [];
    const values: number[] = [];

    for (let k = windowSize; k < data1.length; k++) {
      const window1 = data1.slice(k - windowSize, k).map((d) => d.value);
      const window2 = data2.slice(k - windowSize, k).map((d) => d.value);

      const correlation = calculateCorrelation(window1, window2);
      dates.push(data1[k].date);
      values.push(correlation);
    }

    return { dates, values };
  };

  const handleCellClick = async (
    asset1: string,
    asset2: string,
    type: "correlation" | "beta"
  ) => {
    setSelectedCell({ asset1, asset2, type });

    try {
      // Fetch rolling data
      const response = await fetch(
        `/api/rolling-analysis?asset1=${asset1}&asset2=${asset2}&type=${type}&timeframe=${selectedTimeframe}&window=${dataWindow}`
      );
      if (!response.ok) throw new Error("Failed to fetch rolling data");
      const rollingData = await response.json();
      setRollingData(rollingData);

      // Fetch price data for comparison
      const priceResponse = await fetch(
        `/api/asset-prices?asset1=${asset1}&asset2=${asset2}&timeframe=${selectedTimeframe}&window=${chartWindow}`
      );
      if (!priceResponse.ok) throw new Error("Failed to fetch price data");
      const priceData = await priceResponse.json();
      setPriceData(priceData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch detailed data",
        variant: "destructive",
      });
    }
  };

  const createMatrixPlot = (
    matrix: CorrelationMatrix | BetaMatrix,
    type: "correlation" | "beta"
  ) => {
    const colorscale =
      type === "correlation"
        ? ([
            [0, "#ff0000"],
            [0.5, "#ffff00"],
            [1, "#00ff00"],
          ] as [number, string][])
        : ([
            [0, "#0000ff"],
            [0.5, "#ffff00"],
            [1, "#ff0000"],
          ] as [number, string][]);

    const plotData = {
      z: matrix.matrix,
      x: matrix.assets,
      y: matrix.assets,
      type: "heatmap" as const,
      colorscale: colorscale,
      zmin: type === "correlation" ? -1 : -2,
      zmax: type === "correlation" ? 1 : 2,
      textfont: { size: 10 },
      hoverongaps: false,
    };

    return (
      <Plot
        data={[plotData]}
        layout={{
          title: `${type === "correlation" ? "Correlation" : "Beta"} Matrix`,
          width: 600,
          height: 500,
          xaxis: { title: "Assets" },
          yaxis: { title: "Assets" },
        }}
        config={{ responsive: true }}
        onClick={(event) => {
          if (event.points && event.points[0]) {
            const point = event.points[0];
            if (typeof point.x === "number" && typeof point.y === "number") {
              const asset1 = matrix.assets[point.y];
              const asset2 = matrix.assets[point.x];
              handleCellClick(asset1, asset2, type);
            }
          }
        }}
      />
    );
  };

  const getAssetClassIcon = (assetClass: string) => {
    const classInfo = ASSET_CLASSES[assetClass as keyof typeof ASSET_CLASSES];
    return classInfo ? classInfo.icon : Database;
  };

  const getAssetClassName = (assetClass: string) => {
    const classInfo = ASSET_CLASSES[assetClass as keyof typeof ASSET_CLASSES];
    return classInfo ? classInfo.name : "Other";
  };

  // Group assets by class
  const groupedAssets = assets.reduce((groups, asset) => {
    if (!groups[asset.assetClass]) {
      groups[asset.assetClass] = [];
    }
    groups[asset.assetClass].push(asset);
    return groups;
  }, {} as Record<string, Asset[]>);

  // Helper: get all asset IDs
  const allAssetIds = assets.map((a) => a.id);

  // Helper: get all asset IDs in a group
  const groupAssetIds = (group: string) =>
    groupedAssets[group]?.map((a) => a.id) || [];

  // Select all logic
  const allSelected =
    selectedAssets.length === allAssetIds.length && allAssetIds.length > 0;
  const someSelected =
    selectedAssets.length > 0 && selectedAssets.length < allAssetIds.length;

  // Group select logic
  const groupAllSelected = (group: string) => {
    const ids = groupAssetIds(group);
    return ids.every((id) => selectedAssets.includes(id)) && ids.length > 0;
  };
  const groupSomeSelected = (group: string) => {
    const ids = groupAssetIds(group);
    const selected = ids.filter((id) => selectedAssets.includes(id));
    return selected.length > 0 && selected.length < ids.length;
  };

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectedAssets(checked ? allAssetIds : []);
  };
  const handleGroupSelectAll = (group: string, checked: boolean) => {
    const ids = groupAssetIds(group);
    setSelectedAssets((prev) => {
      const set = new Set(prev);
      if (checked) {
        ids.forEach((id) => set.add(id));
      } else {
        ids.forEach((id) => set.delete(id));
      }
      return Array.from(set);
    });
  };

  // In the component, replace the Checkbox for select-all-assets with a ref and useEffect
  const selectAllRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      (selectAllRef.current as any).indeterminate = someSelected;
    }
  }, [someSelected]);

  // For group select checkboxes, do the same pattern
  // Add a helper to generate refs for each group
  type GroupRefs = Record<string, HTMLButtonElement | null>;
  const groupRefs = useRef<GroupRefs>({});
  useEffect(() => {
    Object.keys(groupedAssets).forEach((group) => {
      const ref = groupRefs.current[group];
      if (
        ref &&
        (ref instanceof HTMLInputElement || ref instanceof HTMLButtonElement)
      ) {
        (ref as any).indeterminate = groupSomeSelected(group);
      }
    });
  }, [groupedAssets, selectedAssets]);

  // Function to download data as CSV
  const downloadDataAsCSV = (
    data: { [symbol: string]: any[] },
    filename: string
  ) => {
    if (!data || Object.keys(data).length === 0) return;

    const symbols = Object.keys(data);
    const dates = data[symbols[0]]?.map((item) => item.date) || [];

    // Create CSV content
    const headers = ["Date", ...symbols];
    const csvContent = [
      headers.join(","),
      ...dates.map((date, index) => {
        const row = [date];
        symbols.forEach((symbol) => {
          const value = data[symbol][index]?.value;
          row.push(value !== undefined ? value.toFixed(4) : "");
        });
        return row.join(",");
      }),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Function to download matrix as CSV
  const downloadMatrixAsCSV = (
    matrix: CorrelationMatrix | BetaMatrix,
    type: "correlation" | "beta",
    filename: string
  ) => {
    if (!matrix) return;

    // Create CSV content
    const headers = ["Asset", ...matrix.assets];
    const csvContent = [
      headers.join(","),
      ...matrix.matrix.map((row, index) => {
        const assetRow = [matrix.assets[index]];
        row.forEach((value) => {
          assetRow.push(value.toFixed(4));
        });
        return assetRow.join(",");
      }),
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation title="Cross-Correlation & Beta Analysis" />

      <div className="w-full mx-auto p-6 space-y-6">
        {/* Asset Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Asset Selection
            </CardTitle>
            <CardDescription>
              Select assets to analyze cross-correlations and betas. Assets are
              grouped by class with available timeframes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-4">
              <Checkbox
                id="select-all-assets"
                checked={allSelected}
                ref={selectAllRef}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <label
                htmlFor="select-all-assets"
                className="font-semibold text-base"
              >
                Select All Assets
              </label>
            </div>
            <div className="space-y-6">
              {isLoadingAssets ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading assets...</span>
                </div>
              ) : (
                Object.entries(groupedAssets).map(
                  ([assetClass, classAssets]) => {
                    const IconComponent = getAssetClassIcon(assetClass);
                    const className = getAssetClassName(assetClass);
                    return (
                      <div key={assetClass} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Checkbox
                            id={`select-all-${assetClass}`}
                            checked={groupAllSelected(assetClass)}
                            ref={(el) => {
                              groupRefs.current[assetClass] = el;
                            }}
                            onCheckedChange={(checked) =>
                              handleGroupSelectAll(assetClass, !!checked)
                            }
                          />
                          <IconComponent className="h-5 w-5" />
                          <h3 className="text-lg font-semibold">{className}</h3>
                          <Badge variant="outline">
                            {classAssets.length} assets
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {classAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center space-x-3 p-3 border rounded-lg"
                            >
                              <Checkbox
                                id={`asset-${asset.id}`}
                                checked={selectedAssets.includes(asset.id)}
                                onCheckedChange={() =>
                                  handleAssetToggle(asset.id)
                                }
                              />
                              <div className="flex-1">
                                <Label
                                  htmlFor={`asset-${asset.id}`}
                                  className="font-medium"
                                >
                                  {asset.symbol}
                                </Label>
                                <div className="text-sm text-muted-foreground">
                                  {asset.name}
                                </div>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {asset.dataSource}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {asset.availableTimeframes.length > 0
                                      ? asset.availableTimeframes.join(", ")
                                      : "No data"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Selected: {selectedAssets.length} assets
            </div>
          </CardContent>
        </Card>

        {/* Analysis Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Analysis Configuration
            </CardTitle>
            <CardDescription>
              Configure timeframe, data window (used as rolling window size) and
              transformation parameters. Data Window + 1 year of data will be
              downloaded to ensure sufficient data for rolling analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="timeframe">Timeframe</Label>
                <Select
                  value={selectedTimeframe}
                  onValueChange={setSelectedTimeframe}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAMES.map((timeframe) => (
                      <SelectItem key={timeframe.value} value={timeframe.value}>
                        {timeframe.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                  Data will be resampled if needed
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-window">
                  Data Window (Rolling Window Size)
                </Label>
                <Select value={dataWindow} onValueChange={setDataWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_WINDOWS.map((window) => (
                      <SelectItem key={window.value} value={window.value}>
                        {window.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground">
                  Used as rolling window size for correlation/beta calculations
                </div>
                {dataWindow === "custom" && (
                  <div className="mt-2">
                    <Label htmlFor="custom-days">Custom Days</Label>
                    <Input
                      id="custom-days"
                      type="number"
                      value={customDays}
                      onChange={(e) => setCustomDays(parseInt(e.target.value))}
                      min="1"
                      max="3650"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="percent-change">Percent Change Periods</Label>
                <Input
                  id="percent-change"
                  type="number"
                  value={percentChangePeriods}
                  onChange={(e) =>
                    setPercentChangePeriods(parseInt(e.target.value))
                  }
                  min="1"
                  max="30"
                />
                <div className="text-sm text-muted-foreground">
                  Calculate (t+n price / t price - 1)
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={runAnalysis}
                  disabled={isLoading || selectedAssets.length < 2}
                  className="w-full"
                >
                  {isLoading ? "Analyzing..." : "Run Analysis"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {(correlationMatrix || betaMatrix) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analysis Results
              </CardTitle>
              <CardDescription>
                Correlation and Beta matrices use the full dataset. Click on any
                cell to view rolling analysis using the Data Window size.
                {alignedDataPoints && (
                  <div className="mt-2 text-sm text-green-600">
                    ✅ Using {alignedDataPoints} aligned data points (all assets
                    have data for the same dates)
                  </div>
                )}
              </CardDescription>
              {rawData && transformedData && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadDataAsCSV(
                        rawData,
                        `raw-prices-${dataWindow}-${selectedTimeframe}.csv`
                      )
                    }
                    disabled={!rawData}
                  >
                    Download Raw Data (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      downloadDataAsCSV(
                        transformedData,
                        `percentage-changes-${dataWindow}-${selectedTimeframe}.csv`
                      )
                    }
                    disabled={!transformedData}
                  >
                    Download Transformed Data (CSV)
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Correlation Matrix */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">
                      Correlation Matrix
                    </h3>
                    {correlationMatrix && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadMatrixAsCSV(
                            correlationMatrix,
                            "correlation",
                            `correlation-matrix-${dataWindow}-${selectedTimeframe}.csv`
                          )
                        }
                      >
                        Download Matrix (CSV)
                      </Button>
                    )}
                  </div>
                  {correlationMatrix &&
                    createMatrixPlot(correlationMatrix, "correlation")}
                </div>

                {/* Beta Matrix */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Beta Matrix</h3>
                    {betaMatrix && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          downloadMatrixAsCSV(
                            betaMatrix,
                            "beta",
                            `beta-matrix-${dataWindow}-${selectedTimeframe}.csv`
                          )
                        }
                      >
                        Download Matrix (CSV)
                      </Button>
                    )}
                  </div>
                  {betaMatrix && createMatrixPlot(betaMatrix, "beta")}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rolling Analysis Charts */}
        {(rollingCorrelations || rollingBetas) && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rolling Analysis
              </CardTitle>
              <CardDescription>
                Rolling correlations and betas over time (dynamic window based
                on correlation period)
              </CardDescription>
            </CardHeader>
            <CardContent className="w-full">
              <Tabs defaultValue="correlations" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="correlations">
                    Rolling Correlations
                  </TabsTrigger>
                  <TabsTrigger value="betas">Rolling Betas</TabsTrigger>
                </TabsList>

                <TabsContent value="correlations" className="space-y-4 w-full">
                  {rollingCorrelations && (
                    <div className="w-full">
                      <Plot
                        data={Object.entries(rollingCorrelations).map(
                          ([pair, data]) => ({
                            x: data.dates,
                            y: data.values,
                            type: "scatter" as const,
                            mode: "lines" as const,
                            name: pair,
                            line: { width: 1 },
                          })
                        )}
                        layout={{
                          title: "Rolling Correlations (dynamic window)",
                          xaxis: { title: "Date" },
                          yaxis: { title: "Correlation", range: [-1, 1] },
                          height: 500,
                          width: undefined,
                          showlegend: true,
                          legend: {
                            x: 1.02,
                            y: 1,
                            xanchor: "left" as const,
                            yanchor: "top" as const,
                          },
                          autosize: true,
                        }}
                        config={{ responsive: true }}
                        style={{ width: "100%" }}
                        useResizeHandler={true}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="betas" className="space-y-4 w-full">
                  {rollingBetas && (
                    <div className="w-full">
                      <Plot
                        data={Object.entries(rollingBetas).map(
                          ([pair, data]) => ({
                            x: data.dates,
                            y: data.values,
                            type: "scatter" as const,
                            mode: "lines" as const,
                            name: pair,
                            line: { width: 1 },
                          })
                        )}
                        layout={{
                          title: "Rolling Betas (dynamic window)",
                          xaxis: { title: "Date" },
                          yaxis: { title: "Beta" },
                          height: 500,
                          width: undefined,
                          showlegend: true,
                          legend: { x: 0, y: 1 },
                          autosize: true,
                        }}
                        config={{ responsive: true }}
                        style={{ width: "100%" }}
                        useResizeHandler={true}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {rawData && transformedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Table
              </CardTitle>
              <CardDescription>
                Raw prices and percentage changes used for analysis
              </CardDescription>
              {rawData && transformedData && (
                <div className="text-sm text-gray-600 mt-2">
                  <p>
                    <strong>Data Summary:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Total data points:{" "}
                      {Object.values(rawData)[0]?.length || 0}
                    </li>
                    <li>
                      Date range: {Object.values(rawData)[0]?.[0]?.date} to{" "}
                      {
                        Object.values(rawData)[0]?.[
                          Object.values(rawData)[0]?.length - 1
                        ]?.date
                      }{" "}
                      (latest first)
                    </li>
                    <li>Assets analyzed: {Object.keys(rawData).length}</li>
                    <li>Correlation window: {correlationWindowDays} days</li>
                    <li>
                      Rolling window: {correlationWindowDays} days (matches Data
                      Window)
                    </li>
                    <li>
                      Percentage change period: {percentChangePeriods} day
                      {percentChangePeriods !== 1 ? "s" : ""}
                    </li>
                  </ul>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadDataAsCSV(
                      rawData,
                      `raw-prices-${dataWindow}-${selectedTimeframe}.csv`
                    )
                  }
                  disabled={!rawData}
                >
                  Download Raw Data (CSV)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadDataAsCSV(
                      transformedData,
                      `percentage-changes-${dataWindow}-${selectedTimeframe}.csv`
                    )
                  }
                  disabled={!transformedData}
                >
                  Download Transformed Data (CSV)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="raw" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="raw">Raw Prices</TabsTrigger>
                  <TabsTrigger value="transformed">
                    Percentage Changes
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="raw" className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1 text-left">
                            Date
                          </th>
                          {Object.keys(rawData).map((symbol) => (
                            <th
                              key={symbol}
                              className="border border-gray-300 px-2 py-1 text-right"
                            >
                              {symbol}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(rawData)[0]
                          ?.slice(0, 20)
                          .map((dataPoint, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-1 text-left">
                                {dataPoint.date}
                              </td>
                              {Object.keys(rawData).map((symbol) => {
                                const value = rawData[symbol][index]?.value;
                                return (
                                  <td
                                    key={symbol}
                                    className="border border-gray-300 px-2 py-1 text-right"
                                  >
                                    {value !== undefined
                                      ? value.toFixed(4)
                                      : "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        {Object.values(rawData)[0]?.length > 20 && (
                          <tr>
                            <td
                              colSpan={Object.keys(rawData).length + 1}
                              className="border border-gray-300 px-2 py-1 text-center text-gray-500"
                            >
                              ... showing first 20 rows of{" "}
                              {Object.values(rawData)[0]?.length} total rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="transformed" className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-1 text-left">
                            Date
                          </th>
                          {Object.keys(transformedData).map((symbol) => (
                            <th
                              key={symbol}
                              className="border border-gray-300 px-2 py-1 text-right"
                            >
                              {symbol} (%)
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(transformedData)[0]
                          ?.slice(0, 20)
                          .map((dataPoint, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-2 py-1 text-left">
                                {dataPoint.date}
                              </td>
                              {Object.keys(transformedData).map((symbol) => {
                                const value =
                                  transformedData[symbol][index]?.value;
                                const colorClass =
                                  value !== undefined
                                    ? value > 0
                                      ? "text-green-600"
                                      : value < 0
                                      ? "text-red-600"
                                      : ""
                                    : "";
                                return (
                                  <td
                                    key={symbol}
                                    className={`border border-gray-300 px-2 py-1 text-right ${colorClass}`}
                                  >
                                    {value !== undefined
                                      ? value.toFixed(4)
                                      : "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        {Object.values(transformedData)[0]?.length > 20 && (
                          <tr>
                            <td
                              colSpan={Object.keys(transformedData).length + 1}
                              className="border border-gray-300 px-2 py-1 text-center text-gray-500"
                            >
                              ... showing first 20 rows of{" "}
                              {Object.values(transformedData)[0]?.length} total
                              rows
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>
                      <strong>Note:</strong> Percentage changes are calculated
                      as ((Price_t / Price_t-{percentChangePeriods}) - 1) × 100
                    </p>
                    <p>
                      Positive values (green) indicate price increases, negative
                      values (red) indicate price decreases.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Dual-Axis Price Comparison */}
        {rawData && Object.keys(rawData).length > 0 && (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Price Comparison & Rolling Correlation
              </CardTitle>
              <CardDescription>
                Compare two asset prices with dual y-axes and view their rolling
                correlation
              </CardDescription>
            </CardHeader>
            <CardContent className="w-full">
              <div className="space-y-4 w-full">
                {/* Asset Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pair1">Asset 1 (Left Y-Axis)</Label>
                    <Select
                      value={selectedPair1}
                      onValueChange={setSelectedPair1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select first asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(rawData).map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pair2">Asset 2 (Right Y-Axis)</Label>
                    <Select
                      value={selectedPair2}
                      onValueChange={setSelectedPair2}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select second asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(rawData).map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Price Comparison Chart */}
                {selectedPair1 &&
                  selectedPair2 &&
                  rawData[selectedPair1] &&
                  rawData[selectedPair2] && (
                    <div className="w-full">
                      <h3 className="text-lg font-semibold mb-2">
                        Price Comparison & Rolling Correlation
                      </h3>
                      <div className="w-full">
                        <Plot
                          data={[
                            // Subplot 1: Price comparison with dual y-axes
                            {
                              x: rawData[selectedPair1].map((d) => d.date),
                              y: rawData[selectedPair1].map((d) => d.value),
                              type: "scatter" as const,
                              mode: "lines" as const,
                              name: selectedPair1,
                              line: { color: "#ef4444" },
                              yaxis: "y" as const,
                              xaxis: "x" as const,
                            },
                            {
                              x: rawData[selectedPair2].map((d) => d.date),
                              y: rawData[selectedPair2].map((d) => d.value),
                              type: "scatter" as const,
                              mode: "lines" as const,
                              name: selectedPair2,
                              line: { color: "#10b981" },
                              yaxis: "y2" as const,
                              xaxis: "x" as const,
                            },
                            // Subplot 2: Rolling correlation
                            {
                              x: calculatePairRollingCorrelation(
                                rawData[selectedPair1],
                                rawData[selectedPair2],
                                correlationWindowDays
                              ).dates,
                              y: calculatePairRollingCorrelation(
                                rawData[selectedPair1],
                                rawData[selectedPair2],
                                correlationWindowDays
                              ).values,
                              type: "scatter" as const,
                              mode: "lines" as const,
                              name: `Rolling Correlation (${dataWindow})`,
                              line: { color: "#3b82f6" },
                              xaxis: "x2" as const,
                              yaxis: "y3" as const,
                            },
                          ]}
                          layout={{
                            title: `${selectedPair1} vs ${selectedPair2} - Price Comparison & Rolling Correlation`,
                            grid: {
                              rows: 2,
                              columns: 1,
                              pattern: "independent" as const,
                              rowheight: [0.55, 0.45],
                            },
                            // Subplot 1: Price comparison
                            xaxis: {
                              domain: [0, 1],
                              row: 1,
                              column: 1,
                              showticklabels: false,
                            } as any,
                            yaxis: {
                              title: selectedPair1,
                              titlefont: { color: "#ef4444" },
                              tickfont: { color: "#ef4444" },
                              domain: [0.55, 1],
                              row: 1,
                              column: 1,
                            } as any,
                            yaxis2: {
                              title: selectedPair2,
                              titlefont: { color: "#10b981" },
                              tickfont: { color: "#10b981" },
                              overlaying: "y" as const,
                              side: "right" as const,
                              domain: [0.55, 1],
                              row: 1,
                              column: 1,
                            } as any,
                            // Subplot 2: Rolling correlation
                            xaxis2: {
                              title: "Date",
                              domain: [0, 1],
                              row: 2,
                              column: 1,
                              position: 0,
                            } as any,
                            yaxis3: {
                              title: "Correlation",
                              range: [-1, 1],
                              domain: [0, 0.45],
                              row: 2,
                              column: 1,
                            } as any,
                            height: 700,
                            width: undefined,
                            showlegend: true,
                            legend: {
                              x: 0,
                              y: 1.02,
                              orientation: "h" as const,
                              xanchor: "left" as const,
                              yanchor: "bottom" as const,
                            },
                            margin: {
                              l: 50,
                              r: 50,
                              t: 80,
                              b: 50,
                            },
                            autosize: true,
                          }}
                          config={{ responsive: true }}
                          style={{ width: "100%" }}
                          useResizeHandler={true}
                        />
                      </div>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Analysis */}
        {selectedCell && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Detailed Analysis: {selectedCell.asset1} vs{" "}
                {selectedCell.asset2}
              </CardTitle>
              <CardDescription>
                {selectedCell.type === "correlation"
                  ? "Rolling Correlation"
                  : "Rolling Beta"}{" "}
                and Price Comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rolling Analysis Chart */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Rolling{" "}
                      {selectedCell.type === "correlation"
                        ? "Correlation"
                        : "Beta"}
                    </h3>
                    <Select value={dataWindow} onValueChange={setDataWindow}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_WINDOWS.map((window) => (
                          <SelectItem key={window.value} value={window.value}>
                            {window.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {rollingData && (
                    <Plot
                      data={[
                        {
                          x: rollingData.dates,
                          y: rollingData.values,
                          type: "scatter",
                          mode: "lines",
                          name: `${
                            selectedCell.type === "correlation"
                              ? "Correlation"
                              : "Beta"
                          }`,
                          line: { color: "#3b82f6" },
                        },
                      ]}
                      layout={{
                        title: `${
                          selectedCell.type === "correlation"
                            ? "Rolling Correlation"
                            : "Rolling Beta"
                        } (${dataWindow} window)`,
                        xaxis: { title: "Date" },
                        yaxis: {
                          title:
                            selectedCell.type === "correlation"
                              ? "Correlation"
                              : "Beta",
                        },
                        height: 400,
                      }}
                      config={{ responsive: true }}
                    />
                  )}
                </div>

                {/* Price Comparison Chart */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Price Comparison</h3>
                    <Select value={chartWindow} onValueChange={setChartWindow}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHART_WINDOWS.map((window) => (
                          <SelectItem key={window.value} value={window.value}>
                            {window.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {priceData && (
                    <Plot
                      data={[
                        {
                          x: priceData.asset1.map((d) => d.date),
                          y: priceData.asset1.map((d) => d.value),
                          type: "scatter",
                          mode: "lines",
                          name: selectedCell.asset1,
                          line: { color: "#ef4444" },
                          yaxis: "y",
                        },
                        {
                          x: priceData.asset2.map((d) => d.date),
                          y: priceData.asset2.map((d) => d.value),
                          type: "scatter",
                          mode: "lines",
                          name: selectedCell.asset2,
                          line: { color: "#10b981" },
                          yaxis: "y2",
                        },
                      ]}
                      layout={{
                        title: "Price Comparison",
                        xaxis: { title: "Date" },
                        yaxis: {
                          title: selectedCell.asset1,
                          titlefont: { color: "#ef4444" },
                          tickfont: { color: "#ef4444" },
                        },
                        yaxis2: {
                          title: selectedCell.asset2,
                          titlefont: { color: "#10b981" },
                          tickfont: { color: "#10b981" },
                          overlaying: "y",
                          side: "right",
                        },
                        height: 400,
                      }}
                      config={{ responsive: true }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
