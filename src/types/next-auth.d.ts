import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
    companyName: string;
    employeeCode: string;
    profilePhoto?: string | null;
    permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean }>;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      firstName: string;
      lastName: string;
      role: string;
      companyId: string;
      companyName: string;
      employeeCode: string;
      profilePhoto?: string | null;
      image?: string | null;
      permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean }>;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
    companyName: string;
    employeeCode: string;
    profilePhoto?: string | null;
    permissions: Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean }>;
  }
}
