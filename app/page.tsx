"use client";

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
  TrendingUp,
  Calendar,
  BarChart3,
  Download,
  Activity,
  DollarSign,
  Building2,
  Shield,
  Globe,
  GitGraph,
  Target,
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Market Wizard
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Comprehensive financial analysis platform for market data, events,
            and economic indicators
          </p>
          <div className="flex justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span>Real-time Data</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span>Advanced Analytics</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>Predictive Models</span>
            </div>
          </div>
        </div>

        {/* Main Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Market Data Download */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-blue-200 hover:border-blue-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Download className="h-8 w-8 text-blue-600" />
                </div>
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  Market Data
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Market Data Download
              </CardTitle>
              <CardDescription className="text-gray-600">
                Download and analyze historical market data for stocks, indices,
                commodities, and currencies
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Real-time price data and technical indicators</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Interactive charts with multiple timeframes</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>CSV export and data visualization tools</span>
                </div>
              </div>
              <Link href="/market-data">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Access Market Data
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Event Analysis */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-green-200 hover:border-green-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-50 text-green-700"
                >
                  Events
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Event Analysis
              </CardTitle>
              <CardDescription className="text-gray-600">
                Analyze market performance around significant economic and
                political events
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Pre/post event performance analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Multi-asset comparison and correlation</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>Statistical significance testing</span>
                </div>
              </div>
              <Link href="/event-analysis">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                  Analyze Events
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Economic Data Analysis */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-purple-200 hover:border-purple-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-purple-50 text-purple-700"
                >
                  Economics
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Economic Data Analysis
              </CardTitle>
              <CardDescription className="text-gray-600">
                Track and forecast economic indicators including jobs,
                inflation, GDP, and retail sales
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Economic data sourced from a dedicated database</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Moving averages and seasonal projections</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span>Year-over-year trend analysis</span>
                </div>
              </div>
              <Link href="/economic-analysis">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  Analyze Economics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Military Spending Tracker */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-red-200 hover:border-red-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                  <Shield className="h-8 w-8 text-red-600" />
                </div>
                <Badge variant="secondary" className="bg-red-50 text-red-700">
                  Military
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Military Spending Tracker
              </CardTitle>
              <CardDescription className="text-gray-600">
                Track US foreign aid and military assistance worldwide with
                detailed breakdowns
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>US foreign aid tracking by country and year</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>
                    Military, economic, and humanitarian aid breakdown
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span>Historical data and current year estimates</span>
                </div>
              </div>
              <Link href="/military-spending">
                <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Track Military Aid
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Asset Analysis */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-yellow-200 hover:border-yellow-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-yellow-100 rounded-lg group-hover:bg-yellow-200 transition-colors">
                  <GitGraph className="h-8 w-8 text-yellow-600" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-yellow-50 text-yellow-700"
                >
                  Analysis
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Asset Analysis
              </CardTitle>
              <CardDescription className="text-gray-600">
                Chart asset prices against economic data with custom
                transformations.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Single and multi-asset charting</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Price and percentage change analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span>Combine asset and economic data series</span>
                </div>
              </div>
              <Link href="/asset-analysis">
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                  Analyze Assets
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Correlation Analysis */}
          <Card className="group hover:shadow-xl transition-all duration-300 border-indigo-200 hover:border-indigo-400">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                  <Target className="h-8 w-8 text-indigo-600" />
                </div>
                <Badge
                  variant="secondary"
                  className="bg-indigo-50 text-indigo-700"
                >
                  Correlation
                </Badge>
              </div>
              <CardTitle className="text-xl text-gray-900">
                Cross-Correlation & Beta Analysis
              </CardTitle>
              <CardDescription className="text-gray-600">
                Analyze cross-correlations and betas between multiple assets
                with interactive matrices.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span>Single and multi-asset charting</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span>Price and percentage change analysis</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
                  <span>Combine asset and economic data series</span>
                </div>
              </div>
              <Link href="/correlation-analysis">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  Open Correlation Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Feature Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">50+</div>
            <div className="text-sm text-gray-600">Market Assets</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">100+</div>
            <div className="text-sm text-gray-600">Economic Events</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">15+</div>
            <div className="text-sm text-gray-600">Economic Indicators</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mx-auto mb-3">
              <Globe className="h-6 w-6 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">10+</div>
            <div className="text-sm text-gray-600">Countries Tracked</div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>© 2025 Market Wizard. Professional financial analysis platform.</p>
        </div>
      </div>
    </div>
  );
}
