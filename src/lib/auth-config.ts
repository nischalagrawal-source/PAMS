import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import type { FeatureKey } from "./constants";
import type { Permission } from "@/types";

export const authConfig: NextAuthConfig = {
  providers: [
    // ── NRA Co SSO: auto-login from nraco.in portal ──────────────
    Credentials({
      id: "sso-nraco",
      name: "NRA Co SSO",
      credentials: {
        token: { label: "SSO Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;
        try {
          const secret = process.env.NRACO_JWT_SECRET;
          if (!secret) return null;

          // Verify the CA Website JWT — this ensures the token is authentic
          const payload = jwt.verify(credentials.token as string, secret) as {
            email: string;
            role: string;
            name: string;
            branch?: string;
          };
          if (!payload?.email) return null;

          // Map CA Website roles → PMS roles.
          // NRACO superadmin → SUPER_ADMIN (global)
          // NRACO admin/partner → ADMIN (company-scoped)
          const pmsRole = payload.role === "superadmin"
            ? "SUPER_ADMIN"
            : ["admin", "partner"].includes(payload.role)
            ? "ADMIN"
            : "STAFF";

          // Find existing PMS user or create on first SSO login
          let user = await prisma.user.findUnique({
            where: { email: payload.email },
            include: { company: { select: { name: true } }, branch: { select: { name: true } }, featurePermissions: true },
          });

          if (user && user.role !== pmsRole) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { role: pmsRole as "SUPER_ADMIN" | "ADMIN" | "STAFF" },
              include: { company: { select: { name: true } }, branch: { select: { name: true } }, featurePermissions: true },
            });
          }

          if (!user) {
            const companyId = process.env.NRACO_COMPANY_ID;
            const company = companyId
              ? await prisma.company.findUnique({ where: { id: companyId } })
              : await prisma.company.findFirst();
            if (!company) return null;

            const parts = (payload.name || payload.email.split("@")[0]).trim().split(" ");
            const firstName = parts[0];
            const lastName = parts.slice(1).join(" ") || "-";
            const count = await prisma.user.count({ where: { companyId: company.id } });
            const employeeCode = `SSO${String(count + 1).padStart(3, "0")}`;
            const hashedPw = await bcrypt.hash(`SSO_${Date.now()}`, 10);

            user = await prisma.user.create({
              data: {
                companyId: company.id,
                email: payload.email,
                password: hashedPw,
                firstName,
                lastName,
                employeeCode,
                role: pmsRole as "SUPER_ADMIN" | "ADMIN" | "STAFF",
                designation: payload.branch || "",
              },
              include: { company: { select: { name: true } }, branch: { select: { name: true } }, featurePermissions: true },
            });

          }

          if (!user.isActive) return null;

          const permissions: Record<string, Permission> = {};
          if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "BRANCH_ADMIN") {
            for (const fp of user.featurePermissions) {
              permissions[fp.feature] = {
                canView: fp.canView,
                canCreate: fp.canCreate,
                canEdit: fp.canEdit,
                canDelete: fp.canDelete,
                canApprove: fp.canApprove,
              };
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company.name,
            branchId: user.branchId ?? null,
            branchName: user.branch?.name ?? null,
            employeeCode: user.employeeCode,
            profilePhoto: user.profilePhoto,
            permissions: permissions as Record<FeatureKey, Permission>,
          };
        } catch {
          return null;
        }
      },
    }),
    // ── Password login ────────────────────────────────────────────
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            company: { select: { name: true } },
            branch: { select: { name: true } },
            featurePermissions: true,
          },
        });

        if (!user || !user.isActive) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isPasswordValid) return null;

        // SUPER_ADMIN, ADMIN and BRANCH_ADMIN bypass all permission checks
        const permissions: Record<string, Permission> = {};
        if (user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "BRANCH_ADMIN") {
          for (const fp of user.featurePermissions) {
            permissions[fp.feature] = {
              canView: fp.canView,
              canCreate: fp.canCreate,
              canEdit: fp.canEdit,
              canDelete: fp.canDelete,
              canApprove: fp.canApprove,
            };
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company.name,
          branchId: user.branchId ?? null,
          branchName: user.branch?.name ?? null,
          employeeCode: user.employeeCode,
          profilePhoto: user.profilePhoto,
          permissions: permissions as Record<FeatureKey, Permission>,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
        token.branchId = user.branchId ?? null;
        token.branchName = user.branchName ?? null;
        token.employeeCode = user.employeeCode;
        token.profilePhoto = user.profilePhoto;
        token.permissions = user.permissions;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        const t = token as Record<string, unknown>;
        session.user.id = t.id as string;
        session.user.firstName = t.firstName as string;
        session.user.lastName = t.lastName as string;
        session.user.role = t.role as string;
        session.user.companyId = t.companyId as string;
        session.user.companyName = t.companyName as string;
        session.user.branchId = (t.branchId ?? null) as string | null;
        session.user.branchName = (t.branchName ?? null) as string | null;
        session.user.employeeCode = t.employeeCode as string;
        session.user.profilePhoto = t.profilePhoto as string | null;
        session.user.permissions = t.permissions as typeof session.user.permissions;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
};
