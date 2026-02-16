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

    // Calculate distance from the check-in geo-fence
    const distanceFromFence = haversineDistance(
      latitude,
      longitude,
      fence.latitude,
      fence.longitude
    );

    const insideFence = distanceFromFence <= fence.radiusM;

    // If outside the fence, log the exit event
    if (!insideFence) {
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
          },
        }),
      ]);
    }

    return successResponse({
      insideFence,
      distanceFromFence: Math.round(distanceFromFence * 100) / 100,
      geoExitCount: insideFence
        ? attendance.geoExitCount
        : attendance.geoExitCount + 1,
    });
  } catch (err) {
    console.error("[LOCATION-PING]", err);
    return errorResponse("Failed to process location ping", 500);
  }
}
