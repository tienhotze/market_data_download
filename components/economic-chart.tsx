"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Dot,
  Brush,
} from "recharts";
import { TrendingUp, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EconomicPivotTable } from "./economic-pivot-table";

interface EconomicDataPoint {
  date: string;
  value: number;
  series: string;
  seriesName: string;
}

interface EconomicSeries {
  series: string;
  seriesName: string;
  data: EconomicDataPoint[];
  source: string;
  unit: string;
  frequency: string;
}

interface EconomicChartProps {
  data: EconomicSeries;
  showMovingAverages: {
    ma3: boolean;
    ma6: boolean;
    ma12: boolean;
  };
  showProjections: boolean;
  projectionMonths: number;
  loading: boolean;
}

export function EconomicChart({
  data,
  showMovingAverages,
  showProjections,
  projectionMonths,
  loading,
}: EconomicChartProps) {
  const { toast } = useToast();

  const dataWithChanges = useMemo(() => {
    if (!data?.data) return [];

    const sortedData = [...data.data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sortedData.map((point, index) => {
      const result: any = {
        date: point.date,
        value: point.value,
        formattedDate: new Date(point.date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
      };

      // Calculate month-over-month change
      if (index > 0) {
        const prevValue = sortedData[index - 1].value;
        if (prevValue !== 0) {
          result.momChange = ((point.value - prevValue) / prevValue) * 100;
        }
      }

      // Calculate year-over-year change
      if (index >= 12) {
        const previousYearValue = sortedData[index - 12].value;
        if (previousYearValue !== 0) {
          result.yoyChange =
            ((point.value - previousYearValue) / previousYearValue) * 100;
        }
      }

      return result;
    });
  }, [data]);

  const processedData = useMemo(() => {
    return dataWithChanges.map((point, index) => {
      const result = { ...point };

      const momChanges = dataWithChanges
        .slice(0, index + 1)
        .map((p) => p.momChange)
        .filter((c) => c !== undefined);

      if (showMovingAverages.ma3 && momChanges.length >= 3) {
        result.ma3 =
          momChanges.slice(-3).reduce((sum, val) => sum + val, 0) / 3;
      }
      if (showMovingAverages.ma6 && momChanges.length >= 6) {
        result.ma6 =
          momChanges.slice(-6).reduce((sum, val) => sum + val, 0) / 6;
      }
      if (showMovingAverages.ma12 && momChanges.length >= 12) {
        result.ma12 =
          momChanges.slice(-12).reduce((sum, val) => sum + val, 0) / 12;
      }

      return result;
    });
  }, [dataWithChanges, showMovingAverages]);

  const projectedData = useMemo(() => {
    if (!showProjections || !data?.data || data.data.length < 240) return [];

    const sortedData = [...data.data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const projections: any[] = [];

    // Calculate seasonal patterns (20-year average of month-over-month % changes)
    const seasonalPatterns: { [month: number]: number } = {};

    for (let month = 1; month <= 12; month++) {
      const monthChanges: number[] = [];

      for (let i = 1; i < sortedData.length; i++) {
        const currentDate = new Date(sortedData[i].date);

        if (currentDate.getMonth() + 1 === month) {
          const change =
            ((sortedData[i].value - sortedData[i - 1].value) /
              sortedData[i - 1].value) *
            100;
          monthChanges.push(change);
        }
      }

      if (monthChanges.length > 0) {
        // Use last 20 years of data for seasonal pattern
        const recentChanges = monthChanges.slice(-20);
        seasonalPatterns[month] =
          recentChanges.reduce((sum, change) => sum + change, 0) /
          recentChanges.length;
      } else {
        seasonalPatterns[month] = 0;
      }
    }

    // Generate projections
    const lastDataPoint = sortedData[sortedData.length - 1];
    let currentValue = lastDataPoint.value;
    let currentDate = new Date(lastDataPoint.date);

    for (let i = 1; i <= projectionMonths; i++) {
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);

      const month = currentDate.getMonth() + 1;
      const seasonalChange = seasonalPatterns[month] || 0;
      currentValue = currentValue * (1 + seasonalChange / 100);

      // Calculate projected YoY change
      let projectedYoyChange: number | null = null;
      const yearAgoIndex = sortedData.length - 12 + i;
      if (yearAgoIndex < sortedData.length) {
        const yearAgoValue = sortedData[yearAgoIndex].value;
        projectedYoyChange =
          ((currentValue - yearAgoValue) / yearAgoValue) * 100;
      } else {
        // need to use a projected value from a year ago
        const yearAgoProjected: { value: number } = projections[i - 12];
        if (yearAgoProjected) {
          projectedYoyChange =
            ((currentValue - yearAgoProjected.value) / yearAgoProjected.value) *
            100;
        }
      }

      const lastValue: number =
        i > 1 ? projections[i - 2].value : lastDataPoint.value;
      const projectedMomChange: number =
        ((currentValue - lastValue) / lastValue) * 100;

      projections.push({
        date: currentDate.toISOString().split("T")[0],
        value: currentValue,
        isProjected: true,
        formattedDate: currentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        }),
        yoyChange: projectedYoyChange,
        momChange: projectedMomChange,
      });
    }

    return projections;
  }, [data, showProjections, projectionMonths, dataWithChanges]);

  const chartData = useMemo(() => {
    return [...processedData, ...projectedData];
  }, [processedData, projectedData]);

  const copyTableToClipboard = async () => {
    const headers = ["Date", "Value", "MoM % Chg", "YoY % Chg"];
    if (showMovingAverages.ma3) headers.push("3M MA (MoM)");
    if (showMovingAverages.ma6) headers.push("6M MA (MoM)");
    if (showMovingAverages.ma12) headers.push("12M MA (MoM)");

    const csvContent = [
      headers.join(","),
      ...chartData.map((row) => {
        const values = [
          row.formattedDate,
          row.value?.toFixed(2) || "",
          row.momChange?.toFixed(2) || "",
          row.yoyChange?.toFixed(2) || "",
        ];
        if (showMovingAverages.ma3) values.push(row.ma3?.toFixed(2) || "");
        if (showMovingAverages.ma6) values.push(row.ma6?.toFixed(2) || "");
        if (showMovingAverages.ma12) values.push(row.ma12?.toFixed(2) || "");
        return values.join(",");
      }),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(csvContent);
      toast({
        title: "Table copied",
        description: "Economic data table copied to clipboard as CSV",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy table to clipboard",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                {data.seriesName}
              </CardTitle>
              <CardDescription>
                Historical data and projections • Source: {data.source} • Unit:{" "}
                {data.unit}
              </CardDescription>
              <CardDescription className="text-xs text-gray-500 pt-1">
                Projections are calculated using a 10-year historical average of
                seasonal month-over-month changes.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{data.frequency}</Badge>
              {showProjections && (
                <Badge variant="secondary">
                  {projectionMonths}M projection
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="formattedDate"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                  angle={-90}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  tick={{ fontSize: 12 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    typeof value === "number" ? `${value.toFixed(2)}%` : value,
                    name,
                  ]}
                />
                <Legend />
                <Brush dataKey="formattedDate" height={30} stroke="#2563eb" />

                <Line
                  type="monotone"
                  dataKey="yoyChange"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name={`${data.seriesName} (YoY % Chg)`}
                  connectNulls={false}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload?.isProjected) {
                      return <Dot cx={cx} cy={cy} r={3} fill="#dc2626" />;
                    }
                    return <Dot cx={cx} cy={cy} r={0} fill="transparent" />;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Data Table</CardTitle>
            <Button variant="ghost" size="sm" onClick={copyTableToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Table
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Value ({data.unit})</TableHead>
                  <TableHead>MoM % Chg</TableHead>
                  <TableHead>YoY % Chg</TableHead>
                  {showMovingAverages.ma3 && <TableHead>3M MA (MoM)</TableHead>}
                  {showMovingAverages.ma6 && <TableHead>6M MA (MoM)</TableHead>}
                  {showMovingAverages.ma12 && (
                    <TableHead>12M MA (MoM)</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...chartData].reverse().map((row: any, index: number) => (
                  <TableRow
                    key={index}
                    className={row.isProjected ? "bg-red-50" : ""}
                  >
                    <TableCell>{row.formattedDate}</TableCell>
                    <TableCell>{row.value?.toFixed(2)}</TableCell>
                    <TableCell>{row.momChange?.toFixed(2)}%</TableCell>
                    <TableCell>{row.yoyChange?.toFixed(2)}%</TableCell>
                    {showMovingAverages.ma3 && (
                      <TableCell>{row.ma3?.toFixed(2)}%</TableCell>
                    )}
                    {showMovingAverages.ma6 && (
                      <TableCell>{row.ma6?.toFixed(2)}%</TableCell>
                    )}
                    {showMovingAverages.ma12 && (
                      <TableCell>{row.ma12?.toFixed(2)}%</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <EconomicPivotTable data={chartData} />
    </div>
  );
}
