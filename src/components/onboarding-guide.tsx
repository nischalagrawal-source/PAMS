"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { SessionUser } from "@/types";
import {
  X,
  MapPin,
  CalendarOff,
  Wallet,
  ListTodo,
  TrendingUp,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Clock,
  Shield,
  BarChart3,
  Sparkles,
} from "lucide-react";

const ONBOARDING_KEY = "pams-onboarding-seen-v1";

interface GuideStep {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  forRoles?: string[];
}

const GUIDE_STEPS: GuideStep[] = [
  {
    icon: Sparkles,
    color: "from-blue-500 to-indigo-600",
    title: "Welcome to P&AMS!",
    description:
      "Your Performance & Attendance Management System. Here's a quick guide to help you get started with the key features.",
  },
  {
    icon: MapPin,
    color: "from-emerald-500 to-green-600",
    title: "Attendance",
    description:
      "Check in and out with GPS verification. Open Attendance from the sidebar, tap 'Check In' when you arrive at office and 'Check Out' when you leave. Your location is verified automatically against your assigned geo-fence.",
  },
  {
    icon: CalendarOff,
    color: "from-orange-500 to-amber-600",
    title: "Leaves",
    description:
      "Apply for planned or emergency leave. Go to Leaves → Apply Leave, select dates and type (Casual/Medical/Earned). Planned leave needs advance notice. Your admin will approve or reject the request.",
  },
  {
    icon: ListTodo,
    color: "from-violet-500 to-purple-600",
    title: "Tasks",
    description:
      "View and manage tasks assigned to you. Check deadlines, update progress, and mark tasks complete. Overdue tasks affect your performance score.",
  },
  {
    icon: TrendingUp,
    color: "from-cyan-500 to-blue-600",
    title: "Performance",
    description:
      "Track your performance score based on attendance, task completion, and other parameters. Higher scores unlock better bonus tiers at year-end.",
  },
  {
    icon: Wallet,
    color: "from-pink-500 to-rose-600",
    title: "Salary",
    description:
      "View your salary structure, download monthly salary slips, and check bonus calculations — all in one place.",
    forRoles: ["STAFF", "BRANCH_ADMIN", "ADMIN", "SUPER_ADMIN"],
  },
  {
    icon: Clock,
    color: "from-amber-500 to-orange-600",
    title: "Late & Overtime Rules",
    description:
      "Arriving after in-time + grace period marks you as late. Multiple late arrivals in a month trigger half-day deductions. Overtime hours beyond duty time are tracked and may be paid in eligible months.",
  },
  {
    icon: Smartphone,
    color: "from-green-500 to-emerald-600",
    title: "Install on Your Phone",
    description:
      "For the best experience, add P&AMS to your phone's home screen:\n\n📱 Android: Open Chrome → tap ⋮ menu → 'Add to Home Screen'\n🍎 iPhone: Open Safari → tap Share → 'Add to Home Screen'\n\nThis gives you quick one-tap access for daily check-in!",
  },
  {
    icon: Shield,
    color: "from-indigo-500 to-violet-600",
    title: "Admin Features",
    description:
      "Manage users, branches, geo-fences, attendance rules, leave policies, salary structures, and performance parameters from the Administration section in the sidebar.",
    forRoles: ["ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"],
  },
  {
    icon: BarChart3,
    color: "from-teal-500 to-cyan-600",
    title: "Reports",
    description:
      "View attendance reports, leave summaries, and performance analytics. Filter by date range, department, or employee.",
    forRoles: ["ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"],
  },
];

export function OnboardingGuide() {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    const key = `${ONBOARDING_KEY}-${user.id}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      setShow(true);
    }
  }, [user]);

  if (!show || !user) return null;

  const filteredSteps = GUIDE_STEPS.filter(
    (s) => !s.forRoles || s.forRoles.includes(user.role)
  );

  const currentStep = filteredSteps[step];
  if (!currentStep) return null;

  const Icon = currentStep.icon;
  const isLast = step === filteredSteps.length - 1;

  const handleClose = () => {
    const key = `${ONBOARDING_KEY}-${user.id}`;
    localStorage.setItem(key, new Date().toISOString());
    setShow(false);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-gray-900">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <X size={18} />
        </button>

        {/* Icon header */}
        <div className={`flex items-center justify-center bg-gradient-to-r ${currentStep.color} px-6 py-8`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Icon size={32} className="text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {currentStep.title}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {currentStep.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pb-2">
          {filteredSteps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? "w-6 bg-blue-600" : "w-2 bg-gray-300 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            onClick={handleClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Skip Guide
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {isLast ? "Get Started!" : "Next"}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
