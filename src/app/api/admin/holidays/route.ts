import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  isOptional: z.boolean().default(false),
});

/**
 * GET /api/admin/holidays
 * List all holidays for the company, optionally filtered by year
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const year = req.nextUrl.searchParams.get("year");

    const where: Record<string, unknown> = { companyId };
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      where.date = { gte: startDate, lte: endDate };
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return successResponse(holidays);
  } catch (err) {
    console.error("[GET /api/admin/holidays]", err);
    return errorResponse("Failed to fetch holidays", 500);
  }
}

/**
 * POST /api/admin/holidays
 * Create a new holiday
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = createHolidaySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { name, date, isOptional } = parsed.data;
    const holidayDate = new Date(date);

    const existing = await prisma.holiday.findUnique({
      where: { companyId_date: { companyId, date: holidayDate } },
    });

    if (existing) {
      return errorResponse("A holiday already exists on this date", 400);
    }

    const holiday = await prisma.holiday.create({
      data: { companyId, name, date: holidayDate, isOptional },
    });

    return successResponse(holiday);
  } catch (err) {
    console.error("[POST /api/admin/holidays]", err);
    return errorResponse("Failed to create holiday", 500);
  }
}
