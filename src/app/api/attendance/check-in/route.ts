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
import { WFH_DISTANCE_THRESHOLD } from "@/lib/constants";
import { LocationType, AttendanceStatus } from "@/generated/prisma/client";

const checkInSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
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

    const { latitude, longitude } = parsed.data;
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

    // Fetch active geo-fences
    const geoFences = await prisma.geoFence.findMany({
      where: { companyId: session.user.companyId, isActive: true },
      select: { id: true, latitude: true, longitude: true, radiusM: true, type: true },
    });

    // Determine location type
    const { locationType, nearestFenceId } = determineLocationType(
      latitude, longitude, geoFences, WFH_DISTANCE_THRESHOLD
    );
    const locationTypeEnum: LocationType = LocationType[locationType];
    const status: AttendanceStatus =
      locationType === "OFFICE" || locationType === "CLIENT_SITE"
        ? AttendanceStatus.AUTO_APPROVED
        : AttendanceStatus.PENDING_REVIEW;

    // === LATE ARRIVAL DETECTION ===
    const now = new Date();
    let isLate = false;
    let lateByMinutes = 0;
    let isHalfDay = false;

    if (company) {
      const deadline = parseTimeToToday(company.inTime);
      deadline.setMinutes(deadline.getMinutes() + company.graceMinutes);
      // deadline is now inTime + graceMinutes (e.g., 9:30 + 15 = 9:45)

      if (now > deadline) {
        isLate = true;
        lateByMinutes = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60));

        // Count how many times this user was late this month (before today)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lateCountThisMonth = await prisma.attendance.count({
          where: {
            userId,
            isLate: true,
            date: { gte: startOfMonth, lt: today },
          },
        });

        // Repeating cycle: every (threshold+1)th late arrival is a half day
        // e.g., threshold=3: late #4 = half day, #5-7 normal, #8 = half day, etc.
        // This late will be the (lateCountThisMonth + 1)th late arrival
        const thisLateNumber = lateCountThisMonth + 1;
        const cycleLength = company.lateThreshold + 1; // 3+1 = 4
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
        locationType: locationTypeEnum,
        geoFenceId: nearestFenceId,
        isWfh: locationType === "WORK_FROM_HOME",
        status,
        isLate,
        lateByMinutes,
        isHalfDay,
      },
      include: {
        geoFence: { select: { id: true, label: true, type: true } },
      },
    });

    let message = "Checked in successfully";
    if (isHalfDay) {
      message = `Checked in — marked as HALF DAY (${lateByMinutes} min late, ${company!.lateThreshold}+ late arrivals this month)`;
    } else if (isLate) {
      message = `Checked in — LATE by ${lateByMinutes} minutes`;
    }

    return successResponse(attendance, message);
  } catch (err) {
    console.error("[CHECK-IN]", err);
    return errorResponse("Failed to check in", 500);
  }
}
