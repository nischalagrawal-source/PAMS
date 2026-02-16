import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const headers = [
      "firstName", "lastName", "email", "phone", "employeeCode",
      "role", "designation", "department", "dateOfJoining", "workMode",
      "basicSalary", "company",
    ];

    const sampleData = [
      {
        firstName: "Rahul", lastName: "Sharma", email: "rahul@company.com",
        phone: "+91-9876543210", employeeCode: "EMP001", role: "STAFF",
        designation: "Executive", department: "Operations",
        dateOfJoining: "2024-06-01", workMode: "office",
        basicSalary: 50000, company: "COMP1",
      },
      {
        firstName: "Priya", lastName: "Patel", email: "priya@company.com",
        phone: "+91-9876543211", employeeCode: "EMP002", role: "REVIEWER",
        designation: "Team Lead", department: "Sales",
        dateOfJoining: "2023-03-15", workMode: "hybrid",
        basicSalary: 70000, company: "COMP1",
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData, { header: headers });

    // Set column widths
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 15) }));

    XLSX.utils.book_append_sheet(wb, ws, "Staff");

    // Instructions sheet
    const instructions = [
      { Field: "firstName", Required: "Yes", Description: "Employee first name" },
      { Field: "lastName", Required: "Yes", Description: "Employee last name" },
      { Field: "email", Required: "Yes", Description: "Unique email address" },
      { Field: "phone", Required: "No", Description: "Phone with country code" },
      { Field: "employeeCode", Required: "Yes", Description: "Unique code per company (e.g., EMP001)" },
      { Field: "role", Required: "Yes", Description: "STAFF, REVIEWER, or ADMIN" },
      { Field: "designation", Required: "No", Description: "Job title (e.g., Executive, Manager)" },
      { Field: "department", Required: "No", Description: "Department name" },
      { Field: "dateOfJoining", Required: "No", Description: "YYYY-MM-DD format" },
      { Field: "workMode", Required: "Yes", Description: "office, client, or hybrid" },
      { Field: "basicSalary", Required: "No", Description: "Monthly basic pay (HRA/DA/PF auto-calculated)" },
      { Field: "company", Required: "Yes", Description: "Company code (e.g., COMP1, COMP2)" },
    ];
    const instrWs = XLSX.utils.json_to_sheet(instructions);
    instrWs["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, instrWs, "Instructions");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=pams-staff-template.xlsx",
      },
    });
  } catch (err) {
    console.error("[TEMPLATE]", err);
    return NextResponse.json({ success: false, error: "Failed to generate template" }, { status: 500 });
  }
}
