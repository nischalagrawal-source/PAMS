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

const updateCompanySettingsSchema = z.object({
  inTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  outTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:mm format"),
  graceMinutes: z.number().min(0).max(120),
  lateThreshold: z.number().min(1).max(30),
  saturdayOffRule: z.enum(["none", "all", "2nd_4th", "2nd", "4th"]).optional(),
  otEnabled: z.boolean().optional(),
  otMonths: z.array(z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM")).optional(),
  dutyHoursPerDay: z.number().min(1).max(24).optional(),
});

interface CompanySettings {
  inTime: string;
  outTime: string;
  graceMinutes: number;
  lateThreshold: number;
  saturdayOffRule: string;
  otEnabled: boolean;
  otMonths: string[];
  dutyHoursPerDay: number;
}

/**
 * GET /api/admin/company-settings
 * Fetch company timing and attendance settings
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        inTime: true,
        outTime: true,
        graceMinutes: true,
        lateThreshold: true,
        saturdayOffRule: true,
        otEnabled: true,
        otMonths: true,
        dutyHoursPerDay: true,
      },
    });

    if (!company) {
      return errorResponse("Company not found", 404);
    }

    const settings: CompanySettings = {
      inTime: company.inTime,
      outTime: company.outTime,
      graceMinutes: company.graceMinutes,
      lateThreshold: company.lateThreshold,
      saturdayOffRule: company.saturdayOffRule,
      otEnabled: company.otEnabled,
      otMonths: company.otMonths,
      dutyHoursPerDay: company.dutyHoursPerDay,
    };

    return successResponse(settings);
  } catch (err) {
    console.error("[GET /api/admin/company-settings]", err);
    return errorResponse("Failed to fetch company settings", 500);
  }
}

/**
 * PUT /api/admin/company-settings
 * Update company timing and attendance settings
 */
export async function PUT(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_company_settings", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = updateCompanySettingsSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0].message;
      return errorResponse(msg);
    }

    const { inTime, outTime, graceMinutes, lateThreshold, saturdayOffRule, otEnabled, otMonths, dutyHoursPerDay } = parsed.data;

    // Validate that outTime is after inTime
    const [inHour, inMin] = inTime.split(":").map(Number);
    const [outHour, outMin] = outTime.split(":").map(Number);
    const inTimeMinutes = inHour * 60 + inMin;
    const outTimeMinutes = outHour * 60 + outMin;

    if (outTimeMinutes <= inTimeMinutes) {
      return errorResponse("Out time must be after in time", 400);
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        inTime,
        outTime,
        graceMinutes,
        lateThreshold,
        ...(saturdayOffRule !== undefined && { saturdayOffRule }),
        ...(otEnabled !== undefined && { otEnabled }),
        ...(otMonths !== undefined && { otMonths }),
        ...(dutyHoursPerDay !== undefined && { dutyHoursPerDay }),
        updatedAt: new Date(),
      },
      select: {
        inTime: true,
        outTime: true,
        graceMinutes: true,
        lateThreshold: true,
        saturdayOffRule: true,
        otEnabled: true,
        otMonths: true,
        dutyHoursPerDay: true,
      },
    });

    const settings: CompanySettings = {
      inTime: updated.inTime,
      outTime: updated.outTime,
      graceMinutes: updated.graceMinutes,
      lateThreshold: updated.lateThreshold,
      saturdayOffRule: updated.saturdayOffRule,
      otEnabled: updated.otEnabled,
      otMonths: updated.otMonths,
      dutyHoursPerDay: updated.dutyHoursPerDay,
    };

    return successResponse(settings);
  } catch (err) {
    console.error("[PUT /api/admin/company-settings]", err);
    return errorResponse("Failed to update company settings", 500);
  }
}
