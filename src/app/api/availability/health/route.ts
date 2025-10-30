import { NextResponse } from "next/server";

/**
 * Health check endpoint for availability API
 * Confirms Next.js server and routing is operational
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}
