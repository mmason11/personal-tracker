"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import RoutineTracker from "@/components/RoutineTracker";
import SportsSchedule from "@/components/SportsSchedule";
import BigThree from "@/components/BigThree";
import TodoList from "@/components/TodoList";
import GoogleCalendar from "@/components/GoogleCalendar";
import DayTimeline from "@/components/DayTimeline";
import TodoSummary from "@/components/TodoSummary";
import MetricsPage from "@/components/MetricsPage";

type Tab = "dashboard" | "sports" | "todos" | "calendar" | "metrics";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const { user, loading, signOut } = useAuth();
  const today = format(new Date(), "EEEE, MMMM d");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Home", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { id: "sports", label: "Games", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" },
    { id: "todos", label: "Tasks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { id: "calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    { id: "metrics", label: "Metrics", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Middleware will redirect to login
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] pb-20 md:pb-6 relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Personal Tracker
              </h1>
              <p className="text-sm text-slate-400">{today}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Desktop tabs */}
              <nav className="hidden md:flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              {/* Sign out */}
              <button
                onClick={signOut}
                className="hidden md:block text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 relative z-10">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <DayTimeline />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RoutineTracker />
              <div className="space-y-6">
                <BigThree />
                <TodoSummary />
              </div>
            </div>
          </div>
        )}

        {activeTab === "sports" && <SportsSchedule />}

        {activeTab === "todos" && <TodoList />}

        {activeTab === "calendar" && <GoogleCalendar />}

        {activeTab === "metrics" && <MetricsPage />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0f1e]/95 backdrop-blur-xl border-t border-slate-800/80 z-50">
        <div className="flex justify-around py-2 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                activeTab === tab.id
                  ? "text-violet-400"
                  : "text-slate-500"
              }`}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={activeTab === tab.id ? 2.5 : 1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
