import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
  checkPermission,
} from "@/lib/api-utils";
import { SelfieVerifyStatus } from "@/generated/prisma/client";

const verifySchema = z.object({
  attendanceId: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

/**
 * POST /api/attendance/verify-selfie
 * Admin endpoint to approve or reject a selfie verification.
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "attendance", "canApprove")) {
      return errorResponse("You don't have permission to verify selfies", 403);
    }

    const body = await parseBody<z.infer<typeof verifySchema>>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

    const { attendanceId, action, notes } = parsed.data;

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, selfieVerifyStatus: true, userId: true, user: { select: { companyId: true } } },
    });

    if (!attendance) return errorResponse("Attendance record not found", 404);

    // Ensure admin is from same company
    if (session.user.role !== "SUPER_ADMIN" && attendance.user.companyId !== session.user.companyId) {
      return errorResponse("Not authorized", 403);
    }

    const newStatus = action === "approve"
      ? SelfieVerifyStatus.ADMIN_APPROVED
      : SelfieVerifyStatus.ADMIN_REJECTED;

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        selfieVerifyStatus: newStatus,
        selfieReviewedById: session.user.id,
        selfieReviewedAt: new Date(),
        ...(action === "reject" ? {
          status: "FLAGGED",
          isSuspiciousLocation: true,
          suspiciousReason: `Selfie rejected by admin${notes ? `: ${notes}` : ""}`,
        } : {}),
      },
    });

    return successResponse(updated, `Selfie ${action === "approve" ? "approved" : "rejected"} successfully`);
  } catch (err) {
    console.error("[VERIFY-SELFIE]", err);
    return errorResponse("Failed to verify selfie", 500);
  }
}

/**
 * GET /api/attendance/verify-selfie?status=MANUAL_REVIEW&page=1&limit=20
 * List attendance records pending selfie review (admin only).
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "attendance", "canApprove")) {
      return errorResponse("Not authorized", 403);
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "MANUAL_REVIEW";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const where = {
      selfieVerifyStatus: status as SelfieVerifyStatus,
      ...(session.user.role !== "SUPER_ADMIN" ? { user: { companyId: session.user.companyId } } : {}),
    };

    const [records, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, employeeCode: true, profilePhoto: true } },
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return successResponse({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[VERIFY-SELFIE-LIST]", err);
    return errorResponse("Failed to fetch selfie review list", 500);
  }
}
