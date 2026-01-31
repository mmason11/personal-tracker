"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getGamesForDate } from "@/lib/sports";
import { isCompleted } from "@/lib/streaks";
import { formatTime12h } from "@/lib/timeFormat";

import { CalendarEvent } from "@/lib/types";

interface TimeBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: "routine" | "game-mancity" | "game-illinois" | "google";
  completed?: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Pixels per minute — controls how tall each time slot is
const PX_PER_MIN = 1.8;

export default function DayTimeline() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentTimeMinutes());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isViewingToday = isToday(selectedDate);

  const loadData = useCallback(async () => {
    const week = getCurrentWeek();
    const routine = getRoutineForDate(selectedDate, week);
    const allGames = await fetchSportsSchedules();
    const dayGames = getGamesForDate(allGames, dateStr);

    const timeBlocks: TimeBlock[] = [];

    routine.forEach((item) => {
      if (item.endTime) {
        timeBlocks.push({
          id: item.id,
          name: item.name,
          start: item.time,
          end: item.endTime,
          type: "routine",
          completed: isCompleted(item.id, dateStr),
        });
      }
    });

    dayGames.forEach((game) => {
      timeBlocks.push({
        id: game.id,
        name: `${game.team === "man-city" ? "Man City" : "Illinois"} vs ${game.opponent}`,
        start: game.time,
        end: game.endTime,
        type: game.team === "man-city" ? "game-mancity" : "game-illinois",
      });
    });

    // Fetch Google Calendar events for this day
    const token = localStorage.getItem("google_access_token");
    if (token) {
      try {
        const res = await fetch(`/api/calendar?action=events&token=${token}`);
        if (res.ok) {
          const gcalEvents: CalendarEvent[] = await res.json();
          gcalEvents.forEach((evt) => {
            if (!evt.start || !evt.end) return;
            const evtDate = evt.start.substring(0, 10);
            if (evtDate !== dateStr) return;
            // Skip events we synced ourselves
            if (evt.summary.startsWith("[Routine]") || evt.summary.startsWith("[Game]")) return;
            const startTime = evt.start.substring(11, 16);
            const endTime = evt.end.substring(11, 16);
            if (!startTime || !endTime) return;
            timeBlocks.push({
              id: evt.id,
              name: evt.summary,
              start: startTime,
              end: endTime,
              type: "google",
            });
          });
        }
      } catch {
        // Ignore calendar fetch errors
      }
    }

    timeBlocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    setBlocks(timeBlocks);
  }, [selectedDate, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinutes(getCurrentTimeMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const goToPrev = () => setSelectedDate((d) => subDays(d, 1));
  const goToNext = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Compute timeline bounds (snap to hour boundaries)
  const allMinutes = blocks.flatMap((b) => [timeToMinutes(b.start), timeToMinutes(b.end)]);
  const rawStart = allMinutes.length > 0 ? Math.min(...allMinutes) : 5 * 60;
  const rawEnd = allMinutes.length > 0 ? Math.max(...allMinutes) : 23 * 60;
  const timelineStartMin = Math.floor(rawStart / 60) * 60; // snap to hour
  const timelineEndMin = Math.ceil(rawEnd / 60) * 60;
  const totalMinutes = timelineEndMin - timelineStartMin;
  const totalHeight = totalMinutes * PX_PER_MIN;

  const minToY = (min: number) => (min - timelineStartMin) * PX_PER_MIN;

  const currentTimeY = minToY(currentMinutes);
  const showCurrentLine = isViewingToday && currentMinutes >= timelineStartMin && currentMinutes <= timelineEndMin;

  // Hour markers
  const hourMarkers: number[] = [];
  for (let h = Math.ceil(timelineStartMin / 60); h <= Math.floor(timelineEndMin / 60); h++) {
    hourMarkers.push(h);
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">Timeline</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              isViewingToday
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/40"
                : "bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white"
            }`}
          >
            {isViewingToday ? "Today" : format(selectedDate, "MMM d")}
          </button>
          <button
            onClick={goToNext}
            className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-300 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        {format(selectedDate, "EEEE, MMMM d, yyyy")}
      </p>

      {blocks.length === 0 ? (
        <p className="text-slate-500 text-center py-8">Nothing scheduled</p>
      ) : (
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          {/* Hour markers */}
          {hourMarkers.map((h) => {
            const y = minToY(h * 60);
            return (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: `${y}px` }}
              >
                <span className="text-xs text-slate-500 w-16 flex-shrink-0 text-right pr-3 font-mono">
                  {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </span>
                <div className="flex-1 border-t border-slate-700/50" />
              </div>
            );
          })}

          {/* Current time line */}
          {showCurrentLine && (
            <div
              className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
              style={{ top: `${currentTimeY}px` }}
            >
              <span className="text-xs text-red-400 w-16 flex-shrink-0 text-right pr-3 font-bold font-mono">
                {formatTime12h(
                  `${Math.floor(currentMinutes / 60).toString().padStart(2, "0")}:${(currentMinutes % 60).toString().padStart(2, "0")}`
                )}
              </span>
              <div className="relative flex-1">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                <div className="border-t-2 border-red-500 shadow-sm shadow-red-500/30" />
              </div>
            </div>
          )}

          {/* Event blocks */}
          {blocks.map((block) => {
            const startMin = timeToMinutes(block.start);
            const endMin = timeToMinutes(block.end);
            const y = minToY(startMin);
            const h = Math.max((endMin - startMin) * PX_PER_MIN, 0);

            let bgClass = "from-blue-500/20 to-blue-600/10 border-blue-500/40";
            let dotClass = "bg-blue-400";
            let textClass = "text-blue-300";

            if (block.completed) {
              bgClass = "from-emerald-500/20 to-emerald-600/10 border-emerald-500/40";
              dotClass = "bg-emerald-400";
              textClass = "text-emerald-300";
            } else if (block.type === "game-mancity") {
              bgClass = "from-sky-500/25 to-cyan-600/10 border-sky-400/50";
              dotClass = "bg-sky-400";
              textClass = "text-sky-300";
            } else if (block.type === "game-illinois") {
              bgClass = "from-orange-500/25 to-amber-600/10 border-orange-400/50";
              dotClass = "bg-orange-400";
              textClass = "text-orange-300";
            } else if (block.type === "google") {
              bgClass = "from-violet-500/20 to-purple-600/10 border-violet-400/50";
              dotClass = "bg-violet-400";
              textClass = "text-violet-300";
            }

            return (
              <div
                key={block.id}
                className={`absolute left-20 right-2 rounded-xl border bg-gradient-to-r ${bgClass} px-3 py-1.5 z-10 overflow-hidden flex items-center`}
                style={{ top: `${y}px`, height: `${h}px` }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-2 h-2 rounded-full ${dotClass} flex-shrink-0`} />
                  <p className={`font-semibold text-sm ${textClass} truncate`}>
                    {block.name}
                  </p>
                  <span className="text-xs text-slate-400 flex-shrink-0 ml-auto">
                    {formatTime12h(block.start)} - {formatTime12h(block.end)}
                  </span>
                  {block.completed && (
                    <span className="text-emerald-400 text-xs font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      Done
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
