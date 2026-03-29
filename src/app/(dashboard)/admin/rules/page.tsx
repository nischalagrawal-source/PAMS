"use client";

import { useState } from "react";
import { Settings2, Calendar, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttendanceRulesTab } from "./attendance-rules-tab";
import { HolidaysTab } from "./holidays-tab";
import { UserShiftsTab } from "./user-shifts-tab";

const TABS = [
  { key: "attendance", label: "Attendance Rules", icon: Clock, description: "In/Out time, grace period, late threshold" },
  { key: "holidays", label: "Holidays & Festivals", icon: Calendar, description: "Festival leaves, public holidays" },
  { key: "shifts", label: "User Shifts", icon: Users, description: "Per-user timing overrides" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("attendance");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/25">
          <Settings2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rules & Policies</h1>
          <p className="text-gray-500">Manage attendance rules, holidays, and shift timings</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-px dark:border-gray-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "attendance" && <AttendanceRulesTab />}
      {activeTab === "holidays" && <HolidaysTab />}
      {activeTab === "shifts" && <UserShiftsTab />}
    </div>
  );
}
