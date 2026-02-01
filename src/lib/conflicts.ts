import { SportsGame, RoutineItem, Conflict } from "./types";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function detectConflicts(
  games: SportsGame[],
  routine: RoutineItem[]
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const game of games) {
    for (const item of routine) {
      const itemEnd = item.endTime || minutesToTime(timeToMinutes(item.time) + 15);

      if (timeRangesOverlap(game.time, game.endTime, item.time, itemEnd)) {
        const suggestion = generateSuggestion(game, item);
        conflicts.push({ game, routineItem: item, suggestion });
      }
    }
  }

  return conflicts;
}

function generateSuggestion(game: SportsGame, item: RoutineItem): string {
  const gameStart = timeToMinutes(game.time);
  const gameEnd = timeToMinutes(game.endTime);
  const itemStart = timeToMinutes(item.time);
  const itemEnd = timeToMinutes(item.endTime || minutesToTime(itemStart + 15));
  const itemDuration = itemEnd - itemStart;

  const teamName = game.team === "man-city" ? "Man City" : "Illinois";

  // Try moving routine item before the game
  const beforeStart = gameStart - itemDuration - 15;
  if (beforeStart >= 6 * 60) {
    return `Move "${item.name}" to ${minutesToTime(beforeStart)} (before the ${teamName} game)`;
  }

  // Try moving it after the game
  const afterStart = gameEnd + 15;
  if (afterStart + itemDuration <= 23 * 60) {
    return `Move "${item.name}" to ${minutesToTime(afterStart)} (after the ${teamName} game)`;
  }

  // For workout specifically, suggest morning
  if (item.id === "workout") {
    return `Move workout to the morning (before the ${teamName} game)`;
  }

  return `Adjust "${item.name}" around the ${teamName} game (${game.time}-${game.endTime})`;
}

export function getConflictsForDate(
  date: string,
  games: SportsGame[],
  routine: RoutineItem[]
): Conflict[] {
  const dayGames = games.filter((g) => g.date.startsWith(date));
  return detectConflicts(dayGames, routine);
}
