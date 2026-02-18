import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { FeatureKey } from "./constants";
import type { Permission } from "@/types";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            company: { select: { name: true } },
            featurePermissions: true,
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        const permissions: Record<string, Permission> = {};
        for (const fp of user.featurePermissions) {
          permissions[fp.feature] = {
            canView: fp.canView,
            canCreate: fp.canCreate,
            canEdit: fp.canEdit,
            canDelete: fp.canDelete,
            canApprove: fp.canApprove,
          };
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
        token.id = user.id!;
        token.firstName = (user as Record<string, unknown>).firstName as string;
        token.lastName = (user as Record<string, unknown>).lastName as string;
        token.role = (user as Record<string, unknown>).role as string;
        token.companyId = (user as Record<string, unknown>).companyId as string;
        token.companyName = (user as Record<string, unknown>).companyName as string;
        token.employeeCode = (user as Record<string, unknown>).employeeCode as string;
        token.profilePhoto = (user as Record<string, unknown>).profilePhoto as string | null;
        token.permissions = (user as Record<string, unknown>).permissions as Record<FeatureKey, Permission>;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        (session.user as Record<string, unknown>).id = token.id as string;
        (session.user as Record<string, unknown>).firstName = token.firstName as string;
        (session.user as Record<string, unknown>).lastName = token.lastName as string;
        (session.user as Record<string, unknown>).role = token.role as string;
        (session.user as Record<string, unknown>).companyId = token.companyId as string;
        (session.user as Record<string, unknown>).companyName = token.companyName as string;
        (session.user as Record<string, unknown>).employeeCode = token.employeeCode as string;
        (session.user as Record<string, unknown>).profilePhoto = token.profilePhoto as string | null;
        (session.user as Record<string, unknown>).permissions = token.permissions;
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
