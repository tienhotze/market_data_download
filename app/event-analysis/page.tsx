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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
  Settings,
} from "lucide-react";
import { EventChart } from "@/components/event-chart";
import { MultiEventChart } from "@/components/multi-event-chart";
import type { EventData } from "@/types";
import { eventDataDB } from "@/lib/indexeddb";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_EVENTS: EventData[] = [
  // Sort all events by date (earliest to latest)
  {
    id: "september-11",
    name: "September 11 Attacks",
    date: "2001-09-11",
    category: "Geopolitical",
    description: "Terrorist attacks in US, markets closed for days",
  },
  {
    id: "lehman-collapse",
    name: "Lehman Brothers Collapse",
    date: "2008-09-15",
    category: "Financial Crisis",
    description:
      "Lehman Brothers files for bankruptcy, triggering financial crisis",
  },
  {
    id: "brexit-vote",
    name: "Brexit Vote",
    date: "2016-06-23",
    category: "Geopolitical",
    description: "UK votes to leave European Union, causing market uncertainty",
  },
  {
    id: "operation-litani",
    name: "Operation Litani",
    date: "1978-03-14",
    category: "Geopolitical",
    description:
      "Israeli invasion of South Lebanon to push PLO north of Litani River",
  },
  {
    id: "iran-iraq-war",
    name: "Iran-Iraq War Begins",
    date: "1980-09-22",
    category: "Geopolitical",
    description:
      "Iraq invades Iran, starting 8-year war with major oil market impacts",
  },
  {
    id: "lebanon-war-1982",
    name: "1982 Lebanon War",
    date: "1982-06-06",
    category: "Geopolitical",
    description: "Full-scale Israeli invasion of Lebanon, siege of Beirut",
  },
  {
    id: "operation-accountability",
    name: "Operation Accountability",
    date: "1993-07-25",
    category: "Geopolitical",
    description: "Israeli shelling campaign against Hezbollah in Lebanon",
  },
  {
    id: "operation-grapes-wrath",
    name: "Operation Grapes of Wrath",
    date: "1996-04-11",
    category: "Geopolitical",
    description:
      "Massive Israeli airstrikes in Lebanon in response to Katyusha fire",
  },
  {
    id: "hezbollah-raid-2006",
    name: "Hezbollah Cross-Border Raid",
    date: "2006-07-12",
    category: "Geopolitical",
    description:
      "Hezbollah kidnapping of Israeli soldiers sparks 2006 Lebanon War",
  },
  {
    id: "lebanon-war-2006",
    name: "2006 Lebanon War",
    date: "2006-07-12",
    category: "Geopolitical",
    description:
      "34-day war between Israel and Hezbollah triggered by cross-border raid",
  },
  {
    id: "operation-cast-lead",
    name: "Operation Cast Lead",
    date: "2008-12-27",
    category: "Geopolitical",
    description: "Israeli air and ground campaign in Gaza against Hamas",
  },
  {
    id: "operation-pillar-defense",
    name: "Operation Pillar of Defense",
    date: "2012-11-14",
    category: "Geopolitical",
    description:
      "Israeli operation in Gaza starting with targeted killing of Ahmed Jabari",
  },
  {
    id: "operation-protective-edge",
    name: "Operation Protective Edge",
    date: "2014-07-08",
    category: "Geopolitical",
    description: "50-day Gaza war with Israeli ground invasion against Hamas",
  },
  {
    id: "covid-crash",
    name: "COVID-19 Market Crash",
    date: "2020-02-20",
    category: "Pandemic",
    description: "WHO declares COVID-19 a pandemic, markets crash globally",
  },
  {
    id: "fed-emergency-cut",
    name: "Fed Emergency Rate Cut",
    date: "2020-03-15",
    category: "Fed",
    description: "Federal Reserve cuts rates to near zero in emergency meeting",
  },
  {
    id: "operation-guardian-walls",
    name: "Operation Guardian of the Walls",
    date: "2021-05-10",
    category: "Geopolitical",
    description:
      "11-day conflict triggered by Jerusalem tensions, Hamas rocket barrages",
  },
  {
    id: "russia-ukraine",
    name: "Russia-Ukraine War",
    date: "2022-02-24",
    category: "Geopolitical",
    description: "Russia invades Ukraine, triggering global market volatility",
  },
  {
    id: "fed-hikes-2022",
    name: "Fed Rate Hikes Begin",
    date: "2022-03-16",
    category: "Fed",
    description: "Federal Reserve begins aggressive interest rate hiking cycle",
  },
  {
    id: "svb-collapse",
    name: "Silicon Valley Bank Collapse",
    date: "2023-03-10",
    category: "Banking",
    description:
      "Silicon Valley Bank fails, triggering banking sector concerns",
  },
  {
    id: "hamas-oct-7-attack",
    name: "Hamas October 7 Attack",
    date: "2023-10-07",
    category: "Geopolitical",
    description:
      "Coordinated Hamas attack on Israel, triggering largest war since 1973",
  },
  {
    id: "iran-direct-attack-israel",
    name: "Iran's Direct Attack on Israel",
    date: "2024-04-13",
    category: "Geopolitical",
    description:
      "First direct Iranian missile and drone attack on Israel, largely intercepted",
  },
  {
    id: "israel-strike-iran-2025",
    name: "Israel Strike on Iran (Tehran)",
    date: "2025-06-14",
    category: "Geopolitical",
    description: "Reported Israeli airstrikes on Iranian nuclear-linked sites",
  },
].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

