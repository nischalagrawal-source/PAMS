import * as XLSX from "xlsx";
import path from "path";

const wb = XLSX.utils.book_new();

// Sheet 1: Staff Data (to be filled by staff/HR)
const staffHeaders = [
  "firstName", "lastName", "email", "phone", "employeeCode",
  "role", "designation", "department", "dateOfJoining", "workMode",
  "basicSalary", "company",
];

// Empty rows with just headers (staff fills this)
const staffData: Record<string, string>[] = [];
// Add 50 empty rows for staff to fill
for (let i = 0; i < 50; i++) {
  staffData.push({});
}

const ws1 = XLSX.utils.json_to_sheet(staffData, { header: staffHeaders });
ws1["!cols"] = [
  { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 18 }, { wch: 15 },
  { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 12 },
  { wch: 15 }, { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, ws1, "Staff Data");

// Sheet 2: Instructions
const instructions = [
  { Field: "firstName", Required: "YES", Description: "Employee's first name", Example: "Rahul" },
  { Field: "lastName", Required: "YES", Description: "Employee's last name", Example: "Sharma" },
  { Field: "email", Required: "YES", Description: "Unique email address (used for login)", Example: "rahul.sharma@agrovilla.in" },
  { Field: "phone", Required: "No", Description: "Phone number with country code", Example: "+91-9876543210" },
  { Field: "employeeCode", Required: "YES", Description: "Unique employee ID within the company", Example: "EMP001" },
  { Field: "role", Required: "YES", Description: "STAFF = regular employee, REVIEWER = team lead/manager, ADMIN = company admin", Example: "STAFF" },
  { Field: "designation", Required: "No", Description: "Job title / position", Example: "Executive" },
  { Field: "department", Required: "No", Description: "Department or team name", Example: "Operations" },
  { Field: "dateOfJoining", Required: "No", Description: "Date of joining in YYYY-MM-DD format", Example: "2024-06-01" },
  { Field: "workMode", Required: "YES", Description: "office = works from office, client = at client site, hybrid = mix of both", Example: "office" },
  { Field: "basicSalary", Required: "No", Description: "Monthly basic salary (HRA, DA, PF will be auto-calculated)", Example: "50000" },
  { Field: "company", Required: "YES", Description: "Company code — ask your admin for the code", Example: "COMP1" },
];

const ws2 = XLSX.utils.json_to_sheet(instructions);
ws2["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 55 }, { wch: 30 }];
XLSX.utils.book_append_sheet(wb, ws2, "Instructions");

// Sheet 3: Role Guide
const roleGuide = [
  { Role: "STAFF", Description: "Regular employee. Can: check attendance, apply leave, view tasks, view salary.", Access: "Dashboard, Attendance, Leaves, Tasks, Salary" },
  { Role: "REVIEWER", Description: "Team lead / Manager. Can do everything STAFF can + assign tasks, approve leaves, review accuracy.", Access: "Dashboard, Attendance, Leaves, Tasks, Performance, Reports, Salary" },
  { Role: "ADMIN", Description: "Company administrator. Full access to all features and admin panels.", Access: "All features + Admin panels" },
];
const ws3 = XLSX.utils.json_to_sheet(roleGuide);
ws3["!cols"] = [{ wch: 12 }, { wch: 60 }, { wch: 55 }];
XLSX.utils.book_append_sheet(wb, ws3, "Role Guide");

// Sheet 4: Work Mode Guide
const workModeGuide = [
  { WorkMode: "office", Description: "Employee primarily works from the office. Attendance tracked via office geo-fence." },
  { WorkMode: "client", Description: "Employee works at a client's location. Attendance tracked via client site geo-fence." },
  { WorkMode: "hybrid", Description: "Employee works from office some days and remotely (WFH) other days." },
];
const ws4 = XLSX.utils.json_to_sheet(workModeGuide);
ws4["!cols"] = [{ wch: 12 }, { wch: 70 }];
XLSX.utils.book_append_sheet(wb, ws4, "Work Mode Guide");

// Sheet 5: Company Setup (for admin to fill)
const companyData = [
  { Field: "Company 1 Name", Value: "", Example: "Agrovilla Industries Pvt Ltd" },
  { Field: "Company 1 Code", Value: "", Example: "AGRO" },
  { Field: "Company 1 Address", Value: "", Example: "123 Business Park, Mumbai" },
  { Field: "Company 1 Phone", Value: "", Example: "+91-22-12345678" },
  { Field: "Company 1 Email", Value: "", Example: "hr@agrovilla.in" },
  { Field: "Company 1 In-Time", Value: "", Example: "09:30" },
  { Field: "Company 1 Out-Time", Value: "", Example: "18:30" },
  { Field: "Company 1 Grace Minutes", Value: "", Example: "15" },
  { Field: "", Value: "", Example: "" },
  { Field: "Company 2 Name", Value: "", Example: "NRACO Solutions" },
  { Field: "Company 2 Code", Value: "", Example: "NRACO" },
  { Field: "Company 2 Address", Value: "", Example: "456 Tech Hub, Pune" },
  { Field: "Company 2 Phone", Value: "", Example: "+91-20-98765432" },
  { Field: "Company 2 Email", Value: "", Example: "hr@nraco.in" },
  { Field: "Company 2 In-Time", Value: "", Example: "09:30" },
  { Field: "Company 2 Out-Time", Value: "", Example: "18:30" },
  { Field: "Company 2 Grace Minutes", Value: "", Example: "15" },
  { Field: "", Value: "", Example: "" },
  { Field: "Office 1 Name", Value: "", Example: "Head Office Mumbai" },
  { Field: "Office 1 Latitude", Value: "", Example: "19.0760 (from Google Maps)" },
  { Field: "Office 1 Longitude", Value: "", Example: "72.8777 (from Google Maps)" },
  { Field: "Office 1 Radius (meters)", Value: "", Example: "200" },
  { Field: "Office 1 Type", Value: "", Example: "office" },
  { Field: "", Value: "", Example: "" },
  { Field: "Client Site 1 Name", Value: "", Example: "Client - ABC Corp" },
  { Field: "Client Site 1 Latitude", Value: "", Example: "19.1136" },
  { Field: "Client Site 1 Longitude", Value: "", Example: "72.8697" },
  { Field: "Client Site 1 Radius (meters)", Value: "", Example: "150" },
  { Field: "Client Site 1 Type", Value: "", Example: "client_site" },
];
const ws5 = XLSX.utils.json_to_sheet(companyData);
ws5["!cols"] = [{ wch: 28 }, { wch: 35 }, { wch: 35 }];
XLSX.utils.book_append_sheet(wb, ws5, "Company & Geo-fence Setup");

// Write file
const outputPath = path.join(process.cwd(), "public", "pams-staff-data-form.xlsx");
XLSX.writeFile(wb, outputPath);
console.log(`Excel form created at: ${outputPath}`);
console.log("\nSheets included:");
console.log("  1. Staff Data — 50 empty rows for staff to fill");
console.log("  2. Instructions — Field descriptions and requirements");
console.log("  3. Role Guide — STAFF vs REVIEWER vs ADMIN");
console.log("  4. Work Mode Guide — office vs client vs hybrid");
console.log("  5. Company & Geo-fence Setup — For admin to fill company details");
console.log("\nDownload from: http://localhost:3000/pams-staff-data-form.xlsx");
