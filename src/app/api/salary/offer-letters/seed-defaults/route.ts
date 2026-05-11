import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
} from "@/lib/api-utils";

const auditAssistantTemplateName = "Standard Offer Letter - Audit Assistant";
const associateTemplateName = "Standard Offer Letter - Associate";
const nracoProTemplateName = "NR Agrawal & Co — Professional Offer Letter";

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

// ─────────────────────────────────────────────────────────────
// PROFESSIONAL NR AGRAWAL & CO TEMPLATE
// Matches the firm's actual Word document exactly.
// ─────────────────────────────────────────────────────────────
const nracoProTemplateContent = `
<style>
@media print {
  @page { size: A4 portrait; margin: 18mm 22mm 20mm 22mm; }
  .no-print { display: none !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
body, .ol-wrap { font-family: 'Times New Roman', Times, Georgia, serif; font-size: 11.5pt; line-height: 1.6; color: #111; }
.letterhead { text-align: center; padding-bottom: 10px; border-bottom: 3px double #1a237e; margin-bottom: 18px; }
.firm-name { font-size: 19pt; font-weight: bold; color: #1a237e; letter-spacing: 0.5px; }
.firm-sub { font-size: 9.5pt; color: #444; margin-top: 2px; }
.firm-ca { font-size: 9.5pt; color: #333; margin-top: 2px; }
.firm-addr { font-size: 9pt; color: #555; margin-top: 4px; }
.ol-title { text-align: center; font-size: 14pt; font-weight: bold; letter-spacing: 3px; text-decoration: underline; margin: 22px 0 18px; }
.sec-head { font-size: 11.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #888; padding-bottom: 3px; margin: 22px 0 10px; color: #1a237e; }
ul.ol-ul { list-style: disc; padding-left: 22px; margin: 5px 0 10px; }
ul.ol-ul li { margin-bottom: 5px; }
ul.ol-sub { list-style: circle; padding-left: 22px; margin: 3px 0 3px; }
ul.ol-sub li { margin-bottom: 3px; }
ol.ol-ol { padding-left: 22px; margin: 5px 0 10px; }
ol.ol-ol li { margin-bottom: 5px; }
.sig-block { margin-top: 35px; }
p { margin: 6px 0; }
.accept-block { page-break-before: always; border-top: 2px solid #1a237e; padding-top: 20px; margin-top: 30px; }
.annex-block { page-break-before: always; padding-top: 20px; }
table.hol-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 10px; }
table.hol-table th, table.hol-table td { border: 1px solid #bbb; padding: 5px 10px; }
table.hol-table th { background: #e8eaf6; font-weight: bold; text-align: center; }
</style>

<div class="letterhead">
  <div class="firm-name">N R AGRAWAL &amp; CO</div>
  <div class="firm-sub">Chartered Accountants</div>
  <div class="firm-ca">CA Nischal Agrawal &nbsp;&bull;&nbsp; Membership No. 138579 &nbsp;&bull;&nbsp; Partner</div>
  <div class="firm-addr">209 B, 2nd Floor, Crystal Plaza, New Link Road, Andheri West, Mumbai 400053</div>
</div>

<div class="ol-title">OFFER LETTER</div>

<p><strong>Date:</strong> {{issueDate}}</p>
<p><strong>Date of Joining:</strong> {{joiningDate}}</p>
<br/>
<p>Ms./Mr. {{employeeName}}<br/>[Address as per KYC documents]</p>
<br/>
<p>Dear {{firstName}},</p>
<p>We are pleased to extend to you an offer for the position of <strong>{{positionTitle}}</strong> with <strong>{{companyName}}</strong>. We are impressed with your qualifications and experience, and we believe you will be a valuable addition to our team.</p>

<div class="sec-head">Position Details</div>
<ul class="ol-ul">
  <li><strong>Position Title:</strong> {{positionTitle}}</li>
</ul>

<div class="sec-head">Compensation Package</div>
<p><strong>Probation Period:</strong></p>
<ul class="ol-ul">
  <li><strong>Salary:</strong> {{monthlyGross}} per month</li>
  <li><strong>Duration:</strong> {{probationPeriodMonths}} months</li>
  <li><strong>Security Deposit:</strong> Not applicable during probation</li>
</ul>
<p><strong>Post-Probation:</strong></p>
<ul class="ol-ul">
  <li><strong>Salary:</strong> {{revisedSalary}} per month (effective from {{revisedSalaryEffectiveFrom}})</li>
  <li><strong>Security Deposit:</strong> {{securityDeposit}} per month will be withheld as security deposit</li>
  <li><strong>Security Deposit Payment:</strong> Will be paid at the end of every 12 months along with the 13th month salary as per terms of agreement</li>
</ul>

<div class="sec-head">Leave Policy</div>
<p><strong>Paid Leaves:</strong></p>
<ul class="ol-ul">
  <li><strong>Entitlement:</strong> {{leaveEntitlementAnnual}} paid leaves per annum on proportionate basis</li>
  <li><strong>Credit Period:</strong> Leave credit starts from the month succeeding probation period end</li>
  <li><strong>Proportionate Calculation:</strong> For mid-year joining, leaves will be calculated proportionately from the month probation ends</li>
  <li><strong>Payment:</strong> Cumulative leave payments will be made twice yearly with April and October salaries</li>
  <li><strong>Deduction:</strong> Leaves will be deducted as taken; however, per month leave entitlement will be paid</li>
  <li><strong>Leave Application Process:</strong>
    <ul class="ol-sub">
      <li>Planned leaves must be submitted in writing via email to {{hrEmail}}</li>
      <li>Emergency leaves must be informed immediately via WhatsApp message to {{emergencyWhatsapp}}</li>
    </ul>
  </li>
  <li><strong>Sandwich Leave Policy:</strong> If any casual, planned, or emergency leave is taken before and after weekly off / festival leave, then such weekly off / festival leave will be considered as leave taken</li>
</ul>
<p><strong>Festival Holidays:</strong></p>
<ul class="ol-ul">
  <li><strong>Entitlement:</strong> {{festivalLeavesPerYear}} annual festival leaves</li>
  <li><strong>Holiday List:</strong> As per the schedule attached and forming part of this agreement</li>
</ul>

<div class="sec-head">Attendance Policy</div>
<ul class="ol-ul">
  <li><strong>Working Days:</strong> {{workingDays}}</li>
  <li><strong>Timings:</strong> {{workingHours}}</li>
  <li><strong>Late Arrival Policy:</strong> Up to {{lateArrivalGraceCount}} late arrivals (until {{lateArrivalCutoff}}) will not be marked as late. The 4th late arrival after {{lateArrivalCutoff}} will be considered a late arrival and half day will be marked</li>
  <li><strong>Absence Policy:</strong> Absenteeism will be deducted on month-to-month basis</li>
  <li><strong>Overtime Policy:</strong> There is no system of overtime compensation. It is expected that all assignments are duly completed during working hours. However, if there is a special reason to work beyond {{workingHours}} (particularly before tax due dates), the excess hours will be totalled and credit leave shall be accordingly granted which can be set off against leave taken in a month</li>
</ul>

<div class="sec-head">Responsibilities</div>
<p>In your role as <strong>{{positionTitle}}</strong>, you will be responsible for:</p>
<ul class="ol-ul">
  {{responsibilitiesList}}
</ul>

<div class="sec-head">Conflict of Interest Declaration</div>
<p>In line with peer review guidelines, CA firms are required to obtain declaration from all professional staff that they do not have any conflict of interest with the firm's clients. If any such conflict of interest arises in future, the firm shall be intimated immediately.</p>

<div class="sec-head">Confidentiality Clause</div>
<ol class="ol-ol">
  <li><strong>Information Security:</strong> No information related to audit, taxation, accounting processes, policies of the firm and/or its clients will be disclosed, copied, or transferred in any form or manner for any direct/indirect purpose</li>
  <li><strong>Data Exchange:</strong> All client data will be exchanged through the company email ID provided</li>
  <li><strong>General Confidentiality:</strong> You are prohibited from sharing any confidential or proprietary information of Head Office, its branches, related staff, partners, or clients with any external third party</li>
  <li><strong>Offer Confidentiality:</strong> This offer of employment is confidential and intended solely for your consideration. You are requested not to disclose any details of this offer without prior written consent from {{companyName}}</li>
</ol>

<div class="sec-head">KYC Documentation</div>
<p>Please submit the following KYC documents along with your acceptance:</p>
<ul class="ol-ul">
  {{kycList}}
</ul>

<div class="sec-head">Terms &amp; Conditions</div>
<ul class="ol-ul">
  <li><strong>Minimum Commitment:</strong> {{minCommitmentUntil}}</li>
  <li><strong>Notice Period:</strong> {{noticePeriodMonths}} month</li>
</ul>

<p>We believe that your contributions will significantly enhance our firm's capabilities, and we are excited to have you on board. Please indicate your acceptance of this offer by signing and returning this letter along with the required KYC documents. Should you have any questions or require further information, please do not hesitate to reach out.</p>
<p>We look forward to your positive response and to having you join our team.</p>
<br/>
<p>Warm regards,</p>
<div class="sig-block">
  <p><strong>CA Nischal Agrawal</strong><br/>
  Partner<br/>
  NR Agrawal &amp; Co<br/>
  Membership No. 138579<br/>
  209 B, 2nd Floor, Crystal Plaza<br/>
  New Link Road, Andheri West<br/>
  Mumbai 400053</p>
</div>

<div class="accept-block">
  <div class="ol-title" style="font-size:12pt;">ACCEPTANCE OF OFFER</div>
  <p>I, _____________________________, accept the offer as outlined above and confirm that I have read and understood all terms and conditions mentioned herein.</p>
  <br/>
  <p>Candidate Signature: _________________________________&nbsp;&nbsp;&nbsp;&nbsp; Date: _______________</p>
  <br/>
  <p>Name: _________________________________</p>
</div>

<div class="annex-block">
  <div class="ol-title" style="font-size:12pt;">ANNEXURE: PUBLIC HOLIDAY LIST</div>
  <table class="hol-table">
    <thead>
      <tr><th>Date</th><th>Day</th><th>Holiday</th></tr>
    </thead>
    <tbody>
      <tr><td>01 Jan</td><td>Thu</td><td>New Year's Day</td></tr>
      <tr><td>26 Jan</td><td>Mon</td><td>Republic Day</td></tr>
      <tr><td>26 Feb</td><td>Thu</td><td>Maha Shivaratri</td></tr>
      <tr><td>14 Mar</td><td>Sat</td><td>Holi</td></tr>
      <tr><td>06 Apr</td><td>Mon</td><td>Ram Navami</td></tr>
      <tr><td>15 Aug</td><td>Sat</td><td>Independence Day</td></tr>
      <tr><td>27 Aug</td><td>Wed</td><td>Ganesh Chaturthi</td></tr>
      <tr><td>02 Oct</td><td>Fri</td><td>Gandhi Jayanti / Vijaya Dashami</td></tr>
      <tr><td>20 Oct</td><td>Tue</td><td>Diwali</td></tr>
      <tr><td>21 Oct</td><td>Wed</td><td>Deepavali Holiday</td></tr>
      <tr><td>22 Oct</td><td>Thu</td><td>Bhai Dooj</td></tr>
      <tr><td>25 Dec</td><td>Thu</td><td>Christmas Day</td></tr>
    </tbody>
  </table>
</div>
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
      { name: nracoProTemplateName, content: nracoProTemplateContent },
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
