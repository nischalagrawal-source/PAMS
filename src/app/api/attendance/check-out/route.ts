import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { STANDARD_WORK_HOURS } from "@/lib/constants";

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
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

    const { latitude, longitude } = parsed.data;
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
    });

    if (!attendance) {
      return errorResponse("No active check-in found");
    }

    // Calculate total hours worked
    const now = new Date();
    const checkInTime = attendance.checkInTime!;
    const totalHours =
      (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    const overtimeHours = Math.max(0, totalHours - STANDARD_WORK_HOURS);

    // Update attendance record
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOutTime: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
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
