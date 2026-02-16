import { NextRequest } from "next/server";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";
import { generateDailyReport } from "@/lib/anomaly";

// ── POST  /api/anomalies/detect — Trigger anomaly detection ────────

export async function POST(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_anomalies", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;
    const result = await generateDailyReport(companyId);

    return successResponse(
      {
        summary: result.summary,
        anomalies: result.anomalies,
        reportId: result.reportId,
      },
      "Anomaly detection completed"
    );
  } catch (err) {
    console.error("[ANOMALIES-DETECT]", err);
    return errorResponse("Failed to run anomaly detection", 500);
  }
}
