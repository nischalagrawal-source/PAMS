import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        status: "healthy",
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown health error";

    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        error: message,
      },
      { status: 503 },
    );
  }
}
