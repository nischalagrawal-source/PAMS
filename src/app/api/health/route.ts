import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import pkg from "../../../../package.json";

// Allow health checks to run without authentication
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const scope = new URL(req.url).searchParams.get("scope") || "full";
  const basePayload = {
    version: pkg.version,
    buildTime: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  // Lightweight readiness probe for deploy/startup checks.
  if (scope === "app") {
    return NextResponse.json(
      {
        ok: true,
        status: "ready",
        scope,
        latencyMs: Date.now() - startedAt,
        ...basePayload,
      },
      { status: 200 }
    );
  }

  try {
    // Full health probe with database connectivity.
    const dbPromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database check timeout")), 5000)
    );

    await Promise.race([dbPromise, timeoutPromise]);

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        scope,
        latencyMs: Date.now() - startedAt,
        ...basePayload,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health error";

    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        scope,
        latencyMs: Date.now() - startedAt,
        error: message,
        ...basePayload,
      },
      { status: 503 }
    );
  }
}
