import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { haversineDistance } from "@/lib/geo";
import { notifyGeoFenceBreach } from "@/lib/notifications";

const locationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const body = await parseBody<z.infer<typeof locationPingSchema>>(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = locationPingSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { latitude, longitude } = parsed.data;
    const userId = session.user.id;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's active attendance (checked in, not checked out)
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
        checkInTime: { not: null },
        checkOutTime: null,
      },
      include: {
        geoFence: true,
      },
    });

    if (!attendance) {
      return errorResponse("No active check-in found for today");
    }

    // If no geo-fence associated with check-in, can't track exits
    if (!attendance.geoFence) {
      return successResponse({
        insideFence: false,
        distanceFromFence: null,
        geoExitCount: attendance.geoExitCount,
      });
    }

    const fence = attendance.geoFence;

    // Calculate distance from the geo-fence center and actual distance beyond the allowed radius.
    const distanceFromCenter = haversineDistance(
      latitude,
      longitude,
      fence.latitude,
      fence.longitude
    );

    const insideFence = distanceFromCenter <= fence.radiusM;
    const distanceFromFence = Math.max(0, distanceFromCenter - fence.radiusM);

    const activeExit = await prisma.geoExitLog.findFirst({
      where: {
        attendanceId: attendance.id,
        returnTime: null,
      },
      orderBy: { exitTime: "desc" },
    });

    let geoExitCount = attendance.geoExitCount;
    let alertTriggered = false;
    let message: string | null = null;

    if (!insideFence) {
      if (!activeExit) {
        geoExitCount += 1;

        await prisma.$transaction([
          prisma.geoExitLog.create({
            data: {
              attendanceId: attendance.id,
              userId,
              exitTime: new Date(),
              exitLat: latitude,
              exitLng: longitude,
              distanceFromFence,
            },
          }),
          prisma.attendance.update({
            where: { id: attendance.id },
            data: {
              geoExitCount: { increment: 1 },
              status: "FLAGGED",
              suspiciousReason: `Outside allowed work zone by ${Math.round(distanceFromFence)}m`,
            },
          }),
        ]);

        const managers = await prisma.user.findMany({
          where: {
            companyId: session.user.companyId,
            isActive: true,
            id: { not: userId },
            role: { in: ["ADMIN", "BRANCH_ADMIN", "REVIEWER"] },
            ...(session.user.branchId
              ? {
                  OR: [
                    { role: "ADMIN" },
                    { branchId: session.user.branchId },
                  ],
                }
              : {}),
          },
          select: { id: true },
        });

        try {
          await notifyGeoFenceBreach({
            userId,
            managerIds: managers.map((manager) => manager.id),
            fenceLabel: fence.label,
            distanceFromFence,
          });
        } catch (notificationError) {
          console.error("[LOCATION-PING][NOTIFY]", notificationError);
        }

        alertTriggered = true;
        message = `You are outside ${fence.label}. A geo-alert has been sent.`;
      } else {
        message = `You are still outside ${fence.label}. Please return to the approved area.`;
      }
    } else if (activeExit) {
      await prisma.geoExitLog.update({
        where: { id: activeExit.id },
        data: { returnTime: new Date() },
      });

      message = `You are back inside ${fence.label}.`;
    }

    return successResponse({
      insideFence,
      distanceFromFence: Math.round(distanceFromFence * 100) / 100,
      geoExitCount,
      alertTriggered,
      message,
    });
  } catch (err) {
    console.error("[LOCATION-PING]", err);
    return errorResponse("Failed to process location ping", 500);
  }
}
