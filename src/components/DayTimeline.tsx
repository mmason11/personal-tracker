"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { fetchSportsSchedules, getGamesForDate } from "@/lib/sports";
import { isCompleted } from "@/lib/streaks";

interface TimeBlock {
  id: string;
  name: string;
  start: string;
  end: string;
  type: "routine" | "game-mancity" | "game-illinois";
  completed?: boolean;
}

function timeToPercent(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const totalMins = (h - 5) * 60 + m;
  return Math.max(0, Math.min(100, (totalMins / (17 * 60)) * 100));
}

export default function DayTimeline() {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    async function load() {
      const week = getCurrentWeek();
      const routine = getRoutineForDate(new Date(), week);
      const allGames = await fetchSportsSchedules();
      const todayGames = getGamesForDate(allGames, today);

      const timeBlocks: TimeBlock[] = [];

      routine.forEach((item) => {
        timeBlocks.push({
          id: item.id,
          name: item.name,
          start: item.time,
          end: item.endTime || item.time,
          type: "routine",
          completed: isCompleted(item.id, today),
        });
      });

      todayGames.forEach((game) => {
        timeBlocks.push({
          id: game.id,
          name: `${game.team === "man-city" ? "Man City" : "Illinois"} vs ${game.opponent}`,
          start: game.time,
          end: game.endTime,
          type: game.team === "man-city" ? "game-mancity" : "game-illinois",
        });
      });

      setBlocks(timeBlocks);
    }
    load();
  }, [today]);

  const hours = Array.from({ length: 18 }, (_, i) => i + 5);

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
      <h2 className="text-xl font-bold text-white mb-4">
        Today&apos;s Timeline
      </h2>

      {/* Desktop horizontal */}
      <div className="hidden md:block">
        <div className="relative h-24 mt-6">
          <div className="absolute inset-0 flex">
            {hours.map((h) => (
              <div key={h} className="flex-1 border-l border-slate-700 relative">
                <span className="absolute -top-5 left-0 text-xs text-slate-500 -translate-x-1/2">
                  {h > 12 ? h - 12 : h}
                  {h >= 12 ? "p" : "a"}
                </span>
              </div>
            ))}
          </div>

          {blocks.map((block) => {
            const left = timeToPercent(block.start);
            const right = timeToPercent(block.end);
            const width = Math.max(right - left, 2);

            let colorClass = "bg-blue-500/30 border-blue-500/50";
            if (block.completed)
              colorClass = "bg-green-500/30 border-green-500/50";
            if (block.type === "game-mancity")
              colorClass = "bg-sky-500/30 border-sky-500/50";
            if (block.type === "game-illinois")
              colorClass = "bg-orange-500/30 border-orange-500/50";

            return (
              <div
                key={block.id}
                className={`absolute top-6 h-14 rounded-lg border ${colorClass} flex items-center justify-center overflow-hidden px-1`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`${block.name} (${block.start}-${block.end})`}
              >
                <span className="text-xs text-white truncate font-medium">
                  {block.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile vertical */}
      <div className="md:hidden space-y-2">
        {blocks
          .sort((a, b) => a.start.localeCompare(b.start))
          .map((block) => {
            let colorClass = "border-l-blue-500";
            if (block.completed) colorClass = "border-l-green-500";
            if (block.type === "game-mancity") colorClass = "border-l-sky-500";
            if (block.type === "game-illinois")
              colorClass = "border-l-orange-500";

            return (
              <div
                key={block.id}
                className={`p-3 rounded-r-xl bg-slate-700/50 border-l-4 ${colorClass}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-medium">
                    {block.name}
                  </span>
                  {block.completed && (
                    <span className="text-green-400 text-xs">Done</span>
                  )}
                </div>
                <span className="text-slate-400 text-xs">
                  {block.start} - {block.end}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
