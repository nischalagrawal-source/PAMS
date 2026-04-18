import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import pkg from "../../../../package.json";

// Allow health checks to run without authentication
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    // Test database connectivity with 5s timeout
    const dbPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database check timeout")), 5000)
    );

    await Promise.race([dbPromise, timeoutPromise]);

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        version: pkg.version,
        buildTime: new Date().toISOString(),
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health error";

    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        version: pkg.version,
        buildTime: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: message,
      },
      { status: 503 }
    );
  }
}
