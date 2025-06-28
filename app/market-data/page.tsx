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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Navigation } from "@/components/navigation";
import { useToast } from "@/hooks/use-toast";

interface FileStatus {
  file: string;
  exists: boolean;
  size: number;
  lastModified: string;
  dbStatus: {
    asset_id: string;
    table_name: string;
    exists: boolean;
    count: number;
    min_date: string | null;
    max_date: string | null;
  };
}

export default function MarketDataPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [dataStatus, setDataStatus] = useState<FileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/check-repo-data");
      if (!response.ok) {
        throw new Error("Failed to fetch data status");
      }
      const data = await response.json();
      setDataStatus(data.status);
      setLastUpdated(new Date());
      toast({
        title: "Success",
        description: "Data status updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not fetch data status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <Navigation title="Market Data Status" />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-4">
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button onClick={fetchData} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Data Repository Status</CardTitle>
            <CardDescription>
              Overview of data files in the repository and their status in the
              database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !lastUpdated ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>DB Table</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">DB Records</TableHead>
                    <TableHead>Date Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataStatus.map((status) => (
                    <TableRow key={status.file}>
                      <TableCell>
                        <div className="font-medium">
                          {status.dbStatus.asset_id}
                        </div>
                        <div className="text-sm text-gray-500">
                          {status.file}
                        </div>
                      </TableCell>
                      <TableCell>{status.dbStatus.table_name}</TableCell>
                      <TableCell className="text-center">
                        {status.dbStatus.exists ? (
                          <Badge
                            variant="default"
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" /> Loaded
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="mr-2 h-4 w-4" /> Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {status.dbStatus.count.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {status.dbStatus.min_date &&
                        status.dbStatus.max_date ? (
                          `${status.dbStatus.min_date} to ${status.dbStatus.max_date}`
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
