import { NextResponse } from "next/server";
import { APP_VERSION, BUILD_TIME, VERSION_NOTES } from "@/lib/version";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      version: APP_VERSION,
      buildTime: BUILD_TIME,
      notes: VERSION_NOTES,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