const ASSET_SYMBOLS = [
  "WTI",
  "Gold",
  "VIX",
  "DXY Index",
  "SPX",
  "UST 10Y Yield",
];

export default function EventAnalysisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [events, setEvents] = useState<EventData[]>(DEFAULT_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string>(
    "Loading cache status..."
  );
  const [newEvent, setNewEvent] = useState({
    name: "",
    date: "",
    category: "",
    description: "",
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>(ASSET_SYMBOLS[0]);
  const [assetData, setAssetData] = useState<any[]>([]);
  const [loadingAsset, setLoadingAsset] = useState(false);

  // Initialize database and check cache status
  useEffect(() => {
    const initializeAndCheckCache = async () => {
      try {
        // Initialize database
        await eventDataDB.clearOldData(24);

        // Get cache status
        const stats = await eventDataDB.getStorageStats();
        const totalDataPoints = await getTotalDataPoints();

        setCacheStatus(
          `Cache Status: ${
            stats.assetDataCount
          } assets loaded with ${totalDataPoints.toLocaleString()} total closing prices`
        );

        console.log(
          `IndexedDB stats: ${stats.eventDataCount} event records, ${stats.bulkDataCount} bulk records`
        );

        // Auto-load stale assets if needed
        await autoLoadStaleAssets();
      } catch (error) {
        console.error("Failed to initialize:", error);
        setCacheStatus("Cache Status: Error loading cache information");
        toast({
          title: "Initialization Error",
          description:
            "Failed to initialize database. Some features may not work properly.",
          variant: "destructive",
        });
      }
    };

    initializeAndCheckCache();
  }, [toast]);

  useEffect(() => {
    setLastUpdated(new Date().toLocaleString());
  }, []);

  const getTotalDataPoints = async (): Promise<number> => {
    let total = 0;
    for (const assetName of ASSET_SYMBOLS) {
      const assetData = await eventDataDB.getAssetClosingPrices(assetName);
      if (assetData && assetData.closingPrices.length > 0) {
        total += assetData.closingPrices.length;
      }
    }
    return total;
  };

  const autoLoadStaleAssets = async () => {
    // Check if we have recent asset data (less than 24 hours old)
    const assetDataPromises = ASSET_SYMBOLS.map(async (assetName) => {
      const isFresh = await eventDataDB.isAssetDataFresh(assetName, 24);
      return { assetName, isFresh };
    });

    const assetFreshness = await Promise.all(assetDataPromises);
    const staleAssets = assetFreshness.filter((asset) => !asset.isFresh);

    if (staleAssets.length > 0) {
      toast({
        title: "Loading Asset Data",
        description: `Loading ${staleAssets.length} assets with stale data in the background...`,
      });

      // Load stale assets in background
      const loadPromises = staleAssets.map(async ({ assetName }) => {
        try {
          await refreshSingleAsset(assetName);
        } catch (error) {
          console.error(`Failed to load ${assetName}:`, error);
        }
      });

      await Promise.allSettled(loadPromises);

      // Update cache status after loading
      const stats = await eventDataDB.getStorageStats();
      const totalDataPoints = await getTotalDataPoints();
      setCacheStatus(
        `Cache Status: ${
          stats.assetDataCount
        } assets loaded with ${totalDataPoints.toLocaleString()} total closing prices`
      );

      toast({
        title: "Asset Data Updated",
        description: `Background loading completed. ${stats.assetDataCount} assets now cached.`,
      });
    }
  };

  const refreshSingleAsset = async (assetName: string) => {
    const ASSET_TICKERS = {
      "S&P 500": "^GSPC",
      "WTI Crude Oil": "CL=F",
      Gold: "GC=F",
      "Dollar Index": "DX-Y.NYB",
      "10Y Treasury Yield": "^TNX",
      VIX: "^VIX",
    };

    const ticker = ASSET_TICKERS[assetName as keyof typeof ASSET_TICKERS];
    if (!ticker) return;

    // Try GitHub first
    let githubSuccess = false;
    try {
      const githubResponse = await fetch("/api/check-repo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });

      if (githubResponse.ok) {
        const githubData = await githubResponse.json();
        if (githubData.data && githubData.data.length > 0) {
          const dateRange = {
            start: githubData.data[0].date,
            end: githubData.data[githubData.data.length - 1].date,
          };

          await eventDataDB.storeAssetClosingPrices(
            assetName,
            ticker,
            githubData.data,
            dateRange
          );
          githubSuccess = true;
        }
      }
    } catch (githubError) {
      console.error(`GitHub failed for ${assetName}:`, githubError);
    }

    // Try Yahoo Finance if GitHub failed
    if (!githubSuccess) {
      try {
        const yahooResponse = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tickers: [ticker],
            period: "max",
            extraData: false,
          }),
        });

        if (yahooResponse.ok) {
          const yahooData = await yahooResponse.json();
          if (yahooData.data && yahooData.data.length > 0) {
            const dateRange = {
              start: yahooData.data[0].Date,
              end: yahooData.data[yahooData.data.length - 1].Date,
            };

            await eventDataDB.storeAssetClosingPrices(
              assetName,
              ticker,
              yahooData.data,
              dateRange
            );
          }
        }
      } catch (yahooError) {
        console.error(`Yahoo Finance failed for ${assetName}:`, yahooError);
      }
    }
  };

  const handleAddEvent = () => {
    if (newEvent.name && newEvent.date && newEvent.category) {
      const event: EventData = {
        id: `custom-${Date.now()}`,
        name: newEvent.name,
        date: newEvent.date,
        category: newEvent.category,
        description: newEvent.description,
      };
      setEvents([...events, event]);
      setNewEvent({ name: "", date: "", category: "", description: "" });
      setShowAddDialog(false);
    }
  };

  const handleEventSelect = (eventId: string) => {
    const event = events.find((e) => e.id === eventId);
    setSelectedEvent(event || null);
  };

  // Group events by category for better organization
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.category]) {
      acc[event.category] = [];
    }
    acc[event.category].push(event);
    return acc;
  }, {} as Record<string, EventData[]>);

  useEffect(() => {
    async function fetchAssetData() {
      setLoadingAsset(true);
      try {
        const res = await fetch(
          `/api/asset-analysis?asset=${encodeURIComponent(selectedAsset)}`
        );
        if (res.ok) {
          const data = await res.json();
          setAssetData(data);
        } else {
          setAssetData([]);
        }
      } finally {
        setLoadingAsset(false);
      }
    }
    fetchAssetData();
  }, [selectedAsset]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/")}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-8 w-8" />
                Event Analysis
              </h1>
              <p className="text-lg text-gray-600">
                Analyze market impact of major geopolitical and economic events
              </p>
            </div>
          </div>
        </header>

        {/* Cache Status Summary */}
        <div className="mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="text-sm font-medium text-green-800">
                      {cacheStatus}
                    </div>
                    <div className="text-xs text-green-600">
                      Last updated: {lastUpdated ? lastUpdated : ""}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => router.push("/asset-data")}
                  variant="outline"
                  size="sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Asset Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-6xl mx-auto space-y-6">
          <Tabs defaultValue="single-event" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single-event">
                Single Event Analysis
              </TabsTrigger>
              <TabsTrigger value="multi-event">
                Multi-Event Comparison
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single-event" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Event to Analyze</CardTitle>
                  <CardDescription>
                    Choose from {events.length} historical events including
                    Middle East conflicts, economic crises, and policy changes.
                    Asset data is automatically loaded in the background.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Select onValueChange={handleEventSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event to analyze..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-96">
                          {Object.entries(groupedEvents).map(
                            ([category, categoryEvents]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 bg-gray-50">
                                  {category} ({categoryEvents.length})
                                </div>
                                {categoryEvents
                                  .sort(
                                    (a, b) =>
                                      new Date(b.date).getTime() -
                                      new Date(a.date).getTime()
                                  )
                                  .map((event) => (
                                    <SelectItem key={event.id} value={event.id}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {event.name}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                          {new Date(
                                            event.date
                                          ).toLocaleDateString()}{" "}
                                          • {event.category}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                              </div>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <Dialog
                      open={showAddDialog}
                      onOpenChange={setShowAddDialog}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Event
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Custom Event</DialogTitle>
                          <DialogDescription>
                            Add a new event to analyze its market impact
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="event-name">Event Name</Label>
                            <Input
                              id="event-name"
                              value={newEvent.name}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  name: e.target.value,
                                })
                              }
                              placeholder="e.g., Fed Rate Decision"
                            />
                          </div>
                          <div>
                            <Label htmlFor="event-date">Event Date</Label>
                            <Input
                              id="event-date"
                              type="date"
                              value={newEvent.date}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  date: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor="event-category">Category</Label>
                            <Select
                              onValueChange={(value) =>
                                setNewEvent({ ...newEvent, category: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fed">Fed Policy</SelectItem>
                                <SelectItem value="Geopolitical">
                                  Geopolitical
                                </SelectItem>
                                <SelectItem value="Economic">
                                  Economic Data
                                </SelectItem>
                                <SelectItem value="Banking">Banking</SelectItem>
                                <SelectItem value="Pandemic">
                                  Pandemic
                                </SelectItem>
                                <SelectItem value="Financial Crisis">
                                  Financial Crisis
                                </SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="event-description">
                              Description
                            </Label>
                            <Input
                              id="event-description"
                              value={newEvent.description}
                              onChange={(e) =>
                                setNewEvent({
                                  ...newEvent,
                                  description: e.target.value,
                                })
                              }
                              placeholder="Brief description of the event"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setShowAddDialog(false)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleAddEvent}>Add Event</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {selectedEvent && (
                    <div className="p-4 bg-blue-50 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <h3 className="font-semibold text-blue-900">
                            {selectedEvent.name}
                          </h3>
                          <p className="text-sm text-blue-700">
                            {new Date(selectedEvent.date).toLocaleDateString()}{" "}
                            • {selectedEvent.category}
                          </p>
                          {selectedEvent.description && (
                            <p className="text-sm text-blue-600 mt-1">
                              {selectedEvent.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedEvent && <EventChart event={selectedEvent} />}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="multi-event" className="space-y-6">
              <MultiEventChart events={events} />
            </TabsContent>
          </Tabs>
        </div>
        <Toaster />
      </div>
    </div>
  );
}
