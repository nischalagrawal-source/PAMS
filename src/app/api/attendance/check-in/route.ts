import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { determineLocationType } from "@/lib/geo";
import { WFH_DISTANCE_THRESHOLD, MAX_GPS_ACCURACY_M } from "@/lib/constants";
import { LocationType, AttendanceStatus } from "@/generated/prisma/client";

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
});

/**
 * Parse a "HH:mm" time string into { hours, minutes } for today's date
 */
function parseTimeToToday(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const body = await parseBody<z.infer<typeof checkInSchema>>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

    const { latitude, longitude, accuracy } = parsed.data;
    const userId = session.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if already checked in today
    const existing = await prisma.attendance.findFirst({
      where: { userId, date: { gte: today, lt: tomorrow } },
    });
    if (existing) return errorResponse("Already checked in today");

    // Fetch company settings (inTime, graceMinutes, lateThreshold)
    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      select: { inTime: true, graceMinutes: true, lateThreshold: true },
    });

    // Check if today is a holiday
    const holiday = await prisma.holiday.findUnique({
      where: { companyId_date: { companyId: session.user.companyId, date: today } },
    });
    if (holiday && !holiday.isOptional) {
      return errorResponse(`Today is a holiday: ${holiday.name}. Check-in not required.`, 400);
    }

    // Fetch user's shift override (per-user in/out timing)
    const userShift = await prisma.userShift.findUnique({
      where: { userId },
      select: { inTime: true, outTime: true, graceMinutes: true },
    });

    // Resolve effective timing: user shift overrides company defaults
    const effectiveInTime = userShift?.inTime ?? company?.inTime ?? "09:30";
    const effectiveGraceMinutes = userShift?.graceMinutes ?? company?.graceMinutes ?? 15;
    const effectiveLateThreshold = company?.lateThreshold ?? 3;

    // Fetch user's attendance restrictions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        workMode: true,
        assignedGeoFenceId: true,
      },
    });
    if (!user) return errorResponse("User not found", 404);

    // Fetch active geo-fences
    const geoFences = await prisma.geoFence.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      select: { id: true, latitude: true, longitude: true, radiusM: true, type: true },
    });

    // Determine location type
    const { locationType, nearestFenceId } = determineLocationType(
      latitude, longitude, geoFences, WFH_DISTANCE_THRESHOLD
    );

    // Enforce strict geofence assignment if assigned by admin
    if (user.assignedGeoFenceId) {
      if (nearestFenceId !== user.assignedGeoFenceId || !["OFFICE", "CLIENT_SITE"].includes(locationType)) {
        return errorResponse("Check-in denied: you are not at your assigned work location", 403);
      }
    } else {
      // Fallback enforcement by work mode
      if (user.workMode === "office" && locationType !== "OFFICE") {
        return errorResponse("Check-in denied: office staff must check in from office geo-fence", 403);
      }
      if (user.workMode === "client" && locationType !== "CLIENT_SITE") {
        return errorResponse("Check-in denied: client staff must check in from assigned client-site geo-fence", 403);
      }
      if (user.workMode === "hybrid" && !["OFFICE", "CLIENT_SITE"].includes(locationType)) {
        return errorResponse("Check-in denied: hybrid staff must check in from office/client geo-fence", 403);
      }
    }

    const locationTypeEnum: LocationType = LocationType[locationType];
    let status: AttendanceStatus =
      locationType === "OFFICE" || locationType === "CLIENT_SITE"
        ? AttendanceStatus.AUTO_APPROVED
        : AttendanceStatus.PENDING_REVIEW;

    let isSuspiciousLocation = false;
    let suspiciousReason: string | null = null;
    if (accuracy !== undefined && accuracy > MAX_GPS_ACCURACY_M) {
      isSuspiciousLocation = true;
      suspiciousReason = `Low GPS precision (${Math.round(accuracy)}m > ${MAX_GPS_ACCURACY_M}m threshold)`;
      status = AttendanceStatus.FLAGGED;
    }

    // === LATE ARRIVAL DETECTION ===
    const now = new Date();
    let isLate = false;
    let lateByMinutes = 0;
    let isHalfDay = false;

    {
      const deadline = parseTimeToToday(effectiveInTime);
      deadline.setMinutes(deadline.getMinutes() + effectiveGraceMinutes);

      if (now > deadline) {
        isLate = true;
        lateByMinutes = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60));

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lateCountThisMonth = await prisma.attendance.count({
          where: {
            userId,
            isLate: true,
            date: { gte: startOfMonth, lt: today },
          },
        });

        const thisLateNumber = lateCountThisMonth + 1;
        const cycleLength = effectiveLateThreshold + 1;
        if (thisLateNumber % cycleLength === 0) {
          isHalfDay = true;
        }
      }
    }

    // Create attendance record
    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: today,
        checkInTime: now,
        checkInLat: latitude,
        checkInLng: longitude,
        checkInAccuracyM: accuracy,
        locationType: locationTypeEnum,
        geoFenceId: nearestFenceId,
        isWfh: locationType === "WORK_FROM_HOME",
        status,
        isSuspiciousLocation,
        suspiciousReason,
        isLate,
        lateByMinutes,
        isHalfDay,
      },
      include: {
        geoFence: { select: { id: true, label: true, type: true } },
      },
    });

    let message = isSuspiciousLocation
      ? `Checked in with warning: ${suspiciousReason}`
      : "Checked in successfully";
    if (isHalfDay) {
      message = `Checked in — marked as HALF DAY (${lateByMinutes} min late, ${effectiveLateThreshold}+ late arrivals this month)`;
    } else if (isLate) {
      message = `Checked in — LATE by ${lateByMinutes} minutes`;
    }

    return successResponse(attendance, message);
  } catch (err) {
    console.error("[CHECK-IN]", err);
    return errorResponse("Failed to check in", 500);
  }
}
