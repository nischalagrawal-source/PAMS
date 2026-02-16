import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { FeatureKey } from "./constants";
import type { Permission } from "@/types";

declare module "next-auth" {
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
      permissions: Record<FeatureKey, Permission>;
    };
  }

  interface User {
    id?: string;
    firstName: string;
    lastName: string;
    role: string;
    companyId: string;
    companyName: string;
    employeeCode: string;
    profilePhoto?: string | null;
    permissions: Record<FeatureKey, Permission>;
  }
}

export interface ExtendedJWT extends JWT {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  companyName: string;
  employeeCode: string;
  profilePhoto?: string | null;
  permissions: Record<FeatureKey, Permission>;
}

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

        // Build permissions map
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
    async jwt({ token, user }) {
      if (user) {
        const t = token as ExtendedJWT;
        t.id = user.id!;
        t.firstName = user.firstName;
        t.lastName = user.lastName;
        t.role = user.role;
        t.companyId = user.companyId;
        t.companyName = user.companyName;
        t.employeeCode = user.employeeCode;
        t.profilePhoto = user.profilePhoto;
        t.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as ExtendedJWT;
      session.user.id = t.id;
      session.user.firstName = t.firstName;
      session.user.lastName = t.lastName;
      session.user.role = t.role;
      session.user.companyId = t.companyId;
      session.user.companyName = t.companyName;
      session.user.employeeCode = t.employeeCode;
      session.user.profilePhoto = t.profilePhoto;
      session.user.permissions = t.permissions;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = !nextUrl.pathname.startsWith("/login") &&
        !nextUrl.pathname.startsWith("/register") &&
        !nextUrl.pathname.startsWith("/api/auth");

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
