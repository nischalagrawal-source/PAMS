// ============================================================
// P&AMS Constants
// ============================================================

/**
 * Bonus tiers — maps score ranges to bonus percentages
 * Exponentially harder to reach top tiers
 */
export const BONUS_TIERS = [
  { minScore: 0, maxScore: 30, minBonus: 25, maxBonus: 25, tier: "Minimum", color: "#ef4444" },
  { minScore: 31, maxScore: 50, minBonus: 26, maxBonus: 75, tier: "Below Average", color: "#f97316" },
  { minScore: 51, maxScore: 65, minBonus: 76, maxBonus: 100, tier: "Average", color: "#eab308" },
  { minScore: 66, maxScore: 78, minBonus: 101, maxBonus: 125, tier: "Good", color: "#84cc16" },
  { minScore: 79, maxScore: 87, minBonus: 126, maxBonus: 150, tier: "Very Good", color: "#22c55e" },
  { minScore: 88, maxScore: 93, minBonus: 151, maxBonus: 175, tier: "Excellent", color: "#06b6d4" },
  { minScore: 94, maxScore: 97, minBonus: 176, maxBonus: 200, tier: "Outstanding", color: "#8b5cf6" },
  { minScore: 98, maxScore: 100, minBonus: 201, maxBonus: 225, tier: "Exceptional", color: "#ec4899" },
] as const;

/**
 * Standard work hours per day
 */
export const STANDARD_WORK_HOURS = 8;

/**
 * WFH distance threshold in meters (5km from geo-fence = WFH)
 */
export const WFH_DISTANCE_THRESHOLD = 5000;

/**
 * Minimum advance notice for planned leave (days)
 */
export const DEFAULT_ADVANCE_NOTICE_DAYS = 7;

/**
 * Emergency leave threshold — beyond this counts as "long emergency"
 */
export const LONG_EMERGENCY_THRESHOLD_DAYS = 2;

/**
 * Simultaneous absence threshold
 * If 2+ staff absent more than this many times in 3 months, penalty applies
 */
export const SIMULTANEOUS_ABSENCE_THRESHOLD = 3;
export const SIMULTANEOUS_ABSENCE_PERIOD_MONTHS = 3;
export const MIN_SIMULTANEOUS_ABSENT = 2;

/**
 * Backlog threshold — tasks overdue beyond 1 week need special permission
 */
export const BACKLOG_SPECIAL_PERMISSION_DAYS = 7;

/**
 * Available features for RBAC permissions
 */
export const FEATURES = [
  { key: "dashboard", label: "Dashboard", description: "View dashboard overview" },
  { key: "attendance", label: "Attendance", description: "Attendance management" },
  { key: "leaves", label: "Leaves", description: "Leave management" },
  { key: "tasks", label: "Tasks", description: "Task management" },
  { key: "performance", label: "Performance", description: "Performance scores & bonuses" },
  { key: "salary", label: "Salary", description: "Salary & payroll" },
  { key: "reports", label: "Reports", description: "View reports & analytics" },
  { key: "notifications", label: "Notifications", description: "Notification management" },
  { key: "admin_users", label: "User Management", description: "Manage users & roles" },
  { key: "admin_companies", label: "Company Management", description: "Manage companies" },
  { key: "admin_geofences", label: "Geo-fence Management", description: "Manage geo-fences" },
  { key: "admin_parameters", label: "Parameters", description: "Manage performance parameters" },
  { key: "admin_rights", label: "Rights Management", description: "Manage user permissions" },
  { key: "admin_anomalies", label: "Anomaly Rules", description: "Manage anomaly detection" },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

/**
 * Navigation items for sidebar
 */
export const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/",
    icon: "LayoutDashboard",
    feature: "dashboard" as FeatureKey,
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: "MapPin",
    feature: "attendance" as FeatureKey,
  },
  {
    title: "Leaves",
    href: "/leaves",
    icon: "CalendarOff",
    feature: "leaves" as FeatureKey,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: "ListTodo",
    feature: "tasks" as FeatureKey,
  },
  {
    title: "Performance",
    href: "/performance",
    icon: "TrendingUp",
    feature: "performance" as FeatureKey,
  },
  {
    title: "Salary",
    href: "/salary",
    icon: "Wallet",
    feature: "salary" as FeatureKey,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: "BarChart3",
    feature: "reports" as FeatureKey,
  },
] as const;

export const ADMIN_NAV_ITEMS = [
  {
    title: "Users",
    href: "/admin/users",
    icon: "Users",
    feature: "admin_users" as FeatureKey,
  },
  {
    title: "Companies",
    href: "/admin/companies",
    icon: "Building2",
    feature: "admin_companies" as FeatureKey,
  },
  {
    title: "Geo-fences",
    href: "/admin/geofences",
    icon: "Radar",
    feature: "admin_geofences" as FeatureKey,
  },
  {
    title: "Parameters",
    href: "/admin/parameters",
    icon: "SlidersHorizontal",
    feature: "admin_parameters" as FeatureKey,
  },
  {
    title: "Rights",
    href: "/admin/rights",
    icon: "Shield",
    feature: "admin_rights" as FeatureKey,
  },
  {
    title: "Anomaly Rules",
    href: "/admin/anomalies",
    icon: "AlertTriangle",
    feature: "admin_anomalies" as FeatureKey,
  },
] as const;
