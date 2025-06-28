"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, PlusCircle, XCircle } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { sub, format } from "date-fns";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// --- TYPE DEFINITIONS ---
interface DataPoint {
  date: string;
  value: number | null;
}

interface SeriesData {
  [traceName: string]: DataPoint[];
}

interface AssetInput {
  id: number;
  value: string;
  transformation: "percent" | "simple" | "none";
  period: number;
  yAxis: "left" | "right";
  frequency: string;
  availableFrequencies: { [key: string]: string };
}

interface ApiAsset {
  id: number;
  symbol: string;
  name: string;
}

type DateRange = "1Y" | "2Y" | "5Y" | "Max";

// --- HELPER FUNCTIONS ---
const getTraceName = (
  assetValue: string,
  transformation: string,
  period: number,
  frequency: string
) => {
  if (!assetValue) return "";
  if (transformation === "none" || !transformation) return assetValue;
  const changeType = transformation === "percent" ? "% change" : "change";
  return `${assetValue} ${period}${frequency} ${changeType}`;
};

// --- MAIN PAGE COMPONENT ---
export default function AssetAnalysisPage() {
  const [seriesData, setSeriesData] = useState<SeriesData>({});
  const [allAssets, setAllAssets] = useState<ApiAsset[]>([]);
  const [assets, setAssets] = useState<AssetInput[]>([
    {
      id: 1,
      value: "WTI",
      transformation: "none",
      period: 1,
      yAxis: "left",
      frequency: "daily",
      availableFrequencies: {},
    },
  ]);
  const [dateRange, setDateRange] = useState<DateRange>("1Y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"lines" | "markers">("lines");
  const [axisRanges, setAxisRanges] = useState({
    yLeftMin: "",
    yLeftMax: "",
    yRightMin: "",
    yRightMax: "",
    xMin: "",
    xMax: "",
  });
  const [savedAnalyses, setSavedAnalyses] = useState<{ [key: string]: any }>(
    {}
  );

  const summaryData = useMemo(() => {
    return Object.entries(seriesData)
      .map(([traceName, data]) => {
        if (!data || data.length === 0) {
          return null;
        }

        const validData = data.filter((p) => p.value !== null && p.date);
        if (validData.length === 0) return null;

        const firstPoint = validData[0];
        const lastPoint = validData[validData.length - 1];

        return {
          name: traceName,
          startDate: format(new Date(firstPoint.date), "yyyy-MM-dd"),
          startValue:
            typeof firstPoint.value === "number"
              ? firstPoint.value.toFixed(2)
              : "N/A",
          endDate: format(new Date(lastPoint.date), "yyyy-MM-dd"),
          endValue:
            typeof lastPoint.value === "number"
              ? lastPoint.value.toFixed(2)
              : "N/A",
        };
      })
      .filter(Boolean);
  }, [seriesData]);

  // --- LOCAL STORAGE & SETUP ---
  const handleAssetChange = useCallback(
    (id: number, field: string, value: any) => {
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          if (asset.id === id) {
            const updatedAsset = { ...asset, [field]: value };
            if (field === "value") {
              fetchFrequencies(id, value);
              if (
                updatedAsset.availableFrequencies &&
                !Object.keys(updatedAsset.availableFrequencies).includes(
                  updatedAsset.frequency
                )
              ) {
                updatedAsset.frequency =
                  Object.keys(updatedAsset.availableFrequencies)[0] || "daily";
              }
            }
            return updatedAsset;
          }
          return asset;
        })
      );
    },
    []
  );

  const fetchFrequencies = async (assetId: number, symbol: string) => {
    if (!symbol) return;
    try {
      const response = await fetch(`/api/asset-frequencies?symbol=${symbol}`);
      const data = await response.json();
      if (response.ok) {
        handleAssetChange(assetId, "availableFrequencies", data.frequencies);
      }
    } catch (err) {
      console.error("Failed to fetch frequencies", err);
    }
  };

  useEffect(() => {
    const saved = JSON.parse(
      localStorage.getItem("savedAssetAnalyses") || "{}"
    );
    setSavedAnalyses(saved);

    const fetchAssetList = async () => {
      try {
        const response = await fetch("/api/assets");
        if (!response.ok) throw new Error("Failed to fetch asset list");
        const data: ApiAsset[] = await response.json();
        setAllAssets(data.sort((a, b) => a.symbol.localeCompare(b.symbol)));
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load asset list"
        );
      }
    };
    fetchAssetList();

    if (assets.length === 1 && assets[0].value === "WTI") {
      fetchFrequencies(assets[0].id, assets[0].value);
    }
  }, []);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const newSeriesData: SeriesData = {};

    const assetConfigs = assets.filter((a) => a.value && a.value.trim() !== "");
    if (assetConfigs.length === 0) {
      setSeriesData({});
      setLoading(false);
      return;
    }

    try {
      for (const asset of assetConfigs) {
        const params = new URLSearchParams({
          asset: asset.value,
          transformation:
            asset.transformation === "none" ? "" : asset.transformation,
          period: String(asset.period),
        });

        const response = await fetch(
          `/api/asset-analysis?${params.toString()}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Failed to fetch data for ${asset.value}: ${
              errorData.error || response.statusText
            }`
          );
        }

        const data: DataPoint[] = await response.json();
        const traceName = getTraceName(
          asset.value,
          asset.transformation,
          asset.period,
          asset.frequency
        );
        newSeriesData[traceName] = data;
      }
      setSeriesData(newSeriesData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unknown error occurred while fetching data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- DERIVED STATE & MEMOS ---
  const filteredSeriesData = useMemo(() => {
    if (dateRange === "Max") {
      return seriesData;
    }
    const now = new Date();
    let years = 1;
    if (dateRange === "2Y") years = 2;
    if (dateRange === "5Y") years = 5;

    const startDate = sub(now, { years });
    const formattedStartDate = format(startDate, "yyyy-MM-dd");

    const filtered: SeriesData = {};
    for (const traceName in seriesData) {
      filtered[traceName] = seriesData[traceName].filter(
        (d) => d.date >= formattedStartDate
      );
    }
    return filtered;
  }, [seriesData, dateRange]);

  const traces = useMemo(() => {
    return Object.entries(filteredSeriesData).map(([traceName, data]) => {
      const assetConfig = assets.find(
        (a) =>
          traceName === a.value ||
          traceName ===
            getTraceName(a.value, a.transformation, a.period, a.frequency)
      );

      return {
        x: data.map((d) => d.date),
        y: data.map((d) => d.value),
        name: traceName,
        type: "scatter",
        mode: chartMode,
        yaxis: assetConfig?.yAxis === "right" ? "y2" : "y1",
      };
    });
  }, [filteredSeriesData, assets, chartMode]);

  // --- HANDLERS ---
  const handleAddAsset = () => {
    setAssets([
      ...assets,
      {
        id: Date.now(),
        value: "",
        transformation: "none",
        period: 1,
        yAxis: "left",
        frequency: "daily",
        availableFrequencies: {},
      },
    ]);
  };

  const handleRemoveAsset = (id: number) => {
    setAssets(assets.filter((asset) => asset.id !== id));
  };

  const handleAxisRangeChange = (
    axis: "yLeft" | "yRight" | "x",
    boundary: "Min" | "Max",
    value: string
  ) => {
    setAxisRanges((prev) => ({
      ...prev,
      [`${axis}${boundary}`]: value,
    }));
  };

  const handleSaveAnalysis = () => {
    const defaultName = assets.map((a) => a.value || "new").join(" - ");
    const name = prompt("Enter a name for this analysis:", defaultName);
    if (name) {
      const analysisToSave = {
        assets,
        axisRanges,
      };
      const newSavedAnalyses = { ...savedAnalyses, [name]: analysisToSave };
      setSavedAnalyses(newSavedAnalyses);
      localStorage.setItem(
        "savedAssetAnalyses",
        JSON.stringify(newSavedAnalyses)
      );
    }
  };

  const handleLoadAnalysis = (name: string) => {
    const analysisToLoad = savedAnalyses[name];
    if (analysisToLoad) {
      setAssets(analysisToLoad.assets);
      setAxisRanges(analysisToLoad.axisRanges);
    }
  };

  const handleDeleteAnalysis = (name: string) => {
    if (confirm(`Are you sure you want to delete the analysis "${name}"?`)) {
      const newSaved = { ...savedAnalyses };
      delete newSaved[name];
      setSavedAnalyses(newSaved);
      localStorage.setItem("savedAssetAnalyses", JSON.stringify(newSaved));
    }
  };

  // --- RENDER ---
  return (
    <div className="container mx-auto p-4">
      <Navigation />
      <h1 className="text-2xl font-bold mb-4">Asset Analysis</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-end space-x-2 p-2 border rounded-md relative"
              >
                <div className="flex-grow">
                  <Label>Asset</Label>
                  <Select
                    value={asset.value}
                    onValueChange={(value) =>
                      handleAssetChange(asset.id, "value", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {allAssets.map((a) => (
                        <SelectItem key={a.id} value={a.symbol}>
                          {a.symbol} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transform</Label>
                  <Select
                    value={asset.transformation}
                    onValueChange={(value) =>
                      handleAssetChange(asset.id, "transformation", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="percent">% Change</SelectItem>
                      <SelectItem value="simple">Simple Change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Period</Label>
                  <Input
                    type="number"
                    value={asset.period}
                    onChange={(e) =>
                      handleAssetChange(
                        asset.id,
                        "period",
                        parseInt(e.target.value) || 1
                      )
                    }
                    className="w-20"
                    min="1"
                  />
                </div>
                <div>
                  <Label>Y-Axis</Label>
                  <Select
                    value={asset.yAxis}
                    onValueChange={(value) =>
                      handleAssetChange(asset.id, "yAxis", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveAsset(asset.id)}
                  className="absolute -right-2 -top-2 h-5 w-5"
                >
                  <XCircle className="h-5 w-5 text-gray-400 hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={handleAddAsset}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
            <Button onClick={fetchData} disabled={loading} className="w-48">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Fetch & Render Chart
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryData.length > 0 && !loading && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Data Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Start Value</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>End Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryData.map((summary) =>
                  summary ? (
                    <TableRow key={summary.name}>
                      <TableCell>{summary.name}</TableCell>
                      <TableCell>{summary.startDate}</TableCell>
                      <TableCell>{summary.startValue}</TableCell>
                      <TableCell>{summary.endDate}</TableCell>
                      <TableCell>{summary.endValue}</TableCell>
                    </TableRow>
                  ) : null
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {error && <div className="text-red-500 mb-4">Error: {error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Chart</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-96">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Plot
                  data={traces as any}
                  layout={{
                    autosize: true,
                    yaxis: {
                      title: "Left Y-Axis",
                      domain: [0, 1],
                      autorange:
                        axisRanges.yLeftMin === "" &&
                        axisRanges.yLeftMax === "",
                      range:
                        axisRanges.yLeftMin !== "" && axisRanges.yLeftMax !== ""
                          ? [
                              parseFloat(axisRanges.yLeftMin),
                              parseFloat(axisRanges.yLeftMax),
                            ]
                          : undefined,
                    },
                    yaxis2: {
                      title: "Right Y-Axis",
                      overlaying: "y",
                      side: "right",
                      autorange:
                        axisRanges.yRightMin === "" &&
                        axisRanges.yRightMax === "",
                      range:
                        axisRanges.yRightMin !== "" &&
                        axisRanges.yRightMax !== ""
                          ? [
                              parseFloat(axisRanges.yRightMin),
                              parseFloat(axisRanges.yRightMax),
                            ]
                          : undefined,
                    },
                    xaxis: {
                      autorange:
                        axisRanges.xMin === "" && axisRanges.xMax === "",
                      range:
                        axisRanges.xMin !== "" && axisRanges.xMax !== ""
                          ? [axisRanges.xMin, axisRanges.xMax]
                          : undefined,
                    },
                    margin: { l: 50, r: 50, b: 50, t: 50, pad: 4 },
                  }}
                  useResizeHandler={true}
                  className="w-full h-96"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select
                  value={dateRange}
                  onValueChange={(v) => setDateRange(v as DateRange)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1Y">1 Year</SelectItem>
                    <SelectItem value="2Y">2 Years</SelectItem>
                    <SelectItem value="5Y">5 Years</SelectItem>
                    <SelectItem value="Max">Max</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Chart Mode</Label>
                <Select
                  value={chartMode}
                  onValueChange={(v) => setChartMode(v as "lines" | "markers")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lines">Lines</SelectItem>
                    <SelectItem value="markers">Markers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Y-Axis (Left)</Label>
                <div className="flex space-x-2">
                  <Input
                    value={axisRanges.yLeftMin}
                    onChange={(e) =>
                      handleAxisRangeChange("yLeft", "Min", e.target.value)
                    }
                    placeholder="Min"
                  />
                  <Input
                    value={axisRanges.yLeftMax}
                    onChange={(e) =>
                      handleAxisRangeChange("yLeft", "Max", e.target.value)
                    }
                    placeholder="Max"
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Y-Axis (Right)</Label>
                <div className="flex space-x-2">
                  <Input
                    value={axisRanges.yRightMin}
                    onChange={(e) =>
                      handleAxisRangeChange("yRight", "Min", e.target.value)
                    }
                    placeholder="Min"
                  />
                  <Input
                    value={axisRanges.yRightMax}
                    onChange={(e) =>
                      handleAxisRangeChange("yRight", "Max", e.target.value)
                    }
                    placeholder="Max"
                  />
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <Label>X-Axis (Date)</Label>
                <div className="flex space-x-2">
                  <Input
                    type="date"
                    value={axisRanges.xMin}
                    onChange={(e) =>
                      handleAxisRangeChange("x", "Min", e.target.value)
                    }
                    placeholder="Min"
                  />
                  <Input
                    type="date"
                    value={axisRanges.xMax}
                    onChange={(e) =>
                      handleAxisRangeChange("x", "Max", e.target.value)
                    }
                    placeholder="Max"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Analysis Snapshots</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSaveAnalysis} className="w-full mb-2">
                Save Current Analysis
              </Button>
              {Object.keys(savedAnalyses).length > 0 && (
                <div className="space-y-2">
                  <Label>Load Analysis</Label>
                  {Object.keys(savedAnalyses).map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between"
                    >
                      <Button
                        variant="link"
                        onClick={() => handleLoadAnalysis(name)}
                      >
                        {name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteAnalysis(name)}
                      >
                        <XCircle className="h-4 w-4 text-gray-400 hover:text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
