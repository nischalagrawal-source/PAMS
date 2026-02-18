import type { NextAuthConfig } from "next-auth";
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
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            company: { select: { name: true } },
            featurePermissions: true,
          },
        });

        if (!user || !user.isActive) return null;

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isPasswordValid) return null;

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
        token.id = user.id;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
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
