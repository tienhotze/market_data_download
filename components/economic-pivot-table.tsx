"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ChartDataPoint {
  date: string;
  momChange?: number;
  isProjected?: boolean;
}

interface EconomicPivotTableProps {
  data: ChartDataPoint[];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function calculateMedian(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function EconomicPivotTable({ data }: EconomicPivotTableProps) {
  const { years, dataByYear, summaryStats } = useMemo(() => {
    if (!data || data.length === 0) {
      return { years: [], dataByYear: {}, summaryStats: {} };
    }

    const dataByYearMap: {
      [year: string]: {
        [month: string]: { value?: number; isProjected?: boolean };
      };
    } = {};

    data.forEach((point) => {
      const date = new Date(point.date);
      const year = date.getUTCFullYear().toString();
      const month = date.getUTCMonth();
      if (!dataByYearMap[year]) {
        dataByYearMap[year] = {};
      }
      dataByYearMap[year][MONTHS[month]] = {
        value: point.momChange,
        isProjected: point.isProjected,
      };
    });

    const yearKeys: string[] = Object.keys(dataByYearMap).sort(
      (a, b) => parseInt(b) - parseInt(a)
    );

    const summaryStats: any = {};
    const currentYear = new Date().getUTCFullYear();
    const periods = [10, 20, 50];

    periods.forEach((period) => {
      const stats: any = { avg: {}, median: {} };
      MONTHS.forEach((month, monthIndex) => {
        const values = data
          .filter((p) => {
            const date = new Date(p.date);
            const year = date.getUTCFullYear();
            return (
              year > currentYear - period &&
              year <= currentYear &&
              date.getUTCMonth() === monthIndex &&
              !p.isProjected &&
              typeof p.momChange === "number"
            );
          })
          .map((p) => p.momChange!);

        if (values.length > 0) {
          stats.avg[month] = values.reduce((s, v) => s + v, 0) / values.length;
          stats.median[month] = calculateMedian(values);
        }
      });
      summaryStats[`${period}Y`] = stats;
    });

    return { years: yearKeys, dataByYear: dataByYearMap, summaryStats };
  }, [data]);

  const getCellStyles = (value?: number): React.CSSProperties => {
    if (typeof value === "number" && value < 0) {
      return { color: "red" };
    }
    return {};
  };

  if (years.length === 0) {
    return null;
  }

  const summaryPeriods = ["50Y", "20Y", "10Y"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Month-over-Month % Change</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-sm">Year</TableHead>
                {MONTHS.map((month) => (
                  <TableHead
                    key={month}
                    className="text-center font-mono text-sm"
                  >
                    {month}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryPeriods.map((period) => (
                <>
                  <TableRow key={`${period}-avg`} className="bg-muted/50">
                    <TableCell className="font-medium font-mono text-sm">
                      {period} Avg
                    </TableCell>
                    {MONTHS.map((month) => (
                      <TableCell
                        key={`${period}-avg-${month}`}
                        className="text-center font-mono text-sm"
                        style={getCellStyles(summaryStats[period]?.avg[month])}
                      >
                        {typeof summaryStats[period]?.avg[month] === "number"
                          ? `${summaryStats[period]?.avg[month].toFixed(2)}%`
                          : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow
                    key={`${period}-median`}
                    className="bg-muted/50 border-b-2 border-border"
                  >
                    <TableCell className="font-medium font-mono text-sm">
                      {period} Median
                    </TableCell>
                    {MONTHS.map((month) => (
                      <TableCell
                        key={`${period}-median-${month}`}
                        className="text-center font-mono text-sm"
                        style={getCellStyles(
                          summaryStats[period]?.median[month]
                        )}
                      >
                        {typeof summaryStats[period]?.median[month] === "number"
                          ? `${summaryStats[period]?.median[month].toFixed(2)}%`
                          : "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              ))}
              {years.map((year: string) => (
                <TableRow key={year}>
                  <TableCell className="font-medium font-mono text-sm">
                    {year}
                  </TableCell>
                  {MONTHS.map((month) => {
                    const cellData = dataByYear[year]?.[month];
                    const value = cellData?.value;

                    return (
                      <TableCell
                        key={`${year}-${month}`}
                        style={getCellStyles(value)}
                        className={`text-center font-mono text-sm ${
                          cellData?.isProjected ? "bg-red-50" : ""
                        }`}
                      >
                        {typeof value === "number"
                          ? `${value.toFixed(2)}%`
                          : "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
