import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────

const generateOfferSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  templateId: z.string().min(1).optional(),
  offerData: z.object({
    annualCtc: z.number().min(0).optional(),
    monthlyGross: z.number().min(0).optional(),
    probationPeriodMonths: z.number().int().min(0).optional(),
    securityDeposit: z.number().min(0).optional(),
    joiningDate: z.string().optional(),
    issueDate: z.string().optional(),
    jobLocation: z.string().optional(),
    reportingManager: z.string().optional(),
    panNumber: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    ifscCode: z.string().optional(),
    specialTerms: z.string().optional(),
  }).optional(),
});

function formatMoney(amount?: number) {
  if (amount === undefined || amount === null) return "N/A";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateInput?: string | Date | null) {
  if (!dateInput) return "N/A";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getDefaultOfferTemplate() {
  return `
<h2>Offer of Employment</h2>
<p>Date: {{issueDate}}</p>
<p>To,<br/>{{employeeName}}</p>

<p>Dear {{firstName}},</p>

<p>
We are pleased to offer you the position of <strong>{{designation}}</strong> in
<strong>{{department}}</strong> at <strong>{{companyName}}</strong>.
</p>

<p>
Your date of joining will be <strong>{{joiningDate}}</strong> and your place of
work will be <strong>{{jobLocation}}</strong>. You will report to
<strong>{{reportingManager}}</strong>.
</p>

<p>
Your compensation details are as follows:
</p>
<ul>
  <li>Annual CTC: {{annualCtc}}</li>
  <li>Monthly Gross Salary: {{monthlyGross}}</li>
  <li>Probation Period: {{probationPeriodMonths}} months</li>
  <li>Security Deposit: {{securityDeposit}}</li>
</ul>

<p>
For payroll compliance, your details are recorded as:
</p>
<ul>
  <li>PAN: {{panNumber}}</li>
  <li>Bank Name: {{bankName}}</li>
  <li>Account Number: {{bankAccountNumber}}</li>
  <li>IFSC: {{ifscCode}}</li>
</ul>

<p>
Additional Terms:<br/>
{{specialTerms}}
</p>

<p>
Please sign and return a copy of this letter as a token of your acceptance.
</p>

<p>
For {{companyName}}<br/>
Authorized Signatory
</p>
`;
}

// ── POST /api/salary/offer-letters/generate ───────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can generate offer letters", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = generateOfferSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { userId, templateId, offerData } = parsed.data;
    const companyId = session.user.companyId;

    // Fetch template if provided, otherwise use latest active template.
    let template = await prisma.offerLetterTemplate.findFirst({
      where: templateId ? { id: templateId, companyId } : { companyId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!template) {
      template = await prisma.offerLetterTemplate.create({
        data: {
          companyId,
          name: "Default Offer Letter",
          content: getDefaultOfferTemplate(),
          isActive: true,
        },
      });
    }

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        company: { select: { name: true } },
      },
    });

    if (!user) {
      return errorResponse("User not found in your company", 404);
    }

    // Replace placeholders in template content
    const now = new Date();
    const sourceTemplate = template?.content || getDefaultOfferTemplate();
    const joiningDate = offerData?.joiningDate
      ? formatDate(offerData.joiningDate)
      : formatDate(user.dateOfJoining);

    const replacements: Record<string, string> = {
      firstName: user.firstName,
      lastName: user.lastName,
      employeeName: `${user.firstName} ${user.lastName}`,
      designation: user.designation || "N/A",
      department: user.department || "N/A",
      dateOfJoining: formatDate(user.dateOfJoining),
      joiningDate,
      companyName: user.company.name,
      date: formatDate(now),
      issueDate: offerData?.issueDate ? formatDate(offerData.issueDate) : formatDate(now),
      annualCtc: formatMoney(offerData?.annualCtc),
      monthlyGross: formatMoney(offerData?.monthlyGross),
      probationPeriodMonths: (offerData?.probationPeriodMonths ?? "N/A").toString(),
      securityDeposit: formatMoney(offerData?.securityDeposit),
      panNumber: offerData?.panNumber || "N/A",
      bankName: offerData?.bankName || "N/A",
      bankAccountNumber: offerData?.bankAccountNumber || "N/A",
      ifscCode: offerData?.ifscCode || "N/A",
      jobLocation: offerData?.jobLocation || "N/A",
      reportingManager: offerData?.reportingManager || "N/A",
      specialTerms: offerData?.specialTerms || "As per company policy.",
    };

    const renderedContent = sourceTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, token) => {
      return replacements[token] ?? full;
    });

    // Create offer letter record
    const offerLetter = await prisma.offerLetter.create({
      data: {
        userId,
        templateId: template.id,
        content: renderedContent,
        generatedAt: now,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
      },
    });

    return successResponse(offerLetter, "Offer letter generated successfully");
  } catch (err) {
    console.error("[POST /api/salary/offer-letters/generate]", err);
    return errorResponse("Failed to generate offer letter", 500);
  }
}
