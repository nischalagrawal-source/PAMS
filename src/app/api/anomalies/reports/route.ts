import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

// ── GET  /api/anomalies/reports — List anomaly reports ─────────────

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    const where: Record<string, unknown> = { companyId };

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        dateFilter.lt = toDate;
      }
      where.date = dateFilter;
    }

    const [records, total] = await Promise.all([
      prisma.anomalyReport.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.anomalyReport.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return successResponse({ records, total, page, limit, totalPages });
  } catch (err) {
    console.error("[ANOMALY-REPORTS-LIST]", err);
    return errorResponse("Failed to fetch anomaly reports", 500);
  }
}
