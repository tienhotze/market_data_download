import { NextResponse } from "next/server";
import { DEFAULT_EVENTS } from "@/app/event-analysis/default-events.js";

export async function GET() {
  try {
    // Sort events by date in descending order (most recent first)
    const sortedEvents = [...DEFAULT_EVENTS].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return NextResponse.json(sortedEvents);
  } catch (error) {
    console.error("Error loading default events:", error);
    return NextResponse.json(
      { error: "Failed to load default events" },
      { status: 500 }
    );
  }
}