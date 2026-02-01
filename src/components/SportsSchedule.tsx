"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { SportsGame, Conflict } from "@/lib/types";
import { fetchSportsSchedules, getUpcomingGames } from "@/lib/sports";
import { getRoutineForDate, getCurrentWeek } from "@/lib/routine";
import { detectConflicts } from "@/lib/conflicts";
import { formatTime12h } from "@/lib/timeFormat";

export default function SportsSchedule() {
  const [games, setGames] = useState<SportsGame[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "man-city" | "illinois-basketball">("all");

  useEffect(() => {
    async function load() {
      const allGames = await fetchSportsSchedules();
      const upcoming = getUpcomingGames(allGames, 30);
      setGames(upcoming);

      const week = await getCurrentWeek();
      const allConflicts: Conflict[] = [];
      const checkedDates = new Set<string>();

      upcoming.forEach((game) => {
        const dateStr = format(new Date(game.date), "yyyy-MM-dd");
        if (!checkedDates.has(dateStr)) {
          checkedDates.add(dateStr);
          const routine = getRoutineForDate(new Date(game.date), week);
          const dayGames = upcoming.filter(
            (g) => format(new Date(g.date), "yyyy-MM-dd") === dateStr
          );
          allConflicts.push(...detectConflicts(dayGames, routine));
        }
      });
      setConflicts(allConflicts);
      setLoading(false);
    }
    load();
  }, []);

  const filteredGames = filter === "all" ? games : games.filter((g) => g.team === filter);

  const getConflictsForGame = (gameId: string) =>
    conflicts.filter((c) => c.game.id === gameId);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h2 className="text-xl font-bold text-white mb-4">Game Schedule</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <h2 className="text-xl font-bold text-white mb-4">Game Schedule</h2>

      <div className="flex gap-2 mb-4">
        {(["all", "man-city", "illinois-basketball"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? f === "man-city"
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : f === "illinois-basketball"
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-slate-700/50 text-slate-400 border border-transparent hover:bg-slate-700"
            }`}
          >
            {f === "all" ? "All" : f === "man-city" ? "Man City" : "Illinois"}
          </button>
        ))}
      </div>

      {filteredGames.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No upcoming games</p>
      ) : (
        <div className="space-y-3">
          {filteredGames.map((game) => {
            const gameConflicts = getConflictsForGame(game.id);
            const isManCity = game.team === "man-city";
            return (
              <div
                key={game.id}
                className={`p-4 rounded-xl border ${
                  isManCity
                    ? "bg-sky-500/5 border-sky-500/20"
                    : "bg-orange-500/5 border-orange-500/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isManCity
                            ? "bg-sky-500/20 text-sky-400"
                            : "bg-orange-500/20 text-orange-400"
                        }`}
                      >
                        {isManCity ? "MCI" : "ILL"}
                      </span>
                      <span className="text-white font-medium">
                        vs {game.opponent}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      {format(new Date(game.date), "EEE, MMM d")} &middot;{" "}
                      {formatTime12h(game.time)} - {formatTime12h(game.endTime)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {game.venue} &middot; {game.competition}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      game.isHome
                        ? "bg-green-500/20 text-green-400"
                        : "bg-slate-600/50 text-slate-400"
                    }`}
                  >
                    {game.isHome ? "HOME" : "AWAY"}
                  </span>
                </div>

                {gameConflicts.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {gameConflicts.map((conflict, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <span className="text-red-400 text-sm mt-0.5">⚠️</span>
                        <div className="text-sm">
                          <p className="text-red-400 font-medium">
                            Conflicts with {conflict.routineItem.name}
                          </p>
                          <p className="text-slate-400">{conflict.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
