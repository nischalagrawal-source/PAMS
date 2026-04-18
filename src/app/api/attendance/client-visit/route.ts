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
  determineLocationType,
  estimateTravelMetrics,
  isTravelReasonable,
} from "@/lib/geo";
import { AttendanceStatus } from "@/generated/prisma/client";
import { notifyAttendanceAnomaly, sendNotification } from "@/lib/notifications";

const clientVisitSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  notes: z.string().max(250).optional(),
});

type ClientVisitEntry = {
  timestamp: string;
  fenceId: string;
  fenceLabel: string;
  latitude: number;
  longitude: number;
  travelDistanceKm: number | null;
  estimatedTravelMinutes: number | null;
  actualTravelMinutes: number | null;
  isReasonable: boolean;
  source: "initial" | "google" | "fallback";
  notes?: string | null;
};

const VISIT_PREFIX = "[CLIENT_VISIT] ";

function parseClientVisitEntries(notes: string | null | undefined): ClientVisitEntry[] {
  if (!notes) return [];

  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(VISIT_PREFIX))
    .map((line) => line.slice(VISIT_PREFIX.length))
    .flatMap((raw) => {
      try {
        return [JSON.parse(raw) as ClientVisitEntry];
      } catch {
        return [];
      }
    });
}

function appendClientVisitEntry(existingNotes: string | null | undefined, entry: ClientVisitEntry) {
  const lines = existingNotes ? existingNotes.split("\n").filter(Boolean) : [];
  lines.push(`${VISIT_PREFIX}${JSON.stringify(entry)}`);
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const body = await parseBody<z.infer<typeof clientVisitSchema>>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = clientVisitSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0].message);

    const { latitude, longitude, notes } = parsed.data;
    const userId = session.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    if (!attendance) {
      return errorResponse("No active attendance session found for today", 404);
    }

    if (!["client", "hybrid"].includes(attendance.user.workMode)) {
      return errorResponse("Client visit check-ins are only allowed for client or hybrid staff", 403);
    }

    const clientFences = await prisma.geoFence.findMany({
      where: {
        companyId: session.user.companyId,
        isActive: true,
        type: "client_site",
      },
      select: {
        id: true,
        label: true,
        latitude: true,
        longitude: true,
        radiusM: true,
        type: true,
      },
    });

    if (clientFences.length === 0) {
      return errorResponse("No client locations are configured yet", 400);
    }

    const { locationType, nearestFenceId } = determineLocationType(latitude, longitude, clientFences, 1000);
    if (locationType !== "CLIENT_SITE" || !nearestFenceId) {
      return errorResponse("Client visit check-in must be done from a configured client location", 403);
    }

    const currentFence = clientFences.find((fence) => fence.id === nearestFenceId);
    if (!currentFence) {
      return errorResponse("Unable to resolve the current client site", 404);
    }

    const visits = parseClientVisitEntries(attendance.notes);
    const lastVisit = visits.at(-1);
    const now = new Date();

    if (lastVisit?.fenceId === currentFence.id) {
      const minutesSinceLastCheckIn = Math.round((now.getTime() - new Date(lastVisit.timestamp).getTime()) / (1000 * 60));
      if (minutesSinceLastCheckIn < 15) {
        return errorResponse(`Client visit already recorded at ${currentFence.label} recently`, 409);
      }
    }

    const originLat = lastVisit?.latitude ?? attendance.checkInLat ?? latitude;
    const originLng = lastVisit?.longitude ?? attendance.checkInLng ?? longitude;
    const originTime = lastVisit?.timestamp
      ? new Date(lastVisit.timestamp)
      : attendance.checkInTime ?? now;

    let travelDistanceKm: number | null = null;
    let estimatedTravelMinutes: number | null = null;
    let actualTravelMinutes: number | null = null;
    let isReasonable = true;
    let source: ClientVisitEntry["source"] = "initial";

    if (originLat !== null && originLng !== null) {
      const travelMetrics = await estimateTravelMetrics(
        { latitude: originLat, longitude: originLng },
        { latitude, longitude }
      );

      travelDistanceKm = travelMetrics.distanceKm;
      estimatedTravelMinutes = travelMetrics.durationMinutes;
      actualTravelMinutes = Math.max(0, Math.round((now.getTime() - originTime.getTime()) / (1000 * 60)));
      isReasonable = isTravelReasonable(actualTravelMinutes, estimatedTravelMinutes, travelDistanceKm);
      source = travelMetrics.source;
    }

    const entry: ClientVisitEntry = {
      timestamp: now.toISOString(),
      fenceId: currentFence.id,
      fenceLabel: currentFence.label,
      latitude,
      longitude,
      travelDistanceKm,
      estimatedTravelMinutes,
      actualTravelMinutes,
      isReasonable,
      source,
      notes: notes ?? null,
    };

    const updatedNotes = appendClientVisitEntry(attendance.notes, entry);

    let suspiciousReason = attendance.suspiciousReason;
    if (!isReasonable && actualTravelMinutes !== null && estimatedTravelMinutes !== null) {
      const travelReason = `Client travel from previous point took ${actualTravelMinutes}min for an estimated ${estimatedTravelMinutes}min route to ${currentFence.label}`;
      suspiciousReason = suspiciousReason ? `${suspiciousReason}; ${travelReason}` : travelReason;
    }

    await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        notes: updatedNotes,
        ...(isReasonable
          ? {}
          : {
              status: AttendanceStatus.FLAGGED,
              isSuspiciousLocation: true,
              suspiciousReason,
            }),
      },
    });

    if (!isReasonable && actualTravelMinutes !== null && estimatedTravelMinutes !== null) {
      const detailMessage = `${attendance.user.firstName} ${attendance.user.lastName} (${attendance.user.employeeCode}) reached ${currentFence.label}, but the recorded travel time was ${actualTravelMinutes}min versus an estimated ${estimatedTravelMinutes}min.`;

      try {
        await notifyAttendanceAnomaly(userId, "Client travel review", detailMessage);

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

        await Promise.all(
          managers.map((manager) =>
            sendNotification({
              userId: manager.id,
              channel: "EMAIL",
              type: "client_travel_review",
              subject: "Client travel needs review",
              message: detailMessage,
              metadata: {
                attendanceId: attendance.id,
                clientSite: currentFence.label,
                actualTravelMinutes,
                estimatedTravelMinutes,
              },
            })
          )
        );
      } catch (notificationError) {
        console.error("[CLIENT-VISIT][NOTIFY]", notificationError);
      }
    }

    const visitCount = visits.length + 1;
    const message = isReasonable
      ? `Client visit ${visitCount} recorded at ${currentFence.label}`
      : `Client visit ${visitCount} recorded at ${currentFence.label}, but travel time has been flagged for review`;

    return successResponse(
      {
        visitCount,
        currentSite: currentFence.label,
        travelDistanceKm,
        estimatedTravelMinutes,
        actualTravelMinutes,
        isReasonable,
        reviewRequired: !isReasonable,
        source,
      },
      message
    );
  } catch (err) {
    console.error("[CLIENT-VISIT]", err);
    return errorResponse("Failed to record client visit check-in", 500);
  }
}
