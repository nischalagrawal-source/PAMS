import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

const auditAssistantTemplateName = "Standard Offer Letter - Audit Assistant";
const associateTemplateName = "Standard Offer Letter - Associate";

const auditAssistantTemplateContent = `
<h2>OFFER LETTER</h2>
<p>Date: {{issueDate}}</p>
<p>To,<br/>{{employeeName}}</p>
<p>Dear {{firstName}},</p>

<p>
We are pleased to extend to you an offer for the position of <strong>{{positionTitle}}</strong>
with <strong>{{companyName}}</strong>.
</p>

<h3>Position Details</h3>
<ul>
  <li>Position Title: {{positionTitle}}</li>
  <li>Joining Date: {{joiningDate}}</li>
  <li>Job Location: {{jobLocation}}</li>
  <li>Reporting Manager: {{reportingManager}}</li>
</ul>

<h3>Compensation Package</h3>
<ul>
  <li>Monthly Gross Salary: {{monthlyGross}}</li>
  <li>Annual CTC: {{annualCtc}}</li>
  <li>Probation Period: {{probationPeriodMonths}} months</li>
  <li>Security Deposit: {{securityDeposit}} (as per firm policy)</li>
</ul>

<h3>Leave Policy</h3>
<ul>
  <li>Paid Leaves Entitlement: {{leaveEntitlementAnnual}} per annum (proportionate basis)</li>
  <li>Festival Leaves: {{festivalLeavesPerYear}} per year</li>
  <li>Planned leaves via email: {{hrEmail}}</li>
  <li>Emergency leaves via WhatsApp: {{emergencyWhatsapp}}</li>
  <li>Sandwich leave policy applicable</li>
</ul>

<h3>Attendance Policy</h3>
<ul>
  <li>Working Days: {{workingDays}}</li>
  <li>Working Hours: {{workingHours}}</li>
  <li>Late Arrival Policy: {{lateArrivalGraceCount}} grace entries till {{lateArrivalCutoff}}, subsequent late arrival may be treated as half-day</li>
</ul>

<h3>Responsibilities</h3>
<ul>
  {{responsibilitiesList}}
</ul>

<h3>KYC Documentation</h3>
<ul>
  {{kycList}}
</ul>

<p><strong>Conflict of Interest:</strong> {{conflictOfInterestClause}}</p>
<p><strong>Confidentiality:</strong> {{confidentialityClause}}</p>
<p><strong>Legal Recourse:</strong> {{legalRecourseClause}}</p>

<p>
Minimum Commitment: {{minCommitmentUntil}}<br/>
Notice Period: {{noticePeriodMonths}} month(s)
</p>

<p>Additional Terms: {{specialTerms}}</p>

<p>
Please indicate acceptance by signing and returning this letter with required documents.
</p>

<p>
For {{companyName}}<br/>
Authorized Signatory
</p>
`;

const associateTemplateContent = `
<h2>OFFER LETTER</h2>
<p>Date: {{issueDate}}</p>
<p>To,<br/>{{employeeName}}</p>
<p>Dear {{firstName}},</p>

<p>
We are pleased to appoint you as <strong>{{positionTitle}}</strong> at
<strong>{{companyName}}</strong>.
</p>

<h3>Role & Joining</h3>
<ul>
  <li>Role: {{positionTitle}}</li>
  <li>Joining Date: {{joiningDate}}</li>
  <li>Location: {{jobLocation}}</li>
</ul>

<h3>Compensation & Deposit</h3>
<ul>
  <li>Current Salary: {{currentSalary}}</li>
  <li>Revised Salary: {{revisedSalary}} effective from {{revisedSalaryEffectiveFrom}}</li>
  <li>Monthly Gross Salary: {{monthlyGross}}</li>
  <li>Annual CTC: {{annualCtc}}</li>
  <li>Security Deposit: {{securityDeposit}} per month</li>
</ul>

<h3>Attendance & Leave</h3>
<ul>
  <li>Working Days: {{workingDays}}</li>
  <li>Working Hours: {{workingHours}}</li>
  <li>Late Arrival: {{lateArrivalGraceCount}} times till {{lateArrivalCutoff}}</li>
  <li>Paid Leave Entitlement: {{leaveEntitlementAnnual}} annually</li>
  <li>Festival Leaves: {{festivalLeavesPerYear}} annually</li>
</ul>

<h3>Responsibilities</h3>
<ul>
  {{responsibilitiesList}}
</ul>

<h3>Compliance Clauses</h3>
<p><strong>Conflict of Interest:</strong> {{conflictOfInterestClause}}</p>
<p><strong>Confidentiality:</strong> {{confidentialityClause}}</p>
<p><strong>Legal Recourse:</strong> {{legalRecourseClause}}</p>

<h3>KYC Requirements</h3>
<ul>
  {{kycList}}
</ul>

<p>
Minimum Commitment: {{minCommitmentUntil}}<br/>
Notice Period: {{noticePeriodMonths}} month(s)
</p>

<p>Additional Terms: {{specialTerms}}</p>

<p>
For {{companyName}}<br/>
Authorized Signatory
</p>
`;

export async function POST(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can seed offer templates", 403);
    }

    const companyId = session.user.companyId;
    if (!companyId) {
      return errorResponse("Company context is required", 400);
    }

    const templates = [
      { name: auditAssistantTemplateName, content: auditAssistantTemplateContent },
      { name: associateTemplateName, content: associateTemplateContent },
    ];

    const createdOrUpdated = [];

    for (const tpl of templates) {
      const existing = await prisma.offerLetterTemplate.findFirst({
        where: { companyId, name: tpl.name },
      });

      if (existing) {
        const updated = await prisma.offerLetterTemplate.update({
          where: { id: existing.id },
          data: { content: tpl.content, isActive: true },
        });
        createdOrUpdated.push(updated);
      } else {
        const created = await prisma.offerLetterTemplate.create({
          data: {
            companyId,
            name: tpl.name,
            content: tpl.content,
            isActive: true,
          },
        });
        createdOrUpdated.push(created);
      }
    }

    return successResponse(createdOrUpdated, "Standard offer-letter templates are ready");
  } catch (err) {
    console.error("[POST /api/salary/offer-letters/seed-defaults]", err);
    return errorResponse("Failed to seed offer-letter templates", 500);
  }
}
