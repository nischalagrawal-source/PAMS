"use client";

import { useSession } from "next-auth/react";
import { User, Mail, Building2, GitBranch, Shield, Hash } from "lucide-react";
import type { SessionUser } from "@/types";

export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`;

  const fields = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Hash, label: "Employee Code", value: user.employeeCode },
    { icon: Shield, label: "Role", value: user.role.replace(/_/g, " ") },
    { icon: Building2, label: "Company", value: user.companyName },
    ...(user.branchName ? [{ icon: GitBranch, label: "Branch", value: user.branchName }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
          <User size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500">Your account information</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex items-center gap-4 border-b border-gray-200 pb-6 dark:border-gray-800">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {user.role.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.label} className="flex items-center gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                <Icon size={18} className="text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{field.label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{field.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
