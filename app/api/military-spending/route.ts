import { type NextRequest, NextResponse } from "next/server"

interface MilitaryAidData {
  year: number;
  fms: number;
  fma: number;
  imet: number;
  total: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "Israel";

  // Return mock data since military_aid_data table doesn't exist in the database
  const mockData: MilitaryAidData[] = [
    { year: 2015, fms: 3.1, fma: 0, imet: 0.1, total: 3.2 },
    { year: 2016, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
    { year: 2017, fms: 3.1, fma: 0, imet: 0.1, total: 3.2 },
    { year: 2018, fms: 3.3, fma: 0, imet: 0.1, total: 3.4 },
    { year: 2019, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
    { year: 2020, fms: 3.3, fma: 0, imet: 0.1, total: 3.4 },
    { year: 2021, fms: 3.3, fma: 0, imet: 0.1, total: 3.4 },
    { year: 2022, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
    { year: 2023, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
    { year: 2024, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
    { year: 2025, fms: 3.8, fma: 0, imet: 0.1, total: 3.9 },
  ];

  // Add 2024 supplemental aid
  const supplemental2024 = { year: 2024, fms: 17.0, fma: 0, imet: 0, total: 17.0 };

  return NextResponse.json({
    data: mockData,
    supplemental: supplemental2024,
    country: country,
  });
} 