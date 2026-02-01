"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, startOfDay, isToday, isSameDay } from "date-fns";
import { CalendarEvent } from "@/lib/types";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getUpcomingGames } from "@/lib/sports";
import { formatTime12h } from "@/lib/timeFormat";
import {
  getCustomEventsForDate,
  addCustomEvent,
  updateCustomEvent,
  removeCustomEvent,
  getGoogleTokens,
  saveGoogleTokens,
  clearGoogleTokens,
} from "@/lib/supabase-storage";
import EventEditor from "./EventEditor";

interface CalendarDisplayEvent extends CalendarEvent {
  editable: boolean;
  customEventId?: string;
}

export default function GoogleCalendar() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);

  // Editor state
  const [editorState, setEditorState] = useState<{
    mode: "create" | "edit";
    eventId?: string;
    eventType?: "custom";
    initialData: { name: string; start: string; end: string; date: string };
  } | null>(null);

  // Cross-day drag state (desktop only)
  const [dragCalState, setDragCalState] = useState<{
    eventId: string;
    sourceDate: string;
    currentColIdx: number | null;
    hasMoved: boolean;
  } | null>(null);
  const dayColumnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekStart(startOfDay(new Date()));

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    const { accessToken, refreshToken } = await getGoogleTokens();
    if (!accessToken) return null;

    const testRes = await fetch(`/api/calendar?action=events&token=${accessToken}`);
    if (testRes.ok) return accessToken;

    if (!refreshToken) return null;

    const refreshRes = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", refresh_token: refreshToken }),
    });
    const refreshData = await refreshRes.json();
    if (refreshData.access_token) {
      await saveGoogleTokens(refreshData.access_token);
      return refreshData.access_token;
    }
    return null;
  }, []);

  const fetchEvents = useCallback(
    async (token: string) => {
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
            const retryRes = await fetch(
              `/api/calendar?action=events&token=${validToken}`
            );
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
    },
    [getValidToken]
  );

  useEffect(() => {
    async function init() {
      const { accessToken } = await getGoogleTokens();
      if (accessToken) {
        fetchEvents(accessToken);
      }
    }
    init();

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "google-auth" && event.data.code) {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "token", code: event.data.code }),
        });
        const data = await res.json();
        if (data.access_token) {
          await saveGoogleTokens(data.access_token, data.refresh_token);
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

  const handleDisconnect = async () => {
    await clearGoogleTokens();
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

    const week = await getCurrentWeek();
    const gcalEvents: Array<{
      summary: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      description?: string;
      colorId?: string;
      reminders?: { useDefault: boolean; overrides: never[] };
    }> = [];

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
          colorId: "2",
          reminders: { useDefault: false, overrides: [] },
        });
      });
    }

    try {
      const allGames = await fetchSportsSchedules();
      const upcoming = getUpcomingGames(allGames, 30);

      upcoming.forEach((game) => {
        const dateStr = format(new Date(game.date), "yyyy-MM-dd");
        const teamName =
          game.team === "man-city" ? "Man City" : "Illinois Basketball";
        gcalEvents.push({
          summary: `[Game] ${teamName} vs ${game.opponent}`,
          start: { dateTime: `${dateStr}T${game.time}:00`, timeZone: tz },
          end: { dateTime: `${dateStr}T${game.endTime}:00`, timeZone: tz },
          description: `${game.venue} | ${game.competition} | ${game.isHome ? "Home" : "Away"}\nSynced from Personal Tracker`,
          colorId: game.team === "man-city" ? "7" : "6",
          reminders: { useDefault: false, overrides: [] },
        });
      });
    } catch {
      // Continue without sports
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
        if (result.deleted > 0) parts.push(`${result.deleted} old removed`);
        if (result.created > 0) parts.push(`${result.created} created`);
        if (result.errors > 0) parts.push(`${result.errors} errors`);
        setSyncResult(parts.join(", ") || "Nothing to sync");
      }
      fetchEvents(token);
    } catch {
      setSyncResult("Sync failed");
    }

    setSyncing(false);
  };

  const getEventsForDay = (date: Date): CalendarDisplayEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");

    const googleEvents: CalendarDisplayEvent[] = events
      .filter((e) => e.start.startsWith(dateStr))
      .map((e) => ({ ...e, editable: false }));

    // We need to load custom events async, but this is called synchronously in render.
    // Use a state-based approach with refreshKey to trigger re-renders.
    let customEventsFromState: CalendarDisplayEvent[] = [];
    try {
      // This won't work synchronously - we'll handle this via useEffect below
      customEventsFromState = [];
    } catch {
      // ignore
    }

    return [...googleEvents, ...customEventsFromState].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
  };

  // Load custom events for all days in the week
  const [weekCustomEvents, setWeekCustomEvents] = useState<Record<string, CalendarDisplayEvent[]>>({});

  useEffect(() => {
    async function loadCustomEvents() {
      const result: Record<string, CalendarDisplayEvent[]> = {};
      for (const day of weekDays) {
        const dateStr = format(day, "yyyy-MM-dd");
        const customEvents = await getCustomEventsForDate(dateStr);
        result[dateStr] = customEvents.map((ce) => ({
          id: `custom-${ce.id}`,
          customEventId: ce.id,
          summary: ce.name,
          start: `${ce.date}T${ce.start}:00`,
          end: `${ce.date}T${ce.end}:00`,
          source: "manual" as const,
          editable: true,
        }));
      }
      setWeekCustomEvents(result);
    }
    loadCustomEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, refreshKey, events]);

  const getEventsForDayMerged = (date: Date): CalendarDisplayEvent[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    const googleEvents: CalendarDisplayEvent[] = events
      .filter((e) => e.start.startsWith(dateStr))
      .map((e) => ({ ...e, editable: false }));
    const customEvents = weekCustomEvents[dateStr] || [];
    return [...googleEvents, ...customEvents].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
  };

  const getEventStyle = (evt: CalendarDisplayEvent) => {
    if (evt.source === "manual" || evt.editable) {
      return {
        bg: "bg-rose-500/15 border-rose-500/30",
        text: "text-rose-300",
        time: "text-rose-400/60",
      };
    }
    if (evt.summary.startsWith("[Routine]"))
      return {
        bg: "bg-emerald-500/15 border-emerald-500/30",
        text: "text-emerald-300",
        time: "text-emerald-400/60",
      };
    if (evt.summary.startsWith("[Game]"))
      return {
        bg: "bg-sky-500/15 border-sky-500/30",
        text: "text-sky-300",
        time: "text-sky-400/60",
      };
    return {
      bg: "bg-violet-500/15 border-violet-500/30",
      text: "text-violet-300",
      time: "text-violet-400/60",
    };
  };

  const formatEventTime = (dateStr: string) => {
    try {
      const t = dateStr.substring(11, 16);
      if (!t) return "";
      return formatTime12h(t);
    } catch {
      return "";
    }
  };

  const cleanSummary = (s: string) => s.replace(/^\[(Routine|Game)\] /, "");

  // Cross-day drag handlers (desktop)
  const handleDragPointerDown = (e: React.PointerEvent, evt: CalendarDisplayEvent, dayIdx: number) => {
    if (!evt.editable || !evt.customEventId) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const sourceDate = format(weekDays[dayIdx], "yyyy-MM-dd");
    setDragCalState({
      eventId: evt.customEventId,
      sourceDate,
      currentColIdx: dayIdx,
      hasMoved: false,
    });
  };

  const handleDragPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragCalState) return;
      for (let i = 0; i < dayColumnRefs.current.length; i++) {
        const col = dayColumnRefs.current[i];
        if (!col) continue;
        const rect = col.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          if (i !== dragCalState.currentColIdx) {
            setDragCalState((prev) =>
              prev ? { ...prev, currentColIdx: i, hasMoved: true } : null
            );
          }
          break;
        }
      }
    },
    [dragCalState]
  );

  const handleDragPointerUp = useCallback(async () => {
    if (!dragCalState) return;
    if (dragCalState.hasMoved && dragCalState.currentColIdx !== null) {
      const newDate = format(weekDays[dragCalState.currentColIdx], "yyyy-MM-dd");
      if (newDate !== dragCalState.sourceDate) {
        await updateCustomEvent(dragCalState.eventId, { date: newDate });
        triggerRefresh();
      }
    }
    setDragCalState(null);
  }, [dragCalState, weekDays]);

  useEffect(() => {
    if (!dragCalState) return;
    window.addEventListener("pointermove", handleDragPointerMove);
    window.addEventListener("pointerup", handleDragPointerUp);
    return () => {
      window.removeEventListener("pointermove", handleDragPointerMove);
      window.removeEventListener("pointerup", handleDragPointerUp);
    };
  }, [dragCalState, handleDragPointerMove, handleDragPointerUp]);

  // Click handlers
  const handleEventClick = (evt: CalendarDisplayEvent) => {
    if (dragCalState?.hasMoved) return;
    if (!evt.editable || !evt.customEventId) return;
    const startTime = evt.start.substring(11, 16);
    const endTime = evt.end.substring(11, 16);
    const date = evt.start.substring(0, 10);
    setEditorState({
      mode: "edit",
      eventId: evt.customEventId,
      eventType: "custom",
      initialData: { name: evt.summary, start: startTime, end: endTime, date },
    });
  };

  const handleDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    setEditorState({
      mode: "create",
      initialData: { name: "", start: "09:00", end: "09:30", date: dateStr },
    });
  };

  // Force re-read of custom events
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _refresh = refreshKey;
  // Suppress unused getEventsForDay
  void getEventsForDay;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-bold text-white">Calendar</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {connected && (
              <>
                <button
                  onClick={handleSyncToGoogle}
                  disabled={syncing}
                  className="text-sm font-semibold px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-500 hover:to-blue-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-500/20 inline-flex items-center gap-1.5"
                >
                  {syncing ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
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
              </>
            )}
          </div>
        </div>

        {syncResult && (
          <div
            className={`mt-3 p-3 rounded-xl text-sm border ${
              syncResult.includes("Error") || syncResult.includes("failed")
                ? "bg-red-500/10 border-red-500/30 text-red-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {syncResult}
          </div>
        )}
      </div>

      {!connected ? (
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50 text-center py-12">
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
        <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-700 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Week navigation */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-4 shadow-lg border border-slate-700/50">
            <div className="flex items-center justify-between">
              <button
                onClick={goToPrevWeek}
                className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={goToThisWeek} className="text-sm font-semibold text-white">
                {format(weekDays[0], "MMM d")} &ndash; {format(weekDays[6], "MMM d, yyyy")}
              </button>
              <button
                onClick={goToNextWeek}
                className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop: 7-column grid */}
          <div className="hidden md:grid grid-cols-7 gap-2 select-none">
            {weekDays.map((day, dayIdx) => {
              const dayEvents = getEventsForDayMerged(day);
              const today = isToday(day);
              const isDropTarget = dragCalState?.currentColIdx === dayIdx && dragCalState?.hasMoved;
              return (
                <div
                  key={day.toISOString()}
                  ref={(el) => { dayColumnRefs.current[dayIdx] = el; }}
                  className={`bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-3 shadow-lg border min-h-[200px] transition-all ${
                    isDropTarget
                      ? "border-violet-500/60 ring-2 ring-violet-500/30 bg-violet-500/5"
                      : today
                      ? "border-violet-500/50 ring-1 ring-violet-500/20"
                      : "border-slate-700/50"
                  }`}
                  onClick={(e) => {
                    if (dragCalState?.hasMoved) return;
                    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.dayEmpty) {
                      handleDayClick(day);
                    }
                  }}
                >
                  <div className="text-center mb-3">
                    <p className="text-xs text-slate-500 uppercase font-medium">{format(day, "EEE")}</p>
                    <p className={`text-lg font-bold ${today ? "text-violet-400" : "text-white"}`}>
                      {format(day, "d")}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.length === 0 && (
                      <p
                        data-day-empty="true"
                        className="text-xs text-slate-600 text-center pt-2 cursor-pointer hover:text-slate-400 transition-colors"
                      >
                        + Add event
                      </p>
                    )}
                    {dayEvents.map((evt) => {
                      const style = getEventStyle(evt);
                      return (
                        <div
                          key={evt.id}
                          className={`p-1.5 rounded-lg border text-xs ${style.bg} ${
                            evt.editable
                              ? "cursor-grab hover:brightness-110 active:cursor-grabbing"
                              : ""
                          }`}
                          onPointerDown={(e) => handleDragPointerDown(e, evt, dayIdx)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(evt);
                          }}
                        >
                          <p className={`font-medium truncate ${style.text}`}>{cleanSummary(evt.summary)}</p>
                          <p className={`${style.time} text-[10px]`}>{formatEventTime(evt.start)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {dayEvents.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDayClick(day);
                      }}
                      className="mt-2 w-full text-xs text-slate-600 hover:text-violet-400 transition-colors text-center py-1"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked days */}
          <div className="md:hidden space-y-3">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDayMerged(day);
              const today = isToday(day);
              if (dayEvents.length === 0 && !today && !isSameDay(day, weekDays[0])) return null;
              return (
                <div
                  key={day.toISOString()}
                  className={`bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-4 shadow-lg border ${
                    today
                      ? "border-violet-500/50 ring-1 ring-violet-500/20"
                      : "border-slate-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        today
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-slate-700/60 text-white"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{format(day, "EEEE")}</p>
                      <p className="text-slate-400 text-xs">{format(day, "MMMM d")}</p>
                    </div>
                    {today && (
                      <span className="ml-auto text-xs font-bold text-violet-400 bg-violet-500/15 px-2 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  {dayEvents.length === 0 ? (
                    <button
                      onClick={() => handleDayClick(day)}
                      className="text-xs text-slate-500 hover:text-violet-400 transition-colors pl-13"
                    >
                      + Add event
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {dayEvents.map((evt) => {
                        const style = getEventStyle(evt);
                        return (
                          <div
                            key={evt.id}
                            className={`p-2.5 rounded-xl border ${style.bg} flex items-center gap-3 ${
                              evt.editable ? "cursor-pointer hover:brightness-110" : ""
                            }`}
                            onClick={() => handleEventClick(evt)}
                          >
                            <span className={`text-xs font-mono flex-shrink-0 ${style.time}`}>
                              {formatEventTime(evt.start)}
                            </span>
                            <p className={`font-medium text-sm truncate ${style.text}`}>
                              {cleanSummary(evt.summary)}
                            </p>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => handleDayClick(day)}
                        className="w-full text-xs text-slate-600 hover:text-violet-400 transition-colors text-center py-1"
                      >
                        + Add event
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Event Editor Modal */}
      {editorState && (
        <EventEditor
          mode={editorState.mode}
          eventType={editorState.eventType}
          initialData={editorState.initialData}
          onSave={async (data) => {
            if (editorState.mode === "create") {
              await addCustomEvent({
                name: data.name,
                date: data.date,
                start: data.start,
                end: data.end,
              });
            } else if (editorState.eventId) {
              await updateCustomEvent(editorState.eventId, {
                name: data.name,
                start: data.start,
                end: data.end,
                date: data.date,
              });
            }
            setEditorState(null);
            triggerRefresh();
          }}
          onDelete={
            editorState.eventId
              ? async () => {
                  await removeCustomEvent(editorState.eventId!);
                  setEditorState(null);
                  triggerRefresh();
                }
              : undefined
          }
          onClose={() => setEditorState(null)}
        />
      )}
    </div>
  );
}
