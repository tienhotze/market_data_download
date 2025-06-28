"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  TrendingUp,
  DollarSign,
  Globe,
  Shield,
  Calendar,
  BarChart3,
  Copy,
} from "lucide-react";
import { copyImageToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Navigation } from "@/components/navigation";

interface AidData {
  year: number;
  country: string;
  militaryAid: number;
  economicAid: number;
  humanitarianAid: number;
  total: number;
  source: string;
  notes?: string;
}

interface AidSummary {
  totalMilitaryAid: number;
  totalEconomicAid: number;
  totalHumanitarianAid: number;
  grandTotal: number;
  yearRange: string;
  dataPoints: number;
  ytd2025: {
    militaryAid: number;
    economicAid: number;
    humanitarianAid: number;
    total: number;
  };
}

export default function MilitarySpendingPage() {
  const [aidData, setAidData] = useState<AidData[]>([]);
  const [summary, setSummary] = useState<AidSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleCopyImage = async () => {
    if (tableRef.current) {
      const success = await copyImageToClipboard(tableRef.current);
      toast({
        title: success ? "Image Copied!" : "Copy Failed",
        description: success
          ? "The table has been copied to your clipboard as an image."
          : "Could not copy the table. Please try again.",
      });
    }
  };

  useEffect(() => {
    const fetchAidData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/military-spending?country=israel&startYear=2015&endYear=2025"
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        setAidData(result.data);

        // Calculate YTD 2025 data
        const ytd2025 = result.data.find(
          (item: AidData) => item.year === 2025
        ) || {
          militaryAid: 0,
          economicAid: 0,
          humanitarianAid: 0,
          total: 0,
        };

        setSummary({
          totalMilitaryAid: result.summary.totalMilitaryAid,
          totalEconomicAid: result.summary.totalEconomicAid,
          totalHumanitarianAid: result.summary.totalHumanitarianAid,
          grandTotal: result.summary.grandTotal,
          yearRange: result.summary.yearRange,
          dataPoints: result.summary.dataPoints,
          ytd2025: {
            militaryAid: ytd2025.militaryAid,
            economicAid: ytd2025.economicAid,
            humanitarianAid: ytd2025.humanitarianAid,
            total: ytd2025.total,
          },
        });
      } catch (err) {
        console.error("Error fetching military aid data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchAidData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading military spending data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="p-3 bg-red-100 rounded-lg mx-auto mb-4 w-fit">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
      <Navigation title="US Military Spending Tracker" />
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-lg mr-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              US Military Spending Tracker
            </h1>
          </div>
          <p className="text-xl text-gray-600 mb-4">
            Comprehensive tracking of US foreign aid and military assistance
            worldwide
          </p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <span>Global Aid Tracking</span>
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              <span>Financial Transparency</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Historical Data</span>
            </div>
          </div>
        </div>

        {/* Current Focus */}
        <Card className="mb-8 border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-red-600" />
              Current Focus: US Aid to Israel (
              {summary?.yearRange || "2015-2025"})
            </CardTitle>
            <CardDescription>
              Tracking military assistance, economic aid, and humanitarian
              support provided to Israel over the past decade
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Military Aid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {summary ? formatCurrency(summary.totalMilitaryAid) : "$0.0B"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.yearRange || "2015-2025"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Economic Aid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {summary ? formatCurrency(summary.totalEconomicAid) : "$0.0B"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.yearRange || "2015-2025"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Humanitarian Aid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {summary
                  ? formatCurrency(summary.totalHumanitarianAid)
                  : "$0.0B"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.yearRange || "2015-2025"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-purple-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Grand Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {summary ? formatCurrency(summary.grandTotal) : "$0.0B"}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {summary?.yearRange || "2015-2025"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 2025 YTD Card */}
        <Card className="mb-8 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              2025 Year-to-Date Funding
            </CardTitle>
            <CardDescription>
              Current year funding breakdown and projections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">
                  {summary
                    ? formatCurrency(summary.ytd2025.militaryAid)
                    : "$0.0B"}
                </div>
                <div className="text-sm text-gray-600">Military Aid</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {summary
                    ? formatCurrency(summary.ytd2025.economicAid)
                    : "$0.0B"}
                </div>
                <div className="text-sm text-gray-600">Economic Aid</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {summary
                    ? formatCurrency(summary.ytd2025.humanitarianAid)
                    : "$0.0B"}
                </div>
                <div className="text-sm text-gray-600">Humanitarian Aid</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {summary ? formatCurrency(summary.ytd2025.total) : "$0.0B"}
                </div>
                <div className="text-sm text-gray-600">Total YTD</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <div ref={tableRef} className="bg-white p-4 rounded-lg">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-gray-600" />
                  Annual Aid Breakdown ({summary?.yearRange || "2015-2025"})
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of US aid to Israel by category and year (
                  {summary?.dataPoints || 0} data points)
                </CardDescription>
              </div>
              <Button onClick={handleCopyImage} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                Copy Image
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">
                        Military Aid (B$)
                      </TableHead>
                      <TableHead className="text-right">
                        Economic Aid (B$)
                      </TableHead>
                      <TableHead className="text-right">
                        Humanitarian Aid (B$)
                      </TableHead>
                      <TableHead className="text-right">Total (B$)</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aidData.map((row, index) => (
                      <TableRow key={`${row.year}-${index}`} className="h-10">
                        <TableCell className="font-medium py-1">
                          {row.notes ? `${row.year}* Emergency Aid` : row.year}
                        </TableCell>
                        <TableCell className="text-right text-red-600 py-1">
                          {row.militaryAid.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 py-1">
                          {row.economicAid.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 py-1">
                          {row.humanitarianAid.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-semibold py-1">
                          {row.total.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 py-1">
                          {row.source}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="h-12">
                      <TableCell className="font-bold py-2 text-base">
                        10-Year Total
                      </TableCell>
                      <TableCell className="text-right font-bold text-red-600 py-2 text-base">
                        {summary?.totalMilitaryAid.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600 py-2 text-base">
                        {summary?.totalEconomicAid.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 py-2 text-base">
                        {summary?.totalHumanitarianAid.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-extrabold py-2 text-base">
                        {summary?.grandTotal.toFixed(1)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Source: Congressional Research Service, U.S. State Department,
                and news reports. All figures are in billions of U.S. dollars
                and may be approximate.
                <br />* Emergency Aid for 2024 is a supplemental package, and
                the value is an approximation based on multiple sources.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer */}
        <Card className="mt-8 border-gray-200">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">
              <p className="mb-2">
                <strong>Data Sources:</strong> This data is compiled from
                various sources including Congressional Research Service
                reports, State Department records, and official government
                appropriations. Figures represent authorized and appropriated
                amounts.
              </p>
              <p>
                <strong>Note:</strong> 2025 data represents year-to-date
                estimates and may be updated as new appropriations are approved.
                All amounts are in billions of US dollars (B$).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
