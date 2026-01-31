"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import { CalendarEvent } from "@/lib/types";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getUpcomingGames } from "@/lib/sports";

export default function GoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const token = localStorage.getItem("google_access_token");
    if (!token) return null;

    // Try token, refresh if needed
    const testRes = await fetch(`/api/calendar?action=events&token=${token}`);
    if (testRes.ok) return token;

    const refreshToken = localStorage.getItem("google_refresh_token");
    if (!refreshToken) return null;

    const refreshRes = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", refresh_token: refreshToken }),
    });
    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      localStorage.setItem("google_access_token", refreshData.access_token);
      return refreshData.access_token;
    }
    return null;
  }, []);

  const fetchEvents = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?action=events&token=${token}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        setConnected(true);
      } else {
        const validToken = await getValidToken();
        if (validToken && validToken !== token) {
          const retryRes = await fetch(`/api/calendar?action=events&token=${validToken}`);
          if (retryRes.ok) {
            const data = await retryRes.json();
            setEvents(data);
            setConnected(true);
          } else {
            setConnected(false);
          }
        } else {
          setConnected(false);
        }
      }
    } catch {
      console.error("Failed to fetch calendar events");
    }
    setLoading(false);
  }, [getValidToken]);

  useEffect(() => {
    const token = localStorage.getItem("google_access_token");
    if (token) {
      fetchEvents(token);
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "google-auth" && event.data.code) {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "token", code: event.data.code }),
        });
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("google_access_token", data.access_token);
          if (data.refresh_token) {
            localStorage.setItem("google_refresh_token", data.refresh_token);
          }
          fetchEvents(data.access_token);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [fetchEvents]);

  const handleConnect = async () => {
    const res = await fetch("/api/calendar?action=auth");
    const data = await res.json();
    if (data.authUrl) {
      window.open(data.authUrl, "google-auth", "width=500,height=600");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("google_access_token");
    localStorage.removeItem("google_refresh_token");
    setConnected(false);
    setEvents([]);
  };

  const handleSyncToGoogle = async () => {
    setSyncing(true);
    setSyncResult(null);

    const token = await getValidToken();
    if (!token) {
      setSyncResult("Not connected to Google Calendar");
      setSyncing(false);
      return;
    }

    const week = getCurrentWeek();
    const gcalEvents: Array<{
      summary: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      description?: string;
      colorId?: string;
    }> = [];

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Build routine events for the next 14 days
    for (let i = 0; i < 14; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const routine = getRoutineForDate(date, week);

      routine.forEach((item) => {
        if (!item.endTime) return;
        gcalEvents.push({
          summary: `[Routine] ${item.name}`,
          start: { dateTime: `${dateStr}T${item.time}:00`, timeZone: tz },
          end: { dateTime: `${dateStr}T${item.endTime}:00`, timeZone: tz },
          description: "Synced from Personal Tracker",
          colorId: "2", // Sage/green
        });
      });
    }

    // Build sports events
    try {
      const allGames = await fetchSportsSchedules();
      const upcoming = getUpcomingGames(allGames, 30);

      upcoming.forEach((game) => {
        const dateStr = format(new Date(game.date), "yyyy-MM-dd");
        const teamName = game.team === "man-city" ? "Man City" : "Illinois Basketball";
        gcalEvents.push({
          summary: `[Game] ${teamName} vs ${game.opponent}`,
          start: { dateTime: `${dateStr}T${game.time}:00`, timeZone: tz },
          end: { dateTime: `${dateStr}T${game.endTime}:00`, timeZone: tz },
          description: `${game.venue} | ${game.competition} | ${game.isHome ? "Home" : "Away"}\nSynced from Personal Tracker`,
          colorId: game.team === "man-city" ? "7" : "6", // Peacock / Tangerine
        });
      });
    } catch {
      // Continue without sports if fetch fails
    }

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", token, events: gcalEvents }),
      });
      const result = await res.json();
      if (result.error) {
        setSyncResult(`Error: ${result.error}`);
      } else {
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} created`);
        if (result.skipped > 0) parts.push(`${result.skipped} already exist`);
        if (result.errors > 0) parts.push(`${result.errors} errors`);
        setSyncResult(parts.join(", ") || "Nothing to sync");
      }
      // Refresh events
      fetchEvents(token);
    } catch {
      setSyncResult("Sync failed");
    }

    setSyncing(false);
  };

  const formatEventTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatEventDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getEventColor = (summary: string) => {
    if (summary.startsWith("[Routine]")) return "border-l-emerald-500";
    if (summary.startsWith("[Game]")) return "border-l-sky-500";
    return "border-l-violet-500";
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Google Calendar</h2>
        {connected && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncToGoogle}
              disabled={syncing}
              className="text-sm font-semibold px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20 inline-flex items-center gap-1.5"
            >
              {syncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync to Google
                </>
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="text-sm text-slate-400 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {syncResult && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          syncResult.includes("Error") || syncResult.includes("failed")
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        }`}>
          {syncResult}
        </div>
      )}

      {!connected ? (
        <div className="text-center py-6">
          <div className="mb-4">
            <svg
              className="w-12 h-12 mx-auto text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-slate-400 mb-2">
            Connect your Google Calendar for two-way sync
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Your routine and game schedules will be exported to Google Calendar
          </p>
          <button
            onClick={handleConnect}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl hover:from-violet-500 hover:to-blue-500 transition-all font-semibold shadow-lg shadow-violet-500/20 inline-flex items-center gap-2"
          >
            Connect Google Calendar
          </button>
        </div>
      ) : loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-700 rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="text-slate-400 text-center py-6">No upcoming events. Hit &quot;Sync to Google&quot; to export your routine and games.</p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {events.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-xl bg-slate-700/40 border border-slate-600/30 border-l-4 ${getEventColor(event.summary)}`}
            >
              <p className="text-white font-medium text-sm">
                {event.summary.replace(/^\[(Routine|Game)\] /, "")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {event.summary.startsWith("[Routine]") && (
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">Routine</span>
                )}
                {event.summary.startsWith("[Game]") && (
                  <span className="text-xs bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded">Game</span>
                )}
                <p className="text-slate-400 text-xs">
                  {formatEventDate(event.start)} &middot; {formatEventTime(event.start)} - {formatEventTime(event.end)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
