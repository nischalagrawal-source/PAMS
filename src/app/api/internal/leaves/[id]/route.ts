import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

const STATUS_MAP: Record<string, "APPROVED" | "REJECTED" | "CANCELLED"> = {
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Cancelled: "CANCELLED",
};

// PUT /api/internal/leaves/[id] — approve, reject, or cancel a leave request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const newStatus = STATUS_MAP[body.status];

  if (!newStatus) {
    return NextResponse.json(
      { error: "status must be Approved, Rejected, or Cancelled" },
      { status: 400 }
    );
  }

  try {
  await prisma.leaveRequest.update({
    where: { id },
    data: { status: newStatus },
  });

  return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
