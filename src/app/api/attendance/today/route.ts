import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const userId = session.user.id;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's attendance record with relations
    const attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
      include: {
        geoFence: {
          select: { id: true, label: true, type: true, latitude: true, longitude: true, radiusM: true },
        },
        geoExitLogs: {
          orderBy: { exitTime: "desc" },
        },
      },
    });

    return successResponse(attendance);
  } catch (err) {
    console.error("[ATTENDANCE-TODAY]", err);
    return errorResponse("Failed to fetch today's attendance", 500);
  }
}
