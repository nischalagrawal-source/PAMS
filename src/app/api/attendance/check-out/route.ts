import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import {
  STANDARD_WORK_HOURS,
  MAX_GPS_ACCURACY_M,
  CHECKOUT_FENCE_BUFFER_M,
} from "@/lib/constants";
import { haversineDistance } from "@/lib/geo";
import { AttendanceStatus } from "@/generated/prisma/client";

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const body = await parseBody<z.infer<typeof checkOutSchema>>(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = checkOutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { latitude, longitude, accuracy } = parsed.data;
    const userId = session.user.id;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's active check-in (checked in but not checked out)
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
        checkInTime: { not: null },
        checkOutTime: null,
      },
      include: {
        user: {
          select: {
            workMode: true,
          },
        },
        geoFence: {
          select: {
            id: true,
            label: true,
            latitude: true,
            longitude: true,
            radiusM: true,
          },
        },
      },
    });

    if (!attendance) {
      return errorResponse("No active check-in found");
    }

    // Enforce check-out near check-in geofence
    let outsideFenceFlagReason: string | null = null;

    if (attendance.geoFence) {
      const distance = haversineDistance(
        latitude,
        longitude,
        attendance.geoFence.latitude,
        attendance.geoFence.longitude
      );
      const allowedDistance = attendance.geoFence.radiusM + CHECKOUT_FENCE_BUFFER_M;
      if (distance > allowedDistance) {
        const outsideReason = `Checkout outside assigned fence (${Math.round(distance)}m from center, allowed ${allowedDistance}m)`;

        // Client and hybrid users may move after approved client visits; allow checkout but flag for review.
        if (["client", "hybrid"].includes(attendance.user.workMode)) {
          outsideFenceFlagReason = outsideReason;
        } else {
          await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              status: AttendanceStatus.FLAGGED,
              isSuspiciousLocation: true,
              suspiciousReason: outsideReason,
            },
          });
          return errorResponse("Check-out denied: you are outside your allowed geo-fence range", 403);
        }
      }
    }

    // Calculate total hours worked
    const now = new Date();
    const checkInTime = attendance.checkInTime!;
    const totalHours =
      (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    const overtimeHours = Math.max(0, totalHours - STANDARD_WORK_HOURS);

    // OT pay calculation
    let otEligible = false;
    let otRatePerHour: number | null = null;
    let otAmount: number | null = null;

    if (overtimeHours > 0) {
      const company = await prisma.company.findUnique({
        where: { id: session.user.companyId },
        select: { otEnabled: true, otMonths: true, dutyHoursPerDay: true },
      });

      if (company?.otEnabled) {
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (company.otMonths.includes(monthStr)) {
          otEligible = true;

          const salary = await prisma.salaryStructure.findUnique({
            where: { userId },
            select: { netSalary: true },
          });

          if (salary) {
            // Working days in this month (Mon–Sat, excluding Sundays)
            const year = now.getFullYear();
            const month = now.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            let workingDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
              const day = new Date(year, month, d).getDay();
              if (day !== 0) workingDays++; // exclude Sundays
            }

            const dutyHours = company.dutyHoursPerDay || STANDARD_WORK_HOURS;
            otRatePerHour = Math.round((salary.netSalary / (workingDays * dutyHours)) * 100) / 100;
            otAmount = Math.round(overtimeHours * otRatePerHour * 100) / 100;
          }
        }
      }
    }

    const lowAccuracy = accuracy !== undefined && accuracy > MAX_GPS_ACCURACY_M;
    const suspiciousReasons: string[] = [];
    if (outsideFenceFlagReason) suspiciousReasons.push(outsideFenceFlagReason);
    if (lowAccuracy) suspiciousReasons.push(`Low checkout GPS precision (${Math.round(accuracy!)}m > ${MAX_GPS_ACCURACY_M}m threshold)`);

    // Update attendance record
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
        checkOutAccuracyM: accuracy,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        otEligible,
        otRatePerHour,
        otAmount,
        ...(suspiciousReasons.length > 0
          ? {
              status: AttendanceStatus.FLAGGED,
              isSuspiciousLocation: true,
              suspiciousReason: suspiciousReasons.join("; "),
            }
          : {}),
      },
      include: {
        geoFence: {
          select: { id: true, label: true, type: true },
        },
      },
    });

    return successResponse(updated, "Checked out successfully");
  } catch (err) {
    console.error("[CHECK-OUT]", err);
    return errorResponse("Failed to check out", 500);
  }
}
