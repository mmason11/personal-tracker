"use client";

import { useState, useEffect, useCallback } from "react";
import { format, addDays, subDays, isToday } from "date-fns";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getGamesForDate } from "@/lib/sports";
import { isCompleted } from "@/lib/streaks";
import { formatTime12h } from "@/lib/timeFormat";

interface TimeBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: "routine" | "game-mancity" | "game-illinois";
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
      timeBlocks.push({
        id: item.id,
        name: item.name,
        start: item.time,
        end: item.endTime || item.time,
        type: "routine",
        completed: isCompleted(item.id, dateStr),
      });
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

    timeBlocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    setBlocks(timeBlocks);
  }, [selectedDate, dateStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMinutes(getCurrentTimeMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const goToPrev = () => setSelectedDate((d) => subDays(d, 1));
  const goToNext = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Timeline spans from earliest block - 1hr to latest block + 1hr
  const allMinutes = blocks.flatMap((b) => [timeToMinutes(b.start), timeToMinutes(b.end)]);
  const timelineStart = allMinutes.length > 0 ? Math.max(0, Math.min(...allMinutes) - 60) : 5 * 60;
  const timelineEnd = allMinutes.length > 0 ? Math.min(24 * 60, Math.max(...allMinutes) + 60) : 23 * 60;
  const timelineRange = timelineEnd - timelineStart;

  const getTopPercent = (time: string) => {
    const mins = timeToMinutes(time);
    return ((mins - timelineStart) / timelineRange) * 100;
  };

  const currentTimePercent = ((currentMinutes - timelineStart) / timelineRange) * 100;
  const showCurrentLine = isViewingToday && currentTimePercent >= 0 && currentTimePercent <= 100;

  // Generate hour markers
  const firstHour = Math.ceil(timelineStart / 60);
  const lastHour = Math.floor(timelineEnd / 60);
  const hourMarkers = [];
  for (let h = firstHour; h <= lastHour; h++) {
    hourMarkers.push(h);
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      {/* Header with day navigation */}
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
        <div className="relative" style={{ minHeight: `${Math.max(blocks.length * 72, 300)}px` }}>
          {/* Hour markers */}
          {hourMarkers.map((h) => {
            const top = getTopPercent(`${h.toString().padStart(2, "0")}:00`);
            return (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: `${top}%` }}
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
              style={{ top: `${currentTimePercent}%` }}
            >
              <span className="text-xs text-red-400 w-16 flex-shrink-0 text-right pr-3 font-bold font-mono">
                {formatTime12h(`${Math.floor(currentMinutes / 60).toString().padStart(2, "0")}:${(currentMinutes % 60).toString().padStart(2, "0")}`)}
              </span>
              <div className="relative flex-1">
                <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                <div className="border-t-2 border-red-500 shadow-sm shadow-red-500/30" />
              </div>
            </div>
          )}

          {/* Event blocks */}
          {blocks.map((block) => {
            const top = getTopPercent(block.start);
            const bottom = getTopPercent(block.end);
            const height = Math.max(bottom - top, 5);

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
            }

            return (
              <div
                key={block.id}
                className={`absolute left-20 right-2 rounded-xl border bg-gradient-to-r ${bgClass} p-3 z-10 transition-all hover:scale-[1.01] hover:shadow-lg`}
                style={{ top: `${top}%`, height: `${height}%`, minHeight: "52px" }}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotClass} mt-1 flex-shrink-0 shadow-sm`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${textClass} leading-tight`}>
                      {block.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatTime12h(block.start)} - {formatTime12h(block.end)}
                    </p>
                  </div>
                  {block.completed && (
                    <span className="text-emerald-400 text-xs font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
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
