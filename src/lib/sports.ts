import { SportsGame } from "./types";

const CACHE_KEY = "sports_cache";
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

interface SportsCache {
  games: SportsGame[];
  lastFetched: number;
}

function getCachedGames(): SportsGame[] | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(CACHE_KEY);
  if (!stored) return null;
  const cache: SportsCache = JSON.parse(stored);
  if (Date.now() - cache.lastFetched > CACHE_DURATION) return null;
  return cache.games;
}

function setCachedGames(games: SportsGame[]): void {
  const cache: SportsCache = { games, lastFetched: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function fetchSportsSchedules(): Promise<SportsGame[]> {
  const cached = getCachedGames();
  if (cached) return cached;

  try {
    const response = await fetch("/api/sports");
    if (!response.ok) throw new Error("Failed to fetch sports schedules");
    const games: SportsGame[] = await response.json();
    setCachedGames(games);
    return games;
  } catch (error) {
    console.error("Error fetching sports schedules:", error);
    // Return cached even if expired, or empty
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) return JSON.parse(stored).games;
    return [];
  }
}

export function getUpcomingGames(games: SportsGame[], days: number = 14): SportsGame[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return games
    .filter((g) => {
      const gameDate = new Date(g.date);
      return gameDate >= now && gameDate <= cutoff;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getGamesForDate(games: SportsGame[], date: string): SportsGame[] {
  return games.filter((g) => g.date.startsWith(date));
}
