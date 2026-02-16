"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS } from "@/lib/constants";
import type { SessionUser } from "@/types";
import { hasPermission } from "@/types";
import {
  LayoutDashboard,
  MapPin,
  CalendarOff,
  ListTodo,
  TrendingUp,
  Wallet,
  BarChart3,
  Users,
  Building2,
  Radar,
  SlidersHorizontal,
  Shield,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  MapPin,
  CalendarOff,
  ListTodo,
  TrendingUp,
  Wallet,
  BarChart3,
  Users,
  Building2,
  Radar,
  SlidersHorizontal,
  Shield,
  AlertTriangle,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const canAccess = (feature: string) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    return hasPermission(user, feature as never, "canView");
  };

  const filteredNavItems = NAV_ITEMS.filter((item) => canAccess(item.feature));
  const filteredAdminItems = ADMIN_NAV_ITEMS.filter((item) => canAccess(item.feature));
  const showAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN" || filteredAdminItems.length > 0;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-950",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
              P
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              P&AMS
            </span>
          </Link>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
            P
          </div>
        )}
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {/* Main nav */}
        {filteredNavItems.map((item) => {
          const Icon = iconMap[item.icon] || LayoutDashboard;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              )}
            >
              <Icon size={20} className={cn(active && "text-blue-600")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}

        {/* Admin section */}
        {showAdmin && (
          <>
            <div className="my-2 border-t border-gray-200 dark:border-gray-800" />
            {!collapsed && (
              <span className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Administration
              </span>
            )}
            {filteredAdminItems.map((item) => {
              const Icon = iconMap[item.icon] || Shield;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  )}
                >
                  <Icon size={20} className={cn(active && "text-blue-600")} />
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Company info at bottom */}
      {user && !collapsed && (
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4 dark:border-gray-800">
          <div className="text-xs text-gray-500">
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {user.companyName}
            </p>
            <p>{user.role.replace("_", " ")}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
